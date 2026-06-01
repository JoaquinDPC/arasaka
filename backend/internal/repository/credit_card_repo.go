package repository

import (
	"context"
	"database/sql"
	"fmt"

	"arasaka/internal/domain"
)

type creditCardRepo struct {
	db *sql.DB
}

func NewCreditCardRepository(db *sql.DB) domain.CreditCardRepository {
	return &creditCardRepo{db: db}
}

// UpsertBill inserts a new bill or returns the existing one for the same
// (external_account_id, period_from, period_to) tuple.
func (r *creditCardRepo) UpsertBill(ctx context.Context, p domain.CreateCCBillParams) (domain.CreditCardBill, error) {
	if p.Currency == "" {
		p.Currency = "CLP"
	}
	var s domain.CreditCardBill
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO credit_card_bills (external_account_id, period_from, period_to, due_date, currency, total_amount, min_payment, account_id, user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT ON CONSTRAINT cc_bills_dedup
		DO UPDATE SET due_date = EXCLUDED.due_date, total_amount = EXCLUDED.total_amount, min_payment = EXCLUDED.min_payment
		RETURNING id, external_account_id, period_from, period_to, due_date, currency, total_amount, min_payment, account_id, user_id, created_at
	`, p.ExternalAccountID, p.PeriodFrom, p.PeriodTo, p.DueDate, p.Currency, p.TotalAmount, p.MinPayment, p.AccountID, p.UserID,
	).Scan(&s.ID, &s.ExternalAccountID, &s.PeriodFrom, &s.PeriodTo, &s.DueDate, &s.Currency, &s.TotalAmount, &s.MinPayment, &s.AccountID, &s.UserID, &s.CreatedAt)
	return s, err
}

func (r *creditCardRepo) UpdateBillTotal(ctx context.Context, id int64, userID int64, total int64) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE credit_card_bills SET total_amount = $1 WHERE id = $2 AND user_id = $3`, total, id, userID)
	return err
}

func (r *creditCardRepo) CreateItemsBatch(ctx context.Context, items []domain.CreateCCItemParams) (imported, duplicates int, err error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO credit_card_items
			(bill_id, date, description, amount, currency, installment_current, installment_total, item_type, bank_raw_id, account_id, user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (bank_raw_id) DO NOTHING
	`)
	if err != nil {
		return 0, 0, err
	}
	defer stmt.Close()

	for _, it := range items {
		if it.Currency == "" {
			it.Currency = "CLP"
		}
		res, err := stmt.ExecContext(ctx,
			it.BillID, it.Date, it.Description, it.Amount, it.Currency,
			it.InstallmentCurrent, it.InstallmentTotal, it.ItemType, it.BankRawID,
			it.AccountID, it.UserID,
		)
		if err != nil {
			return 0, 0, fmt.Errorf("inserting cc item: %w", err)
		}
		n, _ := res.RowsAffected()
		if n > 0 {
			imported++
		} else {
			duplicates++
		}
	}

	return imported, duplicates, tx.Commit()
}

func (r *creditCardRepo) ListBills(ctx context.Context, userID int64, accountID int64) ([]domain.CreditCardBill, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, external_account_id, period_from, period_to, due_date, currency, total_amount, min_payment, account_id, user_id, created_at
		FROM credit_card_bills
		WHERE user_id = $1 AND account_id = $2
		ORDER BY period_to DESC, external_account_id
	`, userID, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bills []domain.CreditCardBill
	for rows.Next() {
		var b domain.CreditCardBill
		if err := rows.Scan(&b.ID, &b.ExternalAccountID, &b.PeriodFrom, &b.PeriodTo, &b.DueDate, &b.Currency, &b.TotalAmount, &b.MinPayment, &b.AccountID, &b.UserID, &b.CreatedAt); err != nil {
			return nil, err
		}
		bills = append(bills, b)
	}
	if bills == nil {
		bills = []domain.CreditCardBill{}
	}
	return bills, nil
}

// ccPaymentCLP maps bank_id → SQL description fragment for CLP CC payment detection.
// Only hardcoded constants here — never user input. Add entries as new banks are supported.
var ccPaymentCLP = map[domain.BankID]string{
	domain.BankBancoDeChile: `(
		t.description ILIKE '%Cargo Por Pago Tc%'
		OR t.description ILIKE '%Pago Tarjeta De Credito%'
		OR (t.description ILIKE '%Tarjeta de credito%' AND t.description NOT ILIKE '%internacional%')
	)`,
	// domain.BankSantander: `(...)`,
}

// ccPaymentUSD maps bank_id → SQL description fragment for USD CC payment detection.
var ccPaymentUSD = map[domain.BankID]string{
	domain.BankBancoDeChile: `(
		t.description ILIKE '%Cargo Por Pago Tc%'
		OR t.description ILIKE '%Tarjeta de credito internacional%'
	)`,
	// domain.BankSantander: `(...)`,
}

func (r *creditCardRepo) LinkAllBills(ctx context.Context, userID int64, accountID int64, bankID domain.BankID) error {
	if patternCLP, ok := ccPaymentCLP[bankID]; ok {
		_, err := r.db.ExecContext(ctx, `
			UPDATE transactions t
			SET cc_bill_id = cs.id
			FROM credit_card_bills cs
			WHERE t.cc_bill_id IS NULL
			  AND t.user_id = $1
			  AND t.account_id = $2
			  AND cs.user_id = $1
			  AND cs.currency = 'CLP'
			  AND t.amount = cs.total_amount
			  AND NOT EXISTS (SELECT 1 FROM transactions lnk WHERE lnk.cc_bill_id = cs.id)
			  AND `+patternCLP, userID, accountID)

		if err != nil {
			return fmt.Errorf("link national %s: %w", bankID, err)
		}
	}
	if patternUSD, ok := ccPaymentUSD[bankID]; ok {
		_, err := r.db.ExecContext(ctx, `
			UPDATE transactions t
			SET cc_bill_id = cs.id
			FROM credit_card_bills cs
			WHERE t.cc_bill_id IS NULL
			  AND t.user_id = $1
			  AND t.account_id = $2
			  AND cs.user_id = $1
			  AND cs.currency = 'USD'
			  AND cs.due_date IS NOT NULL
			  AND t.date BETWEEN cs.due_date - INTERVAL '7 days' AND cs.due_date + INTERVAL '3 days'
			  AND `+patternUSD, userID, accountID)
		if err != nil {
			return fmt.Errorf("link intl %s: %w", bankID, err)
		}
	}
	return nil
}

func (r *creditCardRepo) GetBillByID(ctx context.Context, id int64, userID int64) (domain.CreditCardBill, error) {
	var b domain.CreditCardBill
	err := r.db.QueryRowContext(ctx, `
		SELECT id, external_account_id, period_from, period_to, due_date, currency, total_amount, min_payment, account_id, user_id, created_at
		FROM credit_card_bills WHERE id = $1 AND user_id = $2
	`, id, userID).Scan(&b.ID, &b.ExternalAccountID, &b.PeriodFrom, &b.PeriodTo, &b.DueDate, &b.Currency, &b.TotalAmount, &b.MinPayment, &b.AccountID, &b.UserID, &b.CreatedAt)
	if err == sql.ErrNoRows {
		return domain.CreditCardBill{}, fmt.Errorf("not found")
	}
	if err != nil {
		return domain.CreditCardBill{}, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, bill_id, date, description, amount, currency,
		       installment_current, installment_total, item_type, bank_raw_id, account_id, user_id, created_at
		FROM credit_card_items WHERE bill_id = $1 ORDER BY date, id
	`, id)
	if err != nil {
		return domain.CreditCardBill{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var it domain.CreditCardItem
		if err := rows.Scan(
			&it.ID, &it.BillID, &it.Date, &it.Description, &it.Amount, &it.Currency,
			&it.InstallmentCurrent, &it.InstallmentTotal, &it.ItemType, &it.BankRawID,
			&it.AccountID, &it.UserID, &it.CreatedAt,
		); err != nil {
			return domain.CreditCardBill{}, err
		}
		b.Items = append(b.Items, it)
	}
	return b, nil
}
