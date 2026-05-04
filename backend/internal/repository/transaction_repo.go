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

const txColumns = `id, date, description, category, flow, subtype, asset, key_user, quantity, amount, notes, source, bank_raw_id, currency, cc_statement_id, account_id, tags, created_at, updated_at, user_id`

func scanTx(s interface{ Scan(...any) error }, t *domain.Transaction) error {
	return s.Scan(
		&t.ID, &t.Date, &t.Description, &t.Category, &t.Flow,
		&t.Subtype, &t.Asset, &t.KeyUser, &t.Quantity, &t.Amount, &t.Notes,
		&t.Source, &t.BankRawID, &t.Currency, &t.CCStatementID, &t.AccountID,
		pq.Array(&t.Tags),
		&t.CreatedAt, &t.UpdatedAt, &t.UserID,
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
		&t.CreatedAt, &t.UpdatedAt, &t.UserID, &t.RunningBalance,
	)
}

// List returns transactions with running_balance scoped to the same account/source
// filter as the result set. Month/category/flow/tag filters apply only to the outer
// query so they do not distort the balance shown for unfiltered periods.
func (r *transactionRepo) List(ctx context.Context, f domain.TransactionFilter) ([]domain.Transaction, error) {
	// cteWhere scopes the running_balance window to the selected account.
	// outerWhere applies additional row-level filters without affecting the balance.
	cteWhere := "WHERE 1=1"
	outerWhere := "WHERE 1=1"
	var args []any
	n := 1

	if f.AccountID != "" {
		// Apply to both CTE (scopes running_balance) and outer (scopes list).
		cteWhere += fmt.Sprintf(" AND account_id = $%d", n)
		outerWhere += fmt.Sprintf(" AND account_id = $%d", n)
		args = append(args, f.AccountID)
		n++
	} else {
		// Bank movements are only visible when a specific account is selected.
		cteWhere += " AND source != 'bank_json'"
		outerWhere += " AND source != 'bank_json'"
	}

	if f.Year != "" {
		outerWhere += fmt.Sprintf(" AND EXTRACT(YEAR FROM date) = $%d", n)
		args = append(args, f.Year)
		n++
	}
	if f.Month != "" {
		outerWhere += fmt.Sprintf(" AND EXTRACT(MONTH FROM date) = $%d", n)
		args = append(args, f.Month)
		n++
	}
	if f.Category != "" {
		outerWhere += fmt.Sprintf(" AND category = $%d", n)
		args = append(args, f.Category)
		n++
	}
	if f.Flow != "" {
		outerWhere += fmt.Sprintf(" AND flow = $%d", n)
		args = append(args, f.Flow)
		n++
	}
	if len(f.Tags) > 0 {
		outerWhere += fmt.Sprintf(" AND tags @> $%d", n)
		args = append(args, pq.Array(f.Tags))
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
			%s
		)
		SELECT `+listColumns+`
		FROM with_balance
		%s
		ORDER BY date DESC, id DESC
		LIMIT %d
	`, cteWhere, outerWhere, limit)

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
		INSERT INTO transactions (date, description, category, flow, subtype, asset, key_user, quantity, amount, notes, source, bank_raw_id, currency, account_id, tags, user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		RETURNING `+txColumns,
		p.Date, p.Description, p.Category, p.Flow, p.Subtype,
		p.Asset, p.KeyUser, p.Quantity, p.Amount, p.Notes, p.Source, p.BankRawID, p.Currency,
		p.AccountID, pq.Array(p.Tags), p.UserID,
	).Scan(
		&t.ID, &t.Date, &t.Description, &t.Category, &t.Flow,
		&t.Subtype, &t.Asset, &t.KeyUser, &t.Quantity, &t.Amount, &t.Notes,
		&t.Source, &t.BankRawID, &t.Currency, &t.CCStatementID, &t.AccountID,
		pq.Array(&t.Tags),
		&t.CreatedAt, &t.UpdatedAt, &t.UserID,
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
		&t.CreatedAt, &t.UpdatedAt, &t.UserID,
	)
	if err == sql.ErrNoRows {
		return domain.Transaction{}, fmt.Errorf("not found")
	}
	return t, err
}

func (r *transactionRepo) ListUsedTags(ctx context.Context, userID int64, limit int) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT unnest(tags) AS tag
		FROM transactions
		WHERE user_id = $1
		GROUP BY tag
		ORDER BY count(*) DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	if tags == nil {
		tags = []string{}
	}
	return tags, rows.Err()
}

func (r *transactionRepo) TagSpending(ctx context.Context, userID int64, year, month int, accountID *int64) ([]domain.TagSummary, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT unnest(tags)  AS tag,
		       SUM(amount)   AS total,
		       COUNT(*)      AS transactions
		FROM transactions
		WHERE flow = 'EXPENSE'
		  AND EXTRACT(YEAR FROM date) = $1
		  AND ($2 = 0 OR EXTRACT(MONTH FROM date) = $2)
		  AND ($3::bigint IS NULL OR account_id = $3)
		  AND user_id = $4
		GROUP BY tag
		ORDER BY total DESC
	`, year, month, accountID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []domain.TagSummary
	for rows.Next() {
		var s domain.TagSummary
		if err := rows.Scan(&s.Tag, &s.Total, &s.Transactions); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	if result == nil {
		result = []domain.TagSummary{}
	}
	return result, rows.Err()
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
		INSERT INTO transactions (date, description, category, flow, subtype, asset, key_user, quantity, amount, notes, source, bank_raw_id, currency, account_id, tags, user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
			p.AccountID, pq.Array(p.Tags), p.UserID,
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
