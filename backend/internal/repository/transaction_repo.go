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

const txColumns = `id, date, description, flow, custom_description, amount, notes, source, bank_raw_id, currency, cc_statement_id, account_id, tags, created_at, updated_at, user_id`

func scanTx(s interface{ Scan(...any) error }, t *domain.Transaction) error {
	return s.Scan(
		&t.ID, &t.Date, &t.Description, &t.Flow,
		&t.CustomDescription, &t.Amount, &t.Notes,
		&t.Source, &t.BankRawID, &t.Currency, &t.CCStatementID, &t.AccountID,
		pq.Array(&t.Tags),
		&t.CreatedAt, &t.UpdatedAt, &t.UserID,
	)
}

// List returns transactions for the given filter. Running balance is computed
// client-side from the account's current balance, so no window function is needed here.
func (r *transactionRepo) List(ctx context.Context, f domain.TransactionFilter) ([]domain.Transaction, error) {
	where := "WHERE 1=1"
	var args []any
	n := 1

	if f.AccountID != "" {
		where += fmt.Sprintf(" AND account_id = $%d", n)
		args = append(args, f.AccountID)
		n++
	} else {
		// Bank movements are only visible when a specific account is selected.
		where += " AND source != 'bank_json'"
	}

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
	if f.Flow != "" {
		where += fmt.Sprintf(" AND flow = $%d", n)
		args = append(args, f.Flow)
		n++
	}
	if len(f.Tags) > 0 {
		where += fmt.Sprintf(" AND tags @> $%d", n)
		args = append(args, pq.Array(f.Tags))
		n++
	}
	if f.DateFrom != "" {
		where += fmt.Sprintf(" AND date >= $%d", n)
		args = append(args, f.DateFrom)
		n++
	}
	if f.DateTo != "" {
		where += fmt.Sprintf(" AND date <= $%d", n)
		args = append(args, f.DateTo)
		n++
	}

	limit := 2000
	if f.Limit > 0 {
		limit = f.Limit
	}

	query := fmt.Sprintf(`
		SELECT `+txColumns+`
		FROM transactions
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
		if err := scanTx(rows, &t); err != nil {
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
	return t, scanTx(r.db.QueryRowContext(ctx, `
		INSERT INTO transactions (date, description, flow, custom_description, amount, notes, source, bank_raw_id, currency, account_id, tags, user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING `+txColumns,
		p.Date, p.Description, p.Flow, p.CustomDescription,
		p.Amount, p.Notes, p.Source, p.BankRawID, p.Currency,
		p.AccountID, pq.Array(p.Tags), p.UserID,
	), &t)
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
	if p.Flow != nil {
		add("flow", *p.Flow)
	}
	if p.CustomDescription != nil {
		add("custom_description", p.CustomDescription)
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
	if err := scanTx(r.db.QueryRowContext(ctx, query, args...), &t); err != nil {
		if err == sql.ErrNoRows {
			return domain.Transaction{}, fmt.Errorf("not found")
		}
		return domain.Transaction{}, err
	}
	return t, nil
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
	var dateFrom, dateTo time.Time
	if month == 0 {
		dateFrom = time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
		dateTo = time.Date(year+1, 1, 1, 0, 0, 0, 0, time.UTC)
	} else {
		dateFrom = time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
		dateTo = dateFrom.AddDate(0, 1, 0)
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT unnest(tags)  AS tag,
		       SUM(amount)   AS total,
		       COUNT(*)      AS transactions
		FROM transactions
		WHERE flow = 'EXPENSE'
		  AND date >= $1 AND date < $2
		  AND ($3::bigint IS NULL OR account_id = $3)
		  AND user_id = $4
		GROUP BY tag
		ORDER BY total DESC
	`, dateFrom, dateTo, accountID, userID)
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
		INSERT INTO transactions (date, description, flow, custom_description, amount, notes, source, bank_raw_id, currency, account_id, tags, user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
			p.Date, p.Description, p.Flow, p.CustomDescription,
			p.Amount, p.Notes, p.Source, p.BankRawID, p.Currency,
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
