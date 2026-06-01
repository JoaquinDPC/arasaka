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

const txColumns = `id, date, description, flow, custom_description, amount, notes, source, bank_raw_id, currency, cc_bill_id, account_id, tags, created_at, updated_at, user_id`

func scanTx(s interface{ Scan(...any) error }, t *domain.Transaction) error {
	return s.Scan(
		&t.ID, &t.Date, &t.Description, &t.Flow,
		&t.CustomDescription, &t.Amount, &t.Notes,
		&t.Source, &t.BankRawID, &t.Currency, &t.CCBillID, &t.AccountID,
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

	where += fmt.Sprintf(" AND user_id = $%d", n)
	args = append(args, f.UserID)
	n++

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

func (r *transactionRepo) Update(ctx context.Context, id int64, userID int64, p domain.UpdateTransactionParams) (domain.Transaction, error) {
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
	args = append(args, userID)

	query := fmt.Sprintf(`
		UPDATE transactions SET %s WHERE id = $%d AND user_id = $%d RETURNING `+txColumns, set, n, n+1)

	var t domain.Transaction
	if err := scanTx(r.db.QueryRowContext(ctx, query, args...), &t); err != nil {
		if err == sql.ErrNoRows {
			return domain.Transaction{}, fmt.Errorf("not found")
		}
		return domain.Transaction{}, err
	}
	return t, nil
}

func (r *transactionRepo) GetByID(ctx context.Context, id int64, userID int64) (domain.Transaction, error) {
	var t domain.Transaction
	err := scanTx(r.db.QueryRowContext(ctx,
		"SELECT "+txColumns+" FROM transactions WHERE id = $1 AND user_id = $2", id, userID), &t)
	if err == sql.ErrNoRows {
		return domain.Transaction{}, fmt.Errorf("not found")
	}
	return t, err
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

func (r *transactionRepo) Delete(ctx context.Context, id int64, userID int64) error {
	res, err := r.db.ExecContext(ctx, "DELETE FROM transactions WHERE id = $1 AND user_id = $2", id, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("not found")
	}
	return nil
}

func (r *transactionRepo) UpsertOpeningBalance(ctx context.Context, accountID, userID, amount int64) error {
	bankRawID := fmt.Sprintf("opening_%d", accountID)
	if amount == 0 {
		_, err := r.db.ExecContext(ctx, "DELETE FROM transactions WHERE bank_raw_id = $1", bankRawID)
		return err
	}
	// Use min(date) - 1 day so the opening row always sorts before imported transactions.
	var minDate time.Time
	row := r.db.QueryRowContext(ctx,
		"SELECT COALESCE(MIN(date), NOW()) FROM transactions WHERE account_id = $1 AND flow != 'OPENING'",
		accountID)
	if err := row.Scan(&minDate); err != nil {
		minDate = time.Now()
	}
	date := minDate.AddDate(0, 0, -1)
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO transactions (date, description, flow, amount, source, bank_raw_id, currency, account_id, user_id, tags)
		VALUES ($1, 'Saldo inicial', 'OPENING', $2, 'opening', $3, 'CLP', $4, $5, '{}')
		ON CONFLICT ON CONSTRAINT transactions_dedup DO UPDATE SET amount = excluded.amount, date = excluded.date
	`, date, amount, bankRawID, accountID, userID)
	return err
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

func (r *transactionRepo) LatestBankDate(ctx context.Context, accountID int64) (time.Time, bool, error) {
	var nt sql.NullTime
	err := r.db.QueryRowContext(ctx,
		`SELECT MAX(date) FROM transactions WHERE source = 'bank_json' AND account_id = $1`,
		accountID,
	).Scan(&nt)
	if err != nil {
		return time.Time{}, false, err
	}
	return nt.Time, nt.Valid, nil
}

// DedupCandidates returns bank_json and pdf transactions for accountID in a ±2-day
// window around [minDate, maxDate]. Used by PDF import for cross-source dedup:
// the wider window covers posting-date lag (a transfer initiated Apr 29 may appear
// as May 1 in the bank API).
func (r *transactionRepo) DedupCandidates(ctx context.Context, accountID int64, minDate, maxDate time.Time) ([]domain.DedupCandidate, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT date, amount, flow, description, source
		FROM transactions
		WHERE account_id = $1
		  AND source IN ('bank_json', 'pdf')
		  AND date >= $2::date - INTERVAL '2 days'
		  AND date <= $3::date + INTERVAL '2 days'
	`, accountID, minDate, maxDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.DedupCandidate
	for rows.Next() {
		var c domain.DedupCandidate
		if err := rows.Scan(&c.Date, &c.Amount, &c.Flow, &c.Description, &c.Source); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
