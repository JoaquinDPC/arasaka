package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"time"

	"arasaka/internal/importer"
)

type SyncService struct {
	db       *sql.DB
	user     string
	password string
}

func NewSyncService(db *sql.DB, user, password string) *SyncService {
	return &SyncService{db: db, user: user, password: password}
}

func (s *SyncService) Sync(ctx context.Context) (importer.Result, error) {
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
	cmd := exec.CommandContext(cmdCtx, "fintself", "scrape", "cl_banco_chile",
		"--output-file", tmpPath)
	cmd.Env = append(os.Environ(),
		"CL_BANCO_CHILE_USER="+s.user,
		"CL_BANCO_CHILE_PASSWORD="+s.password,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return importer.Result{}, fmt.Errorf("fintself failed: %w\n%s", err, out)
	}

	data, err := os.ReadFile(tmpPath)
	if err != nil {
		return importer.Result{}, fmt.Errorf("read fintself output: %w", err)
	}

	var all []importer.MovimientoRecord
	if err := json.Unmarshal(data, &all); err != nil {
		return importer.Result{}, fmt.Errorf("parse fintself output: %w", err)
	}

	now := time.Now()
	var records []importer.MovimientoRecord
	for _, r := range all {
		d, err := importer.ParseDate(r.Date)
		if err != nil {
			continue
		}
		if d.Year() == now.Year() && d.Month() == now.Month() {
			records = append(records, r)
		}
	}

	var fromDate time.Time
	row := s.db.QueryRowContext(ctx, `SELECT MAX(date) FROM transactions WHERE source = 'bank_json'`)
	var nt sql.NullTime
	if err := row.Scan(&nt); err == nil && nt.Valid {
		fromDate = nt.Time
	}

	return importer.Run(ctx, s.db, records, fromDate)
}
