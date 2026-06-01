package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"arasaka/internal/crypto"
	"arasaka/internal/domain"
	"arasaka/internal/pdfparser"
	"arasaka/internal/util"
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
	DocType    pdfparser.PDFDocType `json:"doc_type,omitempty"`
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
	accounts     domain.AccountRepository
	transactions domain.TransactionRepository
	inferenceSvc *TagInferenceService
	ccRepo       domain.CreditCardRepository
	masterKey    []byte
}

// NewImportService creates a new ImportService.
func NewImportService(accounts domain.AccountRepository, transactions domain.TransactionRepository, inferenceSvc *TagInferenceService, ccRepo domain.CreditCardRepository, masterKey []byte) *ImportService {
	return &ImportService{
		accounts:     accounts,
		transactions: transactions,
		inferenceSvc: inferenceSvc,
		ccRepo:       ccRepo,
		masterKey:    masterKey,
	}
}

// ImportPDFs validates ownership and bank support once, then processes each PDF
// file independently. A failure on one file does not abort the rest.
func (s *ImportService) ImportPDFs(ctx context.Context, userID, accountID int64, files []NamedPDF) (BatchResult, error) {
	acct, err := s.accounts.GetByID(ctx, accountID, userID)
	if err != nil {
		return BatchResult{}, fmt.Errorf("forbidden")
	}

	if !supportedPDFBanks[acct.BankID] {
		return BatchResult{}, fmt.Errorf("bank %q does not support PDF import", acct.BankID)
	}

	result := BatchResult{AccountID: accountID, BankID: acct.BankID}
	for _, f := range files {
		fr := s.importOne(ctx, userID, accountID, acct.BankID, acct.Settings, f)
		result.Files = append(result.Files, fr)
		result.TotalImported += fr.Imported
		result.TotalDuplicates += fr.Duplicates
	}

	return result, nil
}

// importOne dispatches to the bank-specific import path based on bank ID and PDF content.
func (s *ImportService) importOne(
	ctx context.Context,
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
		case pdfparser.DocTypeCreditCard:
			fr := s.importOneCC(ctx, userID, accountID, decoded)
			fr.DocType = pdfparser.DocTypeCreditCard
			return fr
		case pdfparser.DocTypeDebitMonthly:
			fr := s.importOneDebit(ctx, userID, accountID, bankID, accountSettings, decoded, pdfparser.ParseBancoChile)
			fr.DocType = docType
			return fr
		case pdfparser.DocTypeDebitPartial:
			fr := s.importOneDebit(ctx, userID, accountID, bankID, accountSettings, decoded, pdfparser.ParseBancoChilePartial)
			fr.DocType = docType
			return fr
		default:
			return FileResult{Filename: f.Filename, Error: "unrecognized Banco de Chile PDF format"}
		}
	case domain.BankSantander:
		fr := s.importOneDebit(ctx, userID, accountID, bankID, accountSettings, f, pdfparser.ParseSantander)
		fr.DocType = pdfparser.DocTypeDebit
		return fr
	default:
		return FileResult{Filename: f.Filename, Error: fmt.Sprintf("no PDF parser for bank %q", bankID)}
	}
}

// importOneDebit parses a debit cartola PDF, standardizes rows to BankRecord,
// applies cross-source dedup against existing bank_json records, then runs the
// shared processDebitBatch pipeline (normalize + insert).
func (s *ImportService) importOneDebit(
	ctx context.Context,
	userID, accountID int64,
	bankID domain.BankID,
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

	// Step 1: standardize to BankRecord — canonical intermediate format.
	externalID := fmt.Sprintf("pdf_%d", accountID)
	bankRecords := PDFRowsToBankRecords(parsed.Rows, externalID)

	// Step 2: cross-source dedup — skip rows already imported via bank_json.
	// bank_json candidates in DB have cleaned descriptions, so compare on cleaned form.
	var minDate, maxDate time.Time
	for _, r := range bankRecords {
		d, _ := util.ParseDate(r.Date)
		if minDate.IsZero() || d.Before(minDate) {
			minDate = d
		}
		if maxDate.IsZero() || d.After(maxDate) {
			maxDate = d
		}
	}
	candidates, err := s.transactions.DedupCandidates(ctx, accountID, minDate, maxDate)
	if err != nil {
		fr.Error = fmt.Sprintf("cross-source dedup check: %s", err)
		return fr
	}

	preDupes := 0
	var filtered []BankRecord
	for _, r := range bankRecords {
		date, _ := util.ParseDate(r.Date)
		amount, _ := util.ParseAbsAmountCLP(r.Amount)
		flow := "EXPENSE"
		if r.TransactionType == "Abono" {
			flow = "INCOME"
		}
		cleanDesc := util.CleanDescription(bankID, r.Description)
		if matchesBankJSON(date, amount, flow, cleanDesc, candidates) {
			preDupes++
			continue
		}
		filtered = append(filtered, r)
	}

	// Step 3: shared pipeline — normalize (clean desc + tags) + insert.
	// fromDate is zero: PDFs are already date-bounded by their content.
	imported, dupes, err := processDebitBatch(ctx, s.transactions, s.inferenceSvc, nil,
		userID, accountID, accountSettings, bankID, filtered, time.Time{})
	if err != nil {
		fr.Error = fmt.Sprintf("insert error: %s", err)
		return fr
	}

	fr.Imported = imported
	fr.Duplicates = dupes + preDupes
	if !parsed.PeriodFrom.IsZero() {
		fr.PeriodFrom = &parsed.PeriodFrom
	}
	if !parsed.PeriodTo.IsZero() {
		fr.PeriodTo = &parsed.PeriodTo
	}
	return fr
}

// matchesBankJSON returns true if any candidate matches the given (date, amount, flow).
//
// bank_json candidates: allows up to 2-day date offset (transfers initiated on the PDF
// transaction date may post 1–2 business days later in the bank API). No description
// check — descriptions differ structurally between fintself API output and PDF text.
//
// pdf candidates: requires exact date + description substring match to avoid false positives
// when two distinct transactions share the same day and amount.
func matchesBankJSON(date time.Time, amount int64, flow, description string, candidates []domain.DedupCandidate) bool {
	nd := normalizeDesc(description)
	for _, c := range candidates {
		if c.Amount != amount || c.Flow != flow {
			continue
		}
		if c.Source == "bank_json" {
			diff := c.Date.Sub(date)
			if diff < 0 {
				diff = -diff
			}
			if diff <= 2*24*time.Hour {
				return true
			}
			continue
		}
		if !c.Date.Equal(date) {
			continue
		}
		nc := normalizeDesc(c.Description)
		if len(nd) < 6 || len(nc) < 6 {
			continue
		}
		if strings.Contains(nd, nc) || strings.Contains(nc, nd) {
			return true
		}
	}
	return false
}

// normalizeDesc strips non-alphanumeric characters and uppercases for comparison.
func normalizeDesc(s string) string {
	var b strings.Builder
	for _, r := range strings.ToUpper(s) {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
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

	for _, section := range []*pdfparser.CCBillData{result.National, result.International} {
		if section == nil || section.PeriodFrom.IsZero() {
			continue
		}

		bill, err := s.ccRepo.UpsertBill(ctx, domain.CreateCCBillParams{
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
			fr.Error = fmt.Sprintf("upsert bill %s: %s", section.ExternalAccountID, err)
			return fr
		}

		var itemParams []domain.CreateCCItemParams
		for _, it := range section.Items {
			itemParams = append(itemParams, domain.CreateCCItemParams{
				BillID:             bill.ID,
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
