package service

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"arasaka/internal/crypto"
	"arasaka/internal/domain"
	"arasaka/internal/importer"
	"arasaka/internal/pdfparser"
	"arasaka/internal/repository"
)

// supportedPDFBanks lists the bank_id values that have PDF parsers implemented.
var supportedPDFBanks = map[domain.BankID]bool{
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
	AccountID       int64         `json:"account_id"`
	BankID          domain.BankID `json:"bank_id"`
	Files           []FileResult  `json:"files"`
	TotalImported   int           `json:"total_imported"`
	TotalDuplicates int           `json:"total_duplicates"`
}

// ImportService handles PDF cartola imports.
type ImportService struct {
	db           *sql.DB
	inferenceSvc *TagInferenceService
	ccRepo       domain.CreditCardRepository
	masterKey    []byte
}

// NewImportService creates a new ImportService.
func NewImportService(db *sql.DB, inferenceSvc *TagInferenceService, ccRepo domain.CreditCardRepository, masterKey []byte) *ImportService {
	return &ImportService{db: db, inferenceSvc: inferenceSvc, ccRepo: ccRepo, masterKey: masterKey}
}

// ImportPDFs validates ownership and bank support once, then processes each PDF
// file independently. A failure on one file does not abort the rest.
func (s *ImportService) ImportPDFs(ctx context.Context, userID, accountID int64, files []NamedPDF) (BatchResult, error) {
	// ── Ownership check (user-scoped) ─────────────────────────────────────────
	var bankID domain.BankID
	var dbUserID sql.NullInt64
	var accountSettings domain.AccountSettings
	row := s.db.QueryRowContext(ctx,
		`SELECT bank_id, user_id, settings FROM accounts WHERE id = $1`, accountID)
	if err := row.Scan(&bankID, &dbUserID, &accountSettings); err == sql.ErrNoRows {
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
		fr := s.importOne(ctx, txRepo, userID, accountID, bankID, accountSettings, f)
		result.Files = append(result.Files, fr)
		result.TotalImported += fr.Imported
		result.TotalDuplicates += fr.Duplicates
	}

	return result, nil
}

// importOne dispatches to the bank-specific import path based on bank ID and PDF content.
func (s *ImportService) importOne(
	ctx context.Context,
	txRepo domain.TransactionRepository,
	userID, accountID int64,
	bankID domain.BankID,
	accountSettings domain.AccountSettings,
	f NamedPDF,
) FileResult {
	switch bankID {
	case domain.BankBancoDeChile:
		docType, encrypted, err := pdfparser.DetectBancoChilePDF(f.Data)
		if err != nil {
			return FileResult{Filename: f.Filename, Error: fmt.Sprintf("detect pdf: %s", err)}
		}
		data := f.Data
		if encrypted {
			plain, err := s.decryptAccountPDF(accountSettings)
			if err != nil {
				return FileResult{Filename: f.Filename, Error: err.Error()}
			}
			data, err = decryptPDF(f.Data, plain)
			if err != nil {
				return FileResult{Filename: f.Filename, Error: fmt.Sprintf("decrypt pdf: %s", err)}
			}
			docType, _, err = pdfparser.DetectBancoChilePDF(data)
			if err != nil {
				return FileResult{Filename: f.Filename, Error: fmt.Sprintf("detect decrypted pdf: %s", err)}
			}
		}
		decoded := NamedPDF{Filename: f.Filename, Data: data}
		switch docType {
		case "credit_card":
			return s.importOneCC(ctx, userID, accountID, decoded)
		case "debit":
			return s.importOneDebit(ctx, txRepo, userID, accountID, accountSettings, decoded, pdfparser.ParseBancoChile)
		default:
			return FileResult{Filename: f.Filename, Error: "unrecognized Banco de Chile PDF format"}
		}
	case domain.BankSantander:
		return s.importOneDebit(ctx, txRepo, userID, accountID, accountSettings, f, pdfparser.ParseSantander)
	default:
		return FileResult{Filename: f.Filename, Error: fmt.Sprintf("no PDF parser for bank %q", bankID)}
	}
}

// importOneDebit parses a debit cartola PDF and inserts the resulting transactions.
func (s *ImportService) importOneDebit(
	ctx context.Context,
	txRepo domain.TransactionRepository,
	userID, accountID int64,
	accountSettings domain.AccountSettings,
	f NamedPDF,
	parseFn func([]byte) (pdfparser.ParseResult, error),
) FileResult {
	fr := FileResult{Filename: f.Filename}

	parsed, err := parseFn(f.Data)
	if err != nil {
		fr.Error = fmt.Sprintf("parse error: %s", err)
		return fr
	}
	if len(parsed.Rows) == 0 {
		fr.Error = "no transactions found in PDF"
		return fr
	}

	var params []domain.CreateTransactionParams
	for _, row := range parsed.Rows {
		rawID := importer.PDFRawID(accountID, row.Date, row.Amount, row.Description)
		uid := userID
		aid := accountID
		params = append(params, domain.CreateTransactionParams{
			Date:        row.Date,
			Description: row.Description,
			Flow:        row.Flow,
			Amount:      row.Amount,
			Currency:    "CLP",
			Source:      "pdf",
			BankRawID:   &rawID,
			AccountID:   &aid,
			UserID:      &uid,
		})
	}

	if s.inferenceSvc != nil {
		params = s.inferenceSvc.AutoTagBatch(ctx, userID, accountSettings, params)
	}

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

// decryptAccountPDF retrieves and decrypts the PDF password stored in account settings.
// Returns an error if no password is configured or decryption fails.
func (s *ImportService) decryptAccountPDF(settings domain.AccountSettings) (string, error) {
	if settings.PDFPassword == "" {
		return "", fmt.Errorf("PDF is encrypted: no password configured for this account")
	}
	plain, err := crypto.Decrypt(settings.PDFPassword, s.masterKey)
	if err != nil {
		return "", fmt.Errorf("decrypt stored password: %w", err)
	}
	return plain, nil
}

// importOneCC parses a Banco de Chile credit card statement PDF and persists
// the resulting CC statements and line items.
func (s *ImportService) importOneCC(ctx context.Context, userID, accountID int64, f NamedPDF) FileResult {
	fr := FileResult{Filename: f.Filename}

	result, err := pdfparser.ParseCCBancoChile(f.Data)
	if err != nil {
		fr.Error = fmt.Sprintf("parse error: %s", err)
		return fr
	}

	aid := accountID
	uid := userID

	for _, section := range []*pdfparser.CCStatementData{result.National, result.International} {
		if section == nil || section.PeriodFrom.IsZero() {
			continue
		}

		stmt, err := s.ccRepo.UpsertStatement(ctx, domain.CreateCCStatementParams{
			ExternalAccountID: section.ExternalAccountID,
			PeriodFrom:        section.PeriodFrom,
			PeriodTo:          section.PeriodTo,
			DueDate:           section.DueDate,
			Currency:          section.Currency,
			TotalAmount:       section.TotalAmount,
			AccountID:         &aid,
			UserID:            &uid,
		})
		if err != nil {
			fr.Error = fmt.Sprintf("upsert statement %s: %s", section.ExternalAccountID, err)
			return fr
		}

		var itemParams []domain.CreateCCItemParams
		for _, it := range section.Items {
			itemParams = append(itemParams, domain.CreateCCItemParams{
				StatementID:        stmt.ID,
				Date:               it.Date,
				Description:        it.Description,
				Amount:             it.Amount,
				Currency:           it.Currency,
				InstallmentCurrent: it.InstallmentCurrent,
				InstallmentTotal:   it.InstallmentTotal,
				ItemType:           it.ItemType,
				BankRawID:          it.BankRawID,
				AccountID:          &aid,
				UserID:             &uid,
			})
		}

		if len(itemParams) > 0 {
			imp, dup, err := s.ccRepo.CreateItemsBatch(ctx, itemParams)
			if err != nil {
				fr.Error = fmt.Sprintf("create items %s: %s", section.ExternalAccountID, err)
				return fr
			}
			fr.Imported += imp
			fr.Duplicates += dup
		}

		// Use national section period; fall back to international if national absent.
		if fr.PeriodFrom == nil && !section.PeriodFrom.IsZero() {
			fr.PeriodFrom = &section.PeriodFrom
		}
		if fr.PeriodTo == nil && !section.PeriodTo.IsZero() {
			fr.PeriodTo = &section.PeriodTo
		}
	}

	return fr
}
