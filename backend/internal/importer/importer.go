package importer

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"time"

	"arasaka/internal/domain"
	"arasaka/internal/repository"
)

// MovimientoRecord mirrors one entry in the fintself JSON output.
type MovimientoRecord struct {
	Date            string  `json:"date"`
	Description     string  `json:"description"`
	Amount          string  `json:"amount"`
	Currency        string  `json:"currency"`
	TransactionType string  `json:"transaction_type"`
	AccountID       string  `json:"account_id"`
	AccountType     string  `json:"account_type"`
	RawData         RawData `json:"raw_data"`
}

type RawData struct {
	DateStr        string `json:"date_str"`
	CargoStr       string `json:"cargo_str"`
	AbonoStr       string `json:"abono_str"`
	FullAccountID  string `json:"full_account_id"`
	PageNumber     *int   `json:"page_number"`
	RowIndex       int    `json:"row_index"`
	TipoMovimiento string `json:"tipo_movimiento"`
	Cuotas         string `json:"cuotas"`
	PagoStr        string `json:"pago_str"`
	SectionType    string `json:"section_type"`
	CurrencyType   string `json:"currency_type"`
}

// Result summarises one import run.
type Result struct {
	BankImported   int                 `json:"bank_imported"`
	BankDuplicates int                 `json:"bank_duplicates"`
	CCStatements   []CCStatementResult `json:"cc_statements"`
}

type CCStatementResult struct {
	AccountID       string `json:"account_id"`
	StatementID     int64  `json:"statement_id"`
	ItemsImported   int    `json:"items_imported"`
	ItemsDuplicates int    `json:"items_duplicates"`
}

// Run processes records, routing corriente → transactions, credito → CC tables.
// fromDate is the exclusive lower bound; zero value means import everything.
// Records are iterated in reverse so that JSON-newest-first ordering yields
// oldest records getting the lowest DB IDs.
func Run(ctx context.Context, db *sql.DB, records []MovimientoRecord, fromDate time.Time) (Result, error) {
	txRepo := repository.NewTransactionRepository(db)
	ccRepo := repository.NewCreditCardRepository(db)

	var bankParams []domain.CreateTransactionParams
	ccByAccount := map[string][]MovimientoRecord{}

	for i := len(records) - 1; i >= 0; i-- {
		r := records[i]
		if !fromDate.IsZero() {
			d, _ := ParseDate(r.Date)
			if !d.After(fromDate) {
				continue
			}
		}
		if r.AccountType == "corriente" {
			p, err := mapBankRecord(r)
			if err != nil {
				fmt.Fprintf(os.Stderr, "skip bank record %q: %v\n", r.Description, err)
				continue
			}
			bankParams = append(bankParams, p)
		} else if r.AccountType == "credito" {
			ccByAccount[r.AccountID] = append(ccByAccount[r.AccountID], r)
		}
	}

	var result Result

	if len(bankParams) > 0 {
		imported, dupes, err := txRepo.CreateBatch(ctx, bankParams)
		if err != nil {
			return result, fmt.Errorf("insert bank transactions: %w", err)
		}
		result.BankImported = imported
		result.BankDuplicates = dupes
		// After inserting bank transactions, link any that match existing CC statements.
		if err := LinkAllStatements(ctx, db); err != nil {
			fmt.Fprintf(os.Stderr, "warn: link all statements: %v\n", err)
		}
	}

	for accountID, items := range ccByAccount {
		stmt, itemsImported, itemsDupes, err := importCCStatement(ctx, ccRepo, accountID, items)
		if err != nil {
			fmt.Fprintf(os.Stderr, "import cc statement %q: %v\n", accountID, err)
			continue
		}
		if err := LinkBankPayment(ctx, db, stmt); err != nil {
			fmt.Fprintf(os.Stderr, "warn: link bank payment: %v\n", err)
		}
		result.CCStatements = append(result.CCStatements, CCStatementResult{
			AccountID:       accountID,
			StatementID:     stmt.ID,
			ItemsImported:   itemsImported,
			ItemsDuplicates: itemsDupes,
		})
	}

	return result, nil
}

func mapBankRecord(r MovimientoRecord) (domain.CreateTransactionParams, error) {
	date, err := ParseDate(r.Date)
	if err != nil {
		return domain.CreateTransactionParams{}, fmt.Errorf("parse date: %w", err)
	}

	amount, err := parseAbsAmountCLP(r.Amount)
	if err != nil {
		return domain.CreateTransactionParams{}, err
	}

	flow := "EXPENSE"
	if r.TransactionType == "Abono" {
		flow = "INCOME"
	}

	rawID := bankRawID(r)

	return domain.CreateTransactionParams{
		Date:        date,
		Description: r.Description,
		Category:    "NAN",
		Flow:        flow,
		Amount:      amount,
		Currency:    "CLP",
		Source:      "bank_json",
		BankRawID:   &rawID,
	}, nil
}

func importCCStatement(ctx context.Context, ccRepo domain.CreditCardRepository, accountID string, records []MovimientoRecord) (domain.CreditCardStatement, int, int, error) {
	currency := "CLP"
	if len(records) > 0 && records[0].Currency == "USD" {
		currency = "USD"
	}

	periodFrom, periodTo, err := dateBounds(records)
	if err != nil {
		return domain.CreditCardStatement{}, 0, 0, err
	}

	total, err := computeCCTotal(records, currency)
	if err != nil {
		return domain.CreditCardStatement{}, 0, 0, err
	}

	stmt, err := ccRepo.UpsertStatement(ctx, domain.CreateCCStatementParams{
		AccountID:   accountID,
		PeriodFrom:  periodFrom,
		PeriodTo:    periodTo,
		Currency:    currency,
		TotalAmount: total,
	})
	if err != nil {
		return domain.CreditCardStatement{}, 0, 0, fmt.Errorf("upsert statement: %w", err)
	}

	var itemParams []domain.CreateCCItemParams
	for _, r := range records {
		item, err := mapCCItem(r, stmt.ID, currency)
		if err != nil {
			fmt.Fprintf(os.Stderr, "  skip cc item %q: %v\n", r.Description, err)
			continue
		}
		itemParams = append(itemParams, item)
	}

	imported, dupes, err := ccRepo.CreateItemsBatch(ctx, itemParams)
	if err != nil {
		return stmt, 0, 0, fmt.Errorf("batch items: %w", err)
	}

	return stmt, imported, dupes, nil
}

func mapCCItem(r MovimientoRecord, statementID int64, currency string) (domain.CreateCCItemParams, error) {
	date, err := ParseDate(r.Date)
	if err != nil {
		return domain.CreateCCItemParams{}, fmt.Errorf("parse date: %w", err)
	}

	var amount int64
	if currency == "USD" {
		amount, err = parseAbsAmountUSD(r.Amount)
	} else {
		amount, err = parseAbsAmountCLP(r.Amount)
	}
	if err != nil {
		return domain.CreateCCItemParams{}, err
	}

	cur, tot := parseInstallments(r.RawData.Cuotas)
	rawID := ccRawID(r)

	return domain.CreateCCItemParams{
		StatementID:        statementID,
		Date:               date,
		Description:        r.Description,
		Amount:             amount,
		Currency:           currency,
		InstallmentCurrent: cur,
		InstallmentTotal:   tot,
		ItemType:           mapCCItemType(r.TransactionType),
		BankRawID:          &rawID,
	}, nil
}

// LinkBankPayment links a CLP bank transaction to its CC statement by matching
// the exact total amount and a payment description pattern.
func LinkBankPayment(ctx context.Context, db *sql.DB, stmt domain.CreditCardStatement) error {
	if stmt.Currency != "CLP" || stmt.TotalAmount == 0 {
		return nil
	}
	res, err := db.ExecContext(ctx, `
		UPDATE transactions
		SET cc_statement_id = $1
		WHERE cc_statement_id IS NULL
		  AND source = 'bank_json'
		  AND amount = $2
		  AND description ILIKE '%Cargo Por Pago Tc%'
	`, stmt.ID, stmt.TotalAmount)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n > 0 {
		fmt.Printf("  linked %d bank payment(s) to statement %d\n", n, stmt.ID)
	}
	return nil
}

// LinkAllStatements bulk-links all unlinked bank transactions against every
// existing CC statement. Safe to call repeatedly (WHERE cc_statement_id IS NULL).
func LinkAllStatements(ctx context.Context, db *sql.DB) error {
	// National: match by exact CLP amount.
	_, err := db.ExecContext(ctx, `
		UPDATE transactions t
		SET cc_statement_id = cs.id
		FROM credit_card_statements cs
		WHERE t.cc_statement_id IS NULL
		  AND t.source = 'bank_json'
		  AND cs.currency = 'CLP'
		  AND t.amount = cs.total_amount
		  AND t.description ILIKE '%Cargo Por Pago Tc%'
	`)
	if err != nil {
		return fmt.Errorf("link national: %w", err)
	}
	// International: match by due-date window (amount differs due to FX conversion).
	_, err = db.ExecContext(ctx, `
		UPDATE transactions t
		SET cc_statement_id = cs.id
		FROM credit_card_statements cs
		WHERE t.cc_statement_id IS NULL
		  AND t.source = 'bank_json'
		  AND cs.currency = 'USD'
		  AND cs.due_date IS NOT NULL
		  AND t.date BETWEEN cs.due_date - INTERVAL '7 days' AND cs.due_date + INTERVAL '3 days'
		  AND t.description ILIKE '%Cargo Por Pago Tc%'
	`)
	return err
}

// LinkInternationalPayment links a USD CC statement to a bank transaction by
// date proximity to the due date, since amount matching is impossible across currencies.
func LinkInternationalPayment(ctx context.Context, db *sql.DB, stmt domain.CreditCardStatement) error {
	if stmt.Currency != "USD" || stmt.DueDate == nil {
		return nil
	}
	from := stmt.DueDate.AddDate(0, 0, -7)
	to := stmt.DueDate.AddDate(0, 0, 3)
	res, err := db.ExecContext(ctx, `
		UPDATE transactions
		SET cc_statement_id = $1
		WHERE cc_statement_id IS NULL
		  AND source = 'bank_json'
		  AND date BETWEEN $2 AND $3
		  AND description ILIKE '%Cargo Por Pago Tc%'
	`, stmt.ID, from, to)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n > 0 {
		fmt.Printf("  linked %d intl bank payment(s) to statement %d\n", n, stmt.ID)
	}
	return nil
}

// ParseDate handles both RFC3339 ("2026-04-13T00:00:00Z") and the no-timezone
// variant produced by fintself ("2026-04-13T00:00:00").
func ParseDate(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02T15:04:05", s)
}

func parseAbsAmountCLP(s string) (int64, error) {
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0, fmt.Errorf("parse clp amount %q: %w", s, err)
	}
	if f < 0 {
		f = -f
	}
	return int64(f), nil
}

func parseAbsAmountUSD(s string) (int64, error) {
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0, fmt.Errorf("parse usd amount %q: %w", s, err)
	}
	if f < 0 {
		f = -f
	}
	return int64(math.Round(f * 100)), nil
}

func dateBounds(records []MovimientoRecord) (from, to time.Time, err error) {
	for _, r := range records {
		d, e := ParseDate(r.Date)
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

func computeCCTotal(records []MovimientoRecord, currency string) (int64, error) {
	var total int64
	for _, r := range records {
		if r.TransactionType == "Credit Card - Payment" {
			continue
		}
		var amt int64
		var err error
		if currency == "USD" {
			amt, err = parseAbsAmountUSD(r.Amount)
		} else {
			amt, err = parseAbsAmountCLP(r.Amount)
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

func bankRawID(r MovimientoRecord) string {
	key := fmt.Sprintf("bj|%s|%s|%s|%s",
		r.AccountID, r.RawData.DateStr, r.Amount, r.Description)
	h := sha256.Sum256([]byte(key))
	return fmt.Sprintf("bj_%x", h[:8])
}

func ccRawID(r MovimientoRecord) string {
	key := fmt.Sprintf("cc|%s|%s|%s|%s",
		r.AccountID, r.RawData.DateStr, r.Amount, r.Description)
	h := sha256.Sum256([]byte(key))
	return fmt.Sprintf("cc_%x", h[:8])
}
