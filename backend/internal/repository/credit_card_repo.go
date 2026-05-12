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

// UpsertStatement inserts a new statement or returns the existing one for the same
// (external_account_id, period_from, period_to) tuple.
func (r *creditCardRepo) UpsertStatement(ctx context.Context, p domain.CreateCCStatementParams) (domain.CreditCardStatement, error) {
	if p.Currency == "" {
		p.Currency = "CLP"
	}
	var s domain.CreditCardStatement
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO credit_card_statements (external_account_id, period_from, period_to, due_date, currency, total_amount, min_payment, account_id, user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT ON CONSTRAINT cc_statements_dedup
		DO UPDATE SET due_date = EXCLUDED.due_date, total_amount = EXCLUDED.total_amount, min_payment = EXCLUDED.min_payment
		RETURNING id, external_account_id, period_from, period_to, due_date, currency, total_amount, min_payment, account_id, user_id, created_at
	`, p.ExternalAccountID, p.PeriodFrom, p.PeriodTo, p.DueDate, p.Currency, p.TotalAmount, p.MinPayment, p.AccountID, p.UserID,
	).Scan(&s.ID, &s.ExternalAccountID, &s.PeriodFrom, &s.PeriodTo, &s.DueDate, &s.Currency, &s.TotalAmount, &s.MinPayment, &s.AccountID, &s.UserID, &s.CreatedAt)
	return s, err
}

func (r *creditCardRepo) UpdateStatementTotal(ctx context.Context, id int64, total int64) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE credit_card_statements SET total_amount = $1 WHERE id = $2`, total, id)
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
			(statement_id, date, description, amount, currency, installment_current, installment_total, item_type, bank_raw_id, account_id, user_id)
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
			it.StatementID, it.Date, it.Description, it.Amount, it.Currency,
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

func (r *creditCardRepo) ListStatements(ctx context.Context, userID int64) ([]domain.CreditCardStatement, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, external_account_id, period_from, period_to, due_date, currency, total_amount, min_payment, account_id, user_id, created_at
		FROM credit_card_statements
		WHERE user_id = $1
		ORDER BY period_to DESC, external_account_id
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stmts []domain.CreditCardStatement
	for rows.Next() {
		var s domain.CreditCardStatement
		if err := rows.Scan(&s.ID, &s.ExternalAccountID, &s.PeriodFrom, &s.PeriodTo, &s.DueDate, &s.Currency, &s.TotalAmount, &s.MinPayment, &s.AccountID, &s.UserID, &s.CreatedAt); err != nil {
			return nil, err
		}
		stmts = append(stmts, s)
	}
	if stmts == nil {
		stmts = []domain.CreditCardStatement{}
	}
	return stmts, nil
}

func (r *creditCardRepo) GetStatementByID(ctx context.Context, id int64, userID int64) (domain.CreditCardStatement, error) {
	var s domain.CreditCardStatement
	err := r.db.QueryRowContext(ctx, `
		SELECT id, external_account_id, period_from, period_to, due_date, currency, total_amount, min_payment, account_id, user_id, created_at
		FROM credit_card_statements WHERE id = $1 AND user_id = $2
	`, id, userID).Scan(&s.ID, &s.ExternalAccountID, &s.PeriodFrom, &s.PeriodTo, &s.DueDate, &s.Currency, &s.TotalAmount, &s.MinPayment, &s.AccountID, &s.UserID, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return domain.CreditCardStatement{}, fmt.Errorf("not found")
	}
	if err != nil {
		return domain.CreditCardStatement{}, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, statement_id, date, description, amount, currency,
		       installment_current, installment_total, item_type, bank_raw_id, account_id, user_id, created_at
		FROM credit_card_items WHERE statement_id = $1 ORDER BY date, id
	`, id)
	if err != nil {
		return domain.CreditCardStatement{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var it domain.CreditCardItem
		if err := rows.Scan(
			&it.ID, &it.StatementID, &it.Date, &it.Description, &it.Amount, &it.Currency,
			&it.InstallmentCurrent, &it.InstallmentTotal, &it.ItemType, &it.BankRawID,
			&it.AccountID, &it.UserID, &it.CreatedAt,
		); err != nil {
			return domain.CreditCardStatement{}, err
		}
		s.Items = append(s.Items, it)
	}
	return s, nil
}
