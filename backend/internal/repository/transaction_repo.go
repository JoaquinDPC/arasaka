package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"arasaka/internal/domain"
	"github.com/lib/pq"
)

type transactionRepo struct {
	db *sql.DB
}

// NewTransactionRepository returns a postgres-backed TransactionRepository.
func NewTransactionRepository(db *sql.DB) domain.TransactionRepository {
	return &transactionRepo{db: db}
}

const txColumns = `id, date, description, category, flow, subtype, asset, key_user, quantity, amount, notes, source, bank_raw_id, currency, cc_statement_id, account_id, tags, created_at, updated_at`

func scanTx(s interface{ Scan(...any) error }, t *domain.Transaction) error {
	return s.Scan(
		&t.ID, &t.Date, &t.Description, &t.Category, &t.Flow,
		&t.Subtype, &t.Asset, &t.KeyUser, &t.Quantity, &t.Amount, &t.Notes,
		&t.Source, &t.BankRawID, &t.Currency, &t.CCStatementID, &t.AccountID,
		pq.Array(&t.Tags),
		&t.CreatedAt, &t.UpdatedAt,
	)
}

// listColumns extends txColumns with the running_balance window function result.
const listColumns = txColumns + `, running_balance`

func scanTxWithBalance(s interface{ Scan(...any) error }, t *domain.Transaction) error {
	return s.Scan(
		&t.ID, &t.Date, &t.Description, &t.Category, &t.Flow,
		&t.Subtype, &t.Asset, &t.KeyUser, &t.Quantity, &t.Amount, &t.Notes,
		&t.Source, &t.BankRawID, &t.Currency, &t.CCStatementID, &t.AccountID,
		pq.Array(&t.Tags),
		&t.CreatedAt, &t.UpdatedAt, &t.RunningBalance,
	)
}

// List returns transactions with a global running_balance computed across ALL
// transactions (not just the filtered subset), matching the Excel "Cash Balance"
// column: OPENING and INCOME add to the balance, EXPENSE subtracts, INVEST is neutral.
func (r *transactionRepo) List(ctx context.Context, f domain.TransactionFilter) ([]domain.Transaction, error) {
	// The CTE computes running_balance over the full transactions table so that
	// filtering by month/category/flow does not distort the balance shown.
	where := "WHERE 1=1"
	var args []any
	n := 1

	if f.Year != "" {
		where += fmt.Sprintf(" AND EXTRACT(YEAR FROM date) = $%d", n)
		args = append(args, f.Year)
		n++
	}
	if f.Month != "" {
		where += fmt.Sprintf(" AND EXTRACT(MONTH FROM date) = $%d", n)
		args = append(args, f.Month)
		n++
	}
	if f.Category != "" {
		where += fmt.Sprintf(" AND category = $%d", n)
		args = append(args, f.Category)
		n++
	}
	if f.Flow != "" {
		where += fmt.Sprintf(" AND flow = $%d", n)
		args = append(args, f.Flow)
		n++
	}
	if f.AccountID != "" {
		where += fmt.Sprintf(" AND account_id = $%d", n)
		args = append(args, f.AccountID)
		n++
	}

	limit := 1000
	if f.Limit > 0 {
		limit = f.Limit
	}

	query := fmt.Sprintf(`
		WITH with_balance AS (
			SELECT `+txColumns+`,
				SUM(
					CASE
						WHEN flow IN ('INCOME', 'OPENING') THEN  amount
						WHEN flow = 'EXPENSE'             THEN -amount
						ELSE 0
					END
				) OVER (ORDER BY date ASC, id ASC) AS running_balance
			FROM transactions
		)
		SELECT `+listColumns+`
		FROM with_balance
		%s
		ORDER BY date DESC, id DESC
		LIMIT %d
	`, where, limit)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []domain.Transaction
	for rows.Next() {
		var t domain.Transaction
		if err := scanTxWithBalance(rows, &t); err != nil {
			return nil, err
		}
		txs = append(txs, t)
	}
	if txs == nil {
		txs = []domain.Transaction{}
	}
	return txs, nil
}

func (r *transactionRepo) Create(ctx context.Context, p domain.CreateTransactionParams) (domain.Transaction, error) {
	if p.Currency == "" {
		p.Currency = "CLP"
	}
	if p.Tags == nil {
		p.Tags = []string{}
	}
	var t domain.Transaction
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO transactions (date, description, category, flow, subtype, asset, key_user, quantity, amount, notes, source, bank_raw_id, currency, account_id, tags)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING `+txColumns,
		p.Date, p.Description, p.Category, p.Flow, p.Subtype,
		p.Asset, p.KeyUser, p.Quantity, p.Amount, p.Notes, p.Source, p.BankRawID, p.Currency,
		p.AccountID, pq.Array(p.Tags),
	).Scan(
		&t.ID, &t.Date, &t.Description, &t.Category, &t.Flow,
		&t.Subtype, &t.Asset, &t.KeyUser, &t.Quantity, &t.Amount, &t.Notes,
		&t.Source, &t.BankRawID, &t.Currency, &t.CCStatementID, &t.AccountID,
		pq.Array(&t.Tags),
		&t.CreatedAt, &t.UpdatedAt,
	)
	return t, err
}

func (r *transactionRepo) Update(ctx context.Context, id int64, p domain.UpdateTransactionParams) (domain.Transaction, error) {
	set := ""
	var args []any
	n := 1
	add := func(col string, val any) {
		if set != "" {
			set += ", "
		}
		set += fmt.Sprintf("%s = $%d", col, n)
		args = append(args, val)
		n++
	}

	if p.Date != nil {
		add("date", *p.Date)
	}
	if p.Description != nil {
		add("description", *p.Description)
	}
	if p.Category != nil {
		add("category", *p.Category)
	}
	if p.Flow != nil {
		add("flow", *p.Flow)
	}
	if p.Subtype != nil {
		add("subtype", p.Subtype)
	}
	if p.Asset != nil {
		add("asset", p.Asset)
	}
	if p.KeyUser != nil {
		add("key_user", p.KeyUser)
	}
	if p.Quantity != nil {
		add("quantity", p.Quantity)
	}
	if p.Amount != nil {
		add("amount", *p.Amount)
	}
	if p.Notes != nil {
		add("notes", p.Notes)
	}
	if p.Tags != nil {
		add("tags", pq.Array(*p.Tags))
	}
	if set == "" {
		return domain.Transaction{}, fmt.Errorf("no fields to update")
	}

	set += fmt.Sprintf(", updated_at = $%d", n)
	args = append(args, time.Now())
	n++
	args = append(args, id)

	query := fmt.Sprintf(`
		UPDATE transactions SET %s WHERE id = $%d RETURNING `+txColumns, set, n)

	var t domain.Transaction
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&t.ID, &t.Date, &t.Description, &t.Category, &t.Flow,
		&t.Subtype, &t.Asset, &t.KeyUser, &t.Quantity, &t.Amount, &t.Notes,
		&t.Source, &t.BankRawID, &t.Currency, &t.CCStatementID, &t.AccountID,
		pq.Array(&t.Tags),
		&t.CreatedAt, &t.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return domain.Transaction{}, fmt.Errorf("not found")
	}
	return t, err
}

func (r *transactionRepo) Delete(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, "DELETE FROM transactions WHERE id = $1", id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("not found")
	}
	return nil
}

func (r *transactionRepo) CreateBatch(ctx context.Context, params []domain.CreateTransactionParams) (imported, duplicates int, err error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO transactions (date, description, category, flow, subtype, asset, key_user, quantity, amount, notes, source, bank_raw_id, currency, account_id, tags)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		ON CONFLICT ON CONSTRAINT transactions_dedup DO NOTHING
	`)
	if err != nil {
		return 0, 0, err
	}
	defer stmt.Close()

	for _, p := range params {
		if p.Currency == "" {
			p.Currency = "CLP"
		}
		if p.Tags == nil {
			p.Tags = []string{}
		}
		res, err := stmt.ExecContext(ctx,
			p.Date, p.Description, p.Category, p.Flow, p.Subtype,
			p.Asset, p.KeyUser, p.Quantity, p.Amount, p.Notes, p.Source, p.BankRawID, p.Currency,
			p.AccountID, pq.Array(p.Tags),
		)
		if err != nil {
			return 0, 0, fmt.Errorf("inserting transaction: %w", err)
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
