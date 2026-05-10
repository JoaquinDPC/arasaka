package service

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"arasaka/internal/domain"
	"arasaka/internal/importer"
	"arasaka/internal/pdfparser"
	"arasaka/internal/repository"
)

// supportedPDFBanks lists the bank_id values that have PDF parsers implemented.
var supportedPDFBanks = map[string]bool{
	domain.BankBancoDeChile: true,
	domain.BankSantander:    true,
}

// NamedPDF holds the raw bytes and original filename of an uploaded PDF.
type NamedPDF struct {
	Filename string
	Data     []byte
}

// FileResult is the per-file outcome of a batch PDF import.
type FileResult struct {
	Filename   string     `json:"filename"`
	Imported   int        `json:"imported"`
	Duplicates int        `json:"duplicates"`
	PeriodFrom *time.Time `json:"period_from,omitempty"`
	PeriodTo   *time.Time `json:"period_to,omitempty"`
	Error      string     `json:"error,omitempty"`
}

// BatchResult aggregates the outcome of importing N PDFs for one account.
type BatchResult struct {
	AccountID       int64        `json:"account_id"`
	BankID          string       `json:"bank_id"`
	Files           []FileResult `json:"files"`
	TotalImported   int          `json:"total_imported"`
	TotalDuplicates int          `json:"total_duplicates"`
}

// ImportService handles PDF cartola imports.
type ImportService struct {
	db           *sql.DB
	inferenceSvc *TagInferenceService
}

// NewImportService creates a new ImportService.
func NewImportService(db *sql.DB, inferenceSvc *TagInferenceService) *ImportService {
	return &ImportService{db: db, inferenceSvc: inferenceSvc}
}

// ImportPDFs validates ownership and bank support once, then processes each PDF
// file independently. A failure on one file does not abort the rest.
func (s *ImportService) ImportPDFs(ctx context.Context, userID, accountID int64, files []NamedPDF) (BatchResult, error) {
	// ── Ownership check (user-scoped) ─────────────────────────────────────────
	var bankID string
	var dbUserID sql.NullInt64
	row := s.db.QueryRowContext(ctx,
		`SELECT bank_id, user_id FROM accounts WHERE id = $1`, accountID)
	if err := row.Scan(&bankID, &dbUserID); err == sql.ErrNoRows {
		return BatchResult{}, fmt.Errorf("forbidden")
	} else if err != nil {
		return BatchResult{}, fmt.Errorf("account lookup: %w", err)
	}
	if !dbUserID.Valid || dbUserID.Int64 != userID {
		return BatchResult{}, fmt.Errorf("forbidden")
	}

	// ── Bank support check ────────────────────────────────────────────────────
	if !supportedPDFBanks[bankID] {
		return BatchResult{}, fmt.Errorf("bank %q does not support PDF import", bankID)
	}

	txRepo := repository.NewTransactionRepository(s.db)
	result := BatchResult{AccountID: accountID, BankID: bankID}

	for _, f := range files {
		fr := s.importOne(ctx, txRepo, userID, accountID, bankID, f)
		result.Files = append(result.Files, fr)
		result.TotalImported += fr.Imported
		result.TotalDuplicates += fr.Duplicates
	}

	return result, nil
}

// importOne parses a single PDF and inserts its rows. Errors are captured in the
// FileResult instead of propagating, so sibling files can still be processed.
func (s *ImportService) importOne(
	ctx context.Context,
	txRepo domain.TransactionRepository,
	userID, accountID int64,
	bankID string,
	f NamedPDF,
) FileResult {
	fr := FileResult{Filename: f.Filename}

	// ── Parse ─────────────────────────────────────────────────────────────────
	parsed, err := parsePDF(bankID, f.Data)
	if err != nil {
		fr.Error = fmt.Sprintf("parse error: %s", err)
		return fr
	}
	if len(parsed.Rows) == 0 {
		fr.Error = "no transactions found in PDF"
		return fr
	}

	// ── Map rows to CreateTransactionParams ──────────────────────────────────
	var params []domain.CreateTransactionParams
	for _, row := range parsed.Rows {
		rawID := importer.PDFRawID(accountID, row.Date, row.Amount, row.Description)
		uid := userID
		aid := accountID
		params = append(params, domain.CreateTransactionParams{
			Date:        row.Date,
			Description: row.Description,
			Category:    "NAN",
			Flow:        row.Flow,
			Amount:      row.Amount,
			Currency:    "CLP",
			Source:      "pdf",
			BankRawID:   &rawID,
			AccountID:   &aid,
			UserID:      &uid,
		})
	}

	// ── Apply app-level tag inference before insert ───────────────────────────
	if s.inferenceSvc != nil {
		params = s.inferenceSvc.AutoTagBatch(ctx, userID, params)
	}

	// ── Insert (dedup-safe via ON CONFLICT transactions_dedup) ────────────────
	imported, dupes, err := txRepo.CreateBatch(ctx, params)
	if err != nil {
		fr.Error = fmt.Sprintf("insert error: %s", err)
		return fr
	}

	fr.Imported = imported
	fr.Duplicates = dupes
	if !parsed.PeriodFrom.IsZero() {
		fr.PeriodFrom = &parsed.PeriodFrom
	}
	if !parsed.PeriodTo.IsZero() {
		fr.PeriodTo = &parsed.PeriodTo
	}
	return fr
}

// parsePDF dispatches to the bank-specific parser.
func parsePDF(bankID string, data []byte) (pdfparser.ParseResult, error) {
	switch bankID {
	case domain.BankSantander:
		return pdfparser.ParseSantander(data)
	case domain.BankBancoDeChile:
		return pdfparser.ParseBancoChile(data)
	default:
		return pdfparser.ParseResult{}, fmt.Errorf("no PDF parser for bank %q", bankID)
	}
}
