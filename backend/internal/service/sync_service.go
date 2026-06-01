package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"arasaka/internal/crypto"
	"arasaka/internal/domain"
	"arasaka/internal/util"
)

type SyncService struct {
	accounts     domain.AccountRepository
	transactions domain.TransactionRepository
	creditCards  domain.CreditCardRepository
	masterKey    []byte
	inferenceSvc *TagInferenceService
	logger       *slog.Logger
}

func NewSyncService(accounts domain.AccountRepository, transactions domain.TransactionRepository, creditCards domain.CreditCardRepository, masterKey []byte, inferenceSvc *TagInferenceService, logger *slog.Logger) *SyncService {
	return &SyncService{
		accounts:     accounts,
		transactions: transactions,
		creditCards:  creditCards,
		masterKey:    masterKey,
		inferenceSvc: inferenceSvc,
		logger:       logger,
	}
}

// Sync scrapes movements for a specific account identified by accountID.
// Credentials are read from the account's settings JSONB.
func (s *SyncService) Sync(ctx context.Context, userID int64, accountID int64) (SyncResult, error) {
	if len(s.masterKey) == 0 {
		return SyncResult{}, fmt.Errorf("sync: master_key not configured")
	}

	acct, err := s.accounts.GetByID(ctx, accountID, userID)
	if err != nil {
		return SyncResult{}, fmt.Errorf("account %d not found", accountID)
	}

	if acct.Settings.BankUser == "" || acct.Settings.BankPassword == "" {
		return SyncResult{}, fmt.Errorf("sync: no credentials configured for account %d", accountID)
	}

	user, err := crypto.Decrypt(acct.Settings.BankUser, s.masterKey)
	if err != nil {
		return SyncResult{}, fmt.Errorf("sync: decrypt bank_user: %w", err)
	}
	password, err := crypto.Decrypt(acct.Settings.BankPassword, s.masterKey)
	if err != nil {
		return SyncResult{}, fmt.Errorf("sync: decrypt bank_password: %w", err)
	}

	s.logger.Info("sync started", "user_id", userID, "account_id", accountID, "bank_id", acct.BankID)
	result, err := s.syncBank(ctx, userID, acct, user, password)
	if err != nil {
		s.logger.Error("sync failed", "bank", acct.BankID, "err", err)
		return SyncResult{}, fmt.Errorf("%s: %w", acct.BankID, err)
	}

	s.logger.Info("sync complete",
		"user_id", userID,
		"bank_imported", result.BankImported,
		"bank_duplicates", result.BankDuplicates,
		"cc_bills", len(result.CCBills),
	)
	return result, nil
}

// syncBank runs the full pipeline for one account:
// fintself scrape → filter → parse/normalize+RawID → tags → insert (dedup) → link receipts.
// Both debit (corriente) and credit card (credito) records follow the same shape;
// credit card records are additionally grouped by CC account and upserted as bills+items.
func (s *SyncService) syncBank(ctx context.Context, userID int64, acct domain.Account, bankUser, bankPassword string) (SyncResult, error) {
	bankID := acct.BankID
	accountID := acct.ID
	settings := acct.Settings
	tmpFile, err := os.CreateTemp("", "fintself-*.json")
	if err != nil {
		return SyncResult{}, fmt.Errorf("create temp file: %w", err)
	}
	tmpFile.Close()
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	cmdCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	// Run fintself in headed mode — Auth0 blocks headless Chrome.
	fintID := bankID.FintID()
	prefix := strings.ToUpper(strings.ReplaceAll(fintID, "-", "_"))
	cmd := exec.CommandContext(cmdCtx, "fintself", "scrape", fintID, "--output-file", tmpPath)
	cmd.Env = append(os.Environ(),
		prefix+"_USER="+bankUser,
		prefix+"_PASSWORD="+bankPassword,
	)
	s.logger.Info("fintself invoked", "bank", bankID)
	fintStart := time.Now()
	out, err := cmd.CombinedOutput()
	elapsed := time.Since(fintStart).Round(time.Second)
	s.logger.Debug("fintself output", "bank", bankID, "elapsed", elapsed, "output", string(out))
	if err != nil {
		return SyncResult{}, fmt.Errorf("fintself failed: %w\n%s", err, out)
	}
	s.logger.Info("fintself done", "bank", bankID, "elapsed", elapsed)

	data, err := os.ReadFile(tmpPath)
	if err != nil {
		return SyncResult{}, fmt.Errorf("read fintself output: %w", err)
	}

	var all []BankRecord
	if err := json.Unmarshal(data, &all); err != nil {
		return SyncResult{}, fmt.Errorf("parse fintself output: %w", err)
	}

	// Scope fromDate to this account so that a newer account doesn't block an older one.
	var fromDate time.Time
	if t, ok, err := s.transactions.LatestBankDate(ctx, accountID); err == nil && ok {
		fromDate = t
	}

	var result SyncResult

	imported, dupes, err := s.importTransactions(ctx, userID, accountID, settings, bankID, all, fromDate)
	if err != nil {
		return result, err
	}
	result.BankImported = imported
	result.BankDuplicates = dupes

	result.CCBills = s.importCCBills(ctx, userID, all, fromDate, bankID)

	// Link transactions to CC bills now that both debit txns and bills are in DB.
	if linkErr := s.creditCards.LinkAllBills(ctx, userID, accountID, bankID); linkErr != nil {
		s.logger.Warn("link all bills failed", "err", linkErr)
	}

	return result, nil
}

// importTransactions delegates to the shared processDebitBatch pipeline.
func (s *SyncService) importTransactions(
	ctx context.Context,
	userID int64,
	accountID int64,
	settings domain.AccountSettings,
	bankID domain.BankID,
	records []BankRecord,
	fromDate time.Time,
) (imported, duplicates int, err error) {
	return processDebitBatch(ctx, s.transactions, s.inferenceSvc, s.logger, userID, accountID, settings, bankID, records, fromDate)
}

// processDebitBatch is the shared debit transaction pipeline used by both the
// bank_json (fintself) and PDF import paths:
// filter → parse+RawID → normalizeTransactionBatch → insert (dedup).
func processDebitBatch(
	ctx context.Context,
	txRepo domain.TransactionRepository,
	inferenceSvc *TagInferenceService,
	logger *slog.Logger,
	userID int64,
	accountID int64,
	settings domain.AccountSettings,
	bankID domain.BankID,
	records []BankRecord,
	fromDate time.Time,
) (imported, duplicates int, err error) {
	// 1. Filter: date bound + account_type = corriente, oldest-first.
	var transactions []domain.CreateTransactionParams
	seen := map[string]int{}
	for i := len(records) - 1; i >= 0; i-- {
		r := records[i]
		if r.AccountType != accountTypeChecking {
			continue
		}
		if !fromDate.IsZero() {
			d, _ := util.ParseDate(r.Date)
			if d.Before(fromDate) {
				continue
			}
		}

		// 2. Parse + RawID (source-aware: PDFRawID for pdf, BankRawID for bank_json).
		dupKey := r.RawData.DateStr + "|" + r.Amount + "|" + r.Description
		occurrence := seen[dupKey]
		seen[dupKey]++
		p, mapErr := mapBankRecord(r, &accountID, &userID, bankID, occurrence)
		if mapErr != nil {
			if logger != nil {
				logger.Warn("skip bank record", "description", r.Description, "err", mapErr)
			}
			continue
		}
		transactions = append(transactions, p)
	}

	if len(transactions) == 0 {
		return 0, 0, nil
	}

	// 3. Normalize: clean descriptions + auto-tag.
	transactions = normalizeTransactionBatch(ctx, userID, bankID, settings, transactions, inferenceSvc)

	// 4. Insert with dedup (ON CONFLICT DO NOTHING via bank_raw_id).
	imported, duplicates, err = txRepo.CreateBatch(ctx, transactions)
	if err != nil {
		return 0, 0, fmt.Errorf("insert bank transactions: %w", err)
	}

	return imported, duplicates, nil
}

// importCCBills runs the credit card pipeline:
// filter → group by CC account → per-account: normalize+upsert bill → parse/normalize+RawID items → insert (dedup) → link payment.
// Per-account failures are logged and skipped.
func (s *SyncService) importCCBills(ctx context.Context, userID int64, records []BankRecord, fromDate time.Time, bankID domain.BankID) []CCSyncResult {
	// 1. Filter: date bound + account_type = credito, group by fintself account ID.
	ccByAccount := map[string][]BankRecord{}

	for i := len(records) - 1; i >= 0; i-- {
		r := records[i]
		if r.AccountType != accountTypeCredit {
			continue
		}
		if !fromDate.IsZero() {
			d, _ := util.ParseDate(r.Date)
			if d.Before(fromDate) {
				continue
			}
		}
		ccByAccount[r.AccountID] = append(ccByAccount[r.AccountID], r)
	}

	var results []CCSyncResult
	for accountID, items := range ccByAccount {
		bill, imp, dupes, err := importCCBill(ctx, s.creditCards, userID, accountID, items, bankID, s.logger)
		if err != nil {
			s.logger.Warn("import cc bill failed", "account_id", accountID, "err", err)
			continue
		}
		results = append(results, CCSyncResult{
			AccountID:       accountID,
			BillID:          bill.ID,
			ItemsImported:   imp,
			ItemsDuplicates: dupes,
		})
	}
	return results
}


func mergeSyncResults(a, b SyncResult) SyncResult {
	return SyncResult{
		BankImported:   a.BankImported + b.BankImported,
		BankDuplicates: a.BankDuplicates + b.BankDuplicates,
		CCBills:        append(a.CCBills, b.CCBills...),
	}
}

// ── Bank record mapping ──────────────────────────────────────────────────────

// mapBankRecord converts a BankRecord into CreateTransactionParams.
// RawID is source-aware: PDFRawID (pdf_…) for pdf, BankRawID (bj_…) for bank_json.
// Description is stored raw; normalizeTransactionBatch cleans it later.
func mapBankRecord(r BankRecord, accountID *int64, userID *int64, bankID domain.BankID, occurrence int) (domain.CreateTransactionParams, error) {
	date, err := util.ParseDate(r.Date)
	if err != nil {
		return domain.CreateTransactionParams{}, fmt.Errorf("parse date: %w", err)
	}

	amount, err := util.ParseAbsAmountCLP(r.Amount)
	if err != nil {
		return domain.CreateTransactionParams{}, err
	}

	flow := "EXPENSE"
	if r.TransactionType == "Abono" {
		flow = "INCOME"
	}

	// RawID uses the original description so dedup works even after description cleaning.
	var rawID string
	source := "bank_json"
	if r.Source == "pdf" {
		rawID = util.PDFRawID(*accountID, date, amount, r.Description)
		source = "pdf"
	} else {
		rawID = util.BankRawID(r.AccountID, r.RawData.DateStr, r.Amount, r.Description, occurrence)
	}

	return domain.CreateTransactionParams{
		Date:        date,
		Description: r.Description,
		Flow:        flow,
		Amount:      amount,
		Currency:    "CLP",
		Source:      source,
		BankRawID:   &rawID,
		AccountID:   accountID,
		UserID:      userID,
	}, nil
}

// ── CC bill + item mapping ───────────────────────────────────────────────────

func importCCBill(ctx context.Context, ccRepo domain.CreditCardRepository, userID int64, accountID string, records []BankRecord, bankID domain.BankID, logger *slog.Logger) (domain.CreditCardBill, int, int, error) {
	// 2. Normalize: compute period bounds + total amount for the bill header.
	currency := "CLP"
	if len(records) > 0 && records[0].Currency == "USD" {
		currency = "USD"
	}

	periodFrom, periodTo, err := dateBounds(records)
	if err != nil {
		return domain.CreditCardBill{}, 0, 0, err
	}

	total, err := computeCCTotal(records, currency)
	if err != nil {
		return domain.CreditCardBill{}, 0, 0, err
	}

	// 3. Upsert bill (dedup on external_account_id + period).
	bill, err := ccRepo.UpsertBill(ctx, domain.CreateCCBillParams{
		ExternalAccountID: accountID,
		PeriodFrom:        periodFrom,
		PeriodTo:          periodTo,
		Currency:          currency,
		TotalAmount:       total,
		UserID:            &userID,
	})
	if err != nil {
		return domain.CreditCardBill{}, 0, 0, fmt.Errorf("upsert bill: %w", err)
	}

	// 4. Parse + normalize + RawID for each line item.
	//    Tags are not applicable — CreateCCItemParams has no Tags field.
	var itemParams []domain.CreateCCItemParams
	seen := map[string]int{}
	for _, r := range records {
		dupKey := r.RawData.DateStr + "|" + r.Amount + "|" + r.Description
		occurrence := seen[dupKey]
		seen[dupKey]++
		item, err := mapCCItem(r, bill.ID, currency, bankID, occurrence)
		if err != nil {
			logger.Warn("skip cc item", "description", r.Description, "err", err)
			continue
		}
		itemParams = append(itemParams, item)
	}

	// 5. Insert items with dedup (ON CONFLICT DO NOTHING via bank_raw_id).
	imported, dupes, err := ccRepo.CreateItemsBatch(ctx, itemParams)
	if err != nil {
		return bill, 0, 0, fmt.Errorf("batch items: %w", err)
	}

	return bill, imported, dupes, nil
}

func mapCCItem(r BankRecord, billID int64, currency string, bankID domain.BankID, occurrence int) (domain.CreateCCItemParams, error) {
	date, err := util.ParseDate(r.Date)
	if err != nil {
		return domain.CreateCCItemParams{}, fmt.Errorf("parse date: %w", err)
	}

	var amount int64
	if currency == "USD" {
		amount, err = util.ParseAbsAmountUSD(r.Amount)
	} else {
		amount, err = util.ParseAbsAmountCLP(r.Amount)
	}
	if err != nil {
		return domain.CreateCCItemParams{}, err
	}

	cur, tot := parseInstallments(r.RawData.Cuotas)
	// RawID uses the original description so dedup works even after description cleaning.
	rawID := util.CCRawID(r.AccountID, r.RawData.DateStr, r.Amount, r.Description, occurrence)

	return domain.CreateCCItemParams{
		BillID:             billID,
		Date:               date,
		Description:        util.CleanDescription(bankID, r.Description),
		Amount:             amount,
		Currency:           currency,
		InstallmentCurrent: cur,
		InstallmentTotal:   tot,
		ItemType:           mapCCItemType(r.TransactionType),
		BankRawID:          &rawID,
	}, nil
}

// ── Parsing helpers ──────────────────────────────────────────────────────────

func dateBounds(records []BankRecord) (from, to time.Time, err error) {
	for _, r := range records {
		d, e := util.ParseDate(r.Date)
		if e != nil {
			return from, to, e
		}
		if from.IsZero() || d.Before(from) {
			from = d
		}
		if to.IsZero() || d.After(to) {
			to = d
		}
	}
	return from, to, nil
}

func computeCCTotal(records []BankRecord, currency string) (int64, error) {
	var total int64
	for _, r := range records {
		if r.TransactionType == "Credit Card - Payment" {
			continue
		}
		var amt int64
		var err error
		if currency == "USD" {
			amt, err = util.ParseAbsAmountUSD(r.Amount)
		} else {
			amt, err = util.ParseAbsAmountCLP(r.Amount)
		}
		if err != nil {
			return 0, err
		}
		total += amt
	}
	return total, nil
}

func parseInstallments(cuotas string) (current *int, total *int) {
	parts := strings.SplitN(cuotas, "/", 2)
	if len(parts) != 2 {
		return nil, nil
	}
	c, err1 := strconv.Atoi(parts[0])
	t, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return nil, nil
	}
	return &c, &t
}

func mapCCItemType(txType string) string {
	switch txType {
	case "Credit Card - Payment":
		return "payment"
	case "Credit Card - Cuotas":
		return "installment"
	case "Credit Card - Cargos, Comisiones, Impuestos y Abonos":
		return "commission"
	default:
		return "purchase"
	}
}
