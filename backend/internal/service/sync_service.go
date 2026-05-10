package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strings"
	"time"

	"arasaka/internal/domain"
	"arasaka/internal/importer"
	"github.com/lib/pq"
)

type SyncService struct {
	db                 *sql.DB
	bancochileUser     string
	bancochilePassword string
	santanderUser      string
	santanderPassword  string
	inferenceSvc       *TagInferenceService
	logger             *slog.Logger
}

func NewSyncService(db *sql.DB, bancochileUser, bancochilePassword, santanderUser, santanderPassword string, inferenceSvc *TagInferenceService, logger *slog.Logger) *SyncService {
	return &SyncService{
		db:                 db,
		bancochileUser:     bancochileUser,
		bancochilePassword: bancochilePassword,
		santanderUser:      santanderUser,
		santanderPassword:  santanderPassword,
		inferenceSvc:       inferenceSvc,
		logger:             logger,
	}
}

// Sync scrapes movements and imports them. If bankID is empty, all configured
// banks are synced. Otherwise only the matching bank is synced.
func (s *SyncService) Sync(ctx context.Context, bankID string) (importer.Result, error) {
	s.logger.Info("sync started", "bank_id", bankID)
	var combined importer.Result

	if (bankID == "" || bankID == "cl_banco_chile") && s.bancochileUser != "" {
		result, err := s.syncBank(ctx, "cl_banco_chile", s.bancochileUser, s.bancochilePassword, domain.BankBancoDeChile)
		if err != nil {
			s.logger.Error("sync failed", "bank", "cl_banco_chile", "err", err)
			return combined, fmt.Errorf("banco chile: %w", err)
		}
		combined = mergeResults(combined, result)
	}

	if (bankID == "" || bankID == "cl_santander") && s.santanderUser != "" {
		result, err := s.syncBank(ctx, "cl_santander", s.santanderUser, s.santanderPassword, domain.BankSantander)
		if err != nil {
			s.logger.Error("sync failed", "bank", "cl_santander", "err", err)
			return combined, fmt.Errorf("santander: %w", err)
		}
		combined = mergeResults(combined, result)
	}

	s.logger.Info("sync complete",
		"bank_imported", combined.BankImported,
		"bank_duplicates", combined.BankDuplicates,
		"cc_statements", len(combined.CCStatements),
	)
	return combined, nil
}

func (s *SyncService) syncBank(ctx context.Context, bankID, user, password, dbBankID string) (importer.Result, error) {
	tmpFile, err := os.CreateTemp("", "fintself-*.json")
	if err != nil {
		return importer.Result{}, fmt.Errorf("create temp file: %w", err)
	}
	tmpFile.Close()
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	cmdCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	// Run fintself in headed mode — Auth0 blocks headless Chrome.
	prefix := strings.ToUpper(strings.ReplaceAll(bankID, "-", "_"))
	cmd := exec.CommandContext(cmdCtx, "fintself", "scrape", bankID, "--output-file", tmpPath)
	cmd.Env = append(os.Environ(),
		prefix+"_USER="+user,
		prefix+"_PASSWORD="+password,
	)
	s.logger.Info("fintself invoked", "bank", bankID)
	fintStart := time.Now()
	out, err := cmd.CombinedOutput()
	elapsed := time.Since(fintStart).Round(time.Second)
	s.logger.Debug("fintself output", "bank", bankID, "elapsed", elapsed, "output", string(out))
	if err != nil {
		return importer.Result{}, fmt.Errorf("fintself failed: %w\n%s", err, out)
	}
	s.logger.Info("fintself done", "bank", bankID, "elapsed", elapsed)

	data, err := os.ReadFile(tmpPath)
	if err != nil {
		return importer.Result{}, fmt.Errorf("read fintself output: %w", err)
	}

	var all []importer.MovimientoRecord
	if err := json.Unmarshal(data, &all); err != nil {
		return importer.Result{}, fmt.Errorf("parse fintself output: %w", err)
	}

	var accountID *int64
	var userID *int64
	var acctID int64
	var nullUID sql.NullInt64
	row := s.db.QueryRowContext(ctx, `SELECT id, user_id FROM accounts WHERE bank_id = $1 LIMIT 1`, dbBankID)
	if err := row.Scan(&acctID, &nullUID); err == nil {
		accountID = &acctID
		if nullUID.Valid {
			userID = &nullUID.Int64
		}
	}

	// Scope fromDate to this account so that a newer account doesn't block an
	// older one. If the account isn't linked yet, fromDate stays zero and dedup
	// via ON CONFLICT handles any repeated imports.
	var fromDate time.Time
	if accountID != nil {
		var nt sql.NullTime
		row := s.db.QueryRowContext(ctx,
			`SELECT MAX(date) FROM transactions WHERE source = 'bank_json' AND account_id = $1`,
			*accountID)
		if err := row.Scan(&nt); err == nil && nt.Valid {
			fromDate = nt.Time
		}
	}

	result, err := importer.Run(ctx, s.db, all, fromDate, accountID, userID, s.inferenceSvc, dbBankID, s.logger)

	// Retroactively link corriente movements that were imported before the account
	// existed in the database (account_id IS NULL). Uses all fetched movements —
	// not just the current-month slice — so historical orphans are also covered.
	if accountID != nil {
		var rawIDs []string
		for _, r := range all {
			if r.AccountType == "corriente" {
				rawIDs = append(rawIDs, importer.BankRawID(r))
			}
		}
		if len(rawIDs) > 0 {
			_, _ = s.db.ExecContext(ctx, `
				UPDATE transactions SET account_id = $1
				WHERE account_id IS NULL AND bank_raw_id = ANY($2)
			`, *accountID, pq.Array(rawIDs))
		}
	}

	return result, err
}

func mergeResults(a, b importer.Result) importer.Result {
	return importer.Result{
		BankImported:   a.BankImported + b.BankImported,
		BankDuplicates: a.BankDuplicates + b.BankDuplicates,
		CCStatements:   append(a.CCStatements, b.CCStatements...),
	}
}
