package repository

import (
	"context"
	"database/sql"

	"arasaka/internal/domain"
)

type reportRepo struct {
	db *sql.DB
}

// NewReportRepository returns a postgres-backed ReportRepository.
func NewReportRepository(db *sql.DB) domain.ReportRepository {
	return &reportRepo{db: db}
}

func (r *reportRepo) MonthlyTotals(ctx context.Context, userID int64, year, month int, accountID *int64) (income, expenses, investments int64, err error) {
	err = r.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN flow = 'INCOME'  THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'EXPENSE' THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'INVEST'  THEN amount ELSE 0 END), 0)
		FROM transactions
		WHERE date >= make_date($1::int, $2::int, 1)
		  AND date <  make_date($1::int, $2::int, 1) + interval '1 month'
		  AND ($3::bigint IS NULL OR account_id = $3)
		  AND user_id = $4
	`, year, month, accountID, userID).Scan(&income, &expenses, &investments)
	return
}

// TagTotals returns expense totals grouped by tag for a given month, joined with tag_budgets.
func (r *reportRepo) TagTotals(ctx context.Context, userID int64, year, month int, accountID *int64) ([]domain.CategorySummary, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			t.tag,
			SUM(tr.amount) AS total,
			COALESCE(MAX(tb_m.amount), MAX(tb_d.amount), 0) AS budget,
			COUNT(*) AS cnt
		FROM transactions tr
		CROSS JOIN LATERAL unnest(tr.tags) AS t(tag)
		LEFT JOIN user_tags ut_b ON ut_b.tag = t.tag AND ut_b.user_id = $4
		LEFT JOIN tag_budgets tb_m ON tb_m.user_tag_id = ut_b.id AND tb_m.year = $1 AND tb_m.month = $2
		LEFT JOIN tag_budgets tb_d ON tb_d.user_tag_id = ut_b.id AND tb_d.year = $1 AND tb_d.month = 0
		WHERE tr.date >= make_date($1::int, $2::int, 1)
		  AND tr.date <  make_date($1::int, $2::int, 1) + interval '1 month'
		  AND tr.flow = 'EXPENSE'
		  AND ($3::bigint IS NULL OR tr.account_id = $3)
		  AND tr.user_id = $4
		GROUP BY t.tag
		ORDER BY total DESC
	`, year, month, accountID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.CategorySummary
	for rows.Next() {
		var cs domain.CategorySummary
		if err := rows.Scan(&cs.Category, &cs.Total, &cs.Budget, &cs.Transactions); err != nil {
			return nil, err
		}
		if cs.Budget > 0 {
			cs.PctUsed = float64(cs.Total) / float64(cs.Budget)
		}
		result = append(result, cs)
	}
	if result == nil {
		result = []domain.CategorySummary{}
	}
	return result, rows.Err()
}

func (r *reportRepo) TopExpenses(ctx context.Context, userID int64, year, month, limit int, accountID *int64) ([]domain.Transaction, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, date, description, flow, amount, source, created_at, updated_at
		FROM transactions
		WHERE date >= make_date($1::int, $2::int, 1)
		  AND date <  make_date($1::int, $2::int, 1) + interval '1 month'
		  AND flow = 'EXPENSE'
		  AND ($4::bigint IS NULL OR account_id = $4)
		  AND user_id = $5
		ORDER BY amount DESC
		LIMIT $3
	`, year, month, limit, accountID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []domain.Transaction
	for rows.Next() {
		var t domain.Transaction
		rows.Scan(&t.ID, &t.Date, &t.Description, &t.Flow, &t.Amount, &t.Source, &t.CreatedAt, &t.UpdatedAt)
		txs = append(txs, t)
	}
	if txs == nil {
		txs = []domain.Transaction{}
	}
	return txs, nil
}

func (r *reportRepo) YearlyKPIs(ctx context.Context, userID int64, year int, accountID *int64) (opening, income, expenses, investments int64, err error) {
	err = r.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN flow = 'OPENING' THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'INCOME'  THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'EXPENSE' THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'INVEST'  THEN amount ELSE 0 END), 0)
		FROM transactions
		WHERE date >= make_date($1::int, 1, 1)
		  AND date <  make_date($1::int, 1, 1) + interval '1 year'
		  AND ($2::bigint IS NULL OR account_id = $2)
		  AND user_id = $3
	`, year, accountID, userID).Scan(&opening, &income, &expenses, &investments)
	return
}

func (r *reportRepo) MonthlyTrend(ctx context.Context, userID int64, year int, accountID *int64) ([]domain.MonthlyReport, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			EXTRACT(MONTH FROM date)::int,
			COALESCE(SUM(CASE WHEN flow = 'INCOME'  THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'EXPENSE' THEN amount ELSE 0 END), 0)
		FROM transactions
		WHERE date >= make_date($1::int, 1, 1)
		  AND date <  make_date($1::int, 1, 1) + interval '1 year'
		  AND ($2::bigint IS NULL OR account_id = $2)
		  AND user_id = $3
		GROUP BY EXTRACT(MONTH FROM date)
		ORDER BY 1 ASC
	`, year, accountID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trend []domain.MonthlyReport
	for rows.Next() {
		var m domain.MonthlyReport
		if err := rows.Scan(&m.Month, &m.Income, &m.Expenses); err != nil {
			return nil, err
		}
		m.Year = year
		m.Balance = m.Income - m.Expenses
		if m.Income > 0 {
			m.SavingsRate = float64(m.Income-m.Expenses) / float64(m.Income)
		}
		m.ByCategory = []domain.CategorySummary{}
		m.TopExpenses = []domain.Transaction{}
		trend = append(trend, m)
	}
	if trend == nil {
		trend = []domain.MonthlyReport{}
	}
	return trend, nil
}

func (r *reportRepo) MonthlyHistory(ctx context.Context, userID int64, year, beforeMonth int, accountID *int64) ([]domain.MonthlyReport, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			EXTRACT(MONTH FROM date)::int,
			COALESCE(SUM(CASE WHEN flow = 'INCOME'  THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'EXPENSE' THEN amount ELSE 0 END), 0)
		FROM transactions
		WHERE date >= make_date($1::int, 1, 1)
		  AND date <  make_date($1::int, $2::int, 1)
		  AND ($3::bigint IS NULL OR account_id = $3)
		  AND user_id = $4
		GROUP BY EXTRACT(MONTH FROM date)
		ORDER BY 1 ASC
	`, year, beforeMonth, accountID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []domain.MonthlyReport
	for rows.Next() {
		var m domain.MonthlyReport
		if err := rows.Scan(&m.Month, &m.Income, &m.Expenses); err != nil {
			return nil, err
		}
		m.Year = year
		m.Balance = m.Income - m.Expenses
		if m.Income > 0 {
			m.SavingsRate = float64(m.Income-m.Expenses) / float64(m.Income)
		}

		catRows, err := r.db.QueryContext(ctx, `
			SELECT
				t.tag,
				SUM(tr.amount),
				COALESCE(MAX(tb_m.amount), MAX(tb_d.amount), 0),
				COUNT(*)
			FROM transactions tr
			CROSS JOIN LATERAL unnest(tr.tags) AS t(tag)
			LEFT JOIN user_tags ut_b ON ut_b.tag = t.tag AND ut_b.user_id = $4
			LEFT JOIN tag_budgets tb_m ON tb_m.user_tag_id = ut_b.id AND tb_m.year = $1 AND tb_m.month = $2
			LEFT JOIN tag_budgets tb_d ON tb_d.user_tag_id = ut_b.id AND tb_d.year = $1 AND tb_d.month = 0
			WHERE tr.date >= make_date($1::int, $2::int, 1)
			  AND tr.date <  make_date($1::int, $2::int, 1) + interval '1 month'
			  AND tr.flow = 'EXPENSE'
			  AND ($3::bigint IS NULL OR tr.account_id = $3)
			  AND tr.user_id = $4
			GROUP BY t.tag
		`, year, m.Month, accountID, userID)
		if err == nil {
			for catRows.Next() {
				var cs domain.CategorySummary
				catRows.Scan(&cs.Category, &cs.Total, &cs.Budget, &cs.Transactions)
				if cs.Budget > 0 {
					cs.PctUsed = float64(cs.Total) / float64(cs.Budget)
				}
				m.ByCategory = append(m.ByCategory, cs)
			}
			catRows.Close()
		}
		if m.ByCategory == nil {
			m.ByCategory = []domain.CategorySummary{}
		}
		history = append(history, m)
	}
	return history, nil
}

// YearlyTagTotals returns expense totals grouped by tag for a full year.
func (r *reportRepo) YearlyTagTotals(ctx context.Context, userID int64, year int, accountID *int64) ([]domain.CategorySummary, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			t.tag,
			SUM(tr.amount) AS total,
			COUNT(*)       AS cnt
		FROM transactions tr, unnest(tr.tags) AS t(tag)
		WHERE tr.date >= make_date($1::int, 1, 1)
		  AND tr.date <  make_date($1::int, 1, 1) + interval '1 year'
		  AND tr.flow = 'EXPENSE'
		  AND ($2::bigint IS NULL OR tr.account_id = $2)
		  AND tr.user_id = $3
		GROUP BY t.tag
		ORDER BY total DESC
	`, year, accountID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.CategorySummary
	for rows.Next() {
		var cs domain.CategorySummary
		if err := rows.Scan(&cs.Category, &cs.Total, &cs.Transactions); err != nil {
			return nil, err
		}
		result = append(result, cs)
	}
	if result == nil {
		result = []domain.CategorySummary{}
	}
	return result, rows.Err()
}

func (r *reportRepo) YearlyTopExpenses(ctx context.Context, userID int64, year, limit int, accountID *int64) ([]domain.Transaction, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, date, description, flow, amount, source, created_at, updated_at
		FROM transactions
		WHERE date >= make_date($1::int, 1, 1)
		  AND date <  make_date($1::int, 1, 1) + interval '1 year'
		  AND flow = 'EXPENSE'
		  AND ($3::bigint IS NULL OR account_id = $3)
		  AND user_id = $4
		ORDER BY amount DESC
		LIMIT $2
	`, year, limit, accountID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []domain.Transaction
	for rows.Next() {
		var t domain.Transaction
		rows.Scan(&t.ID, &t.Date, &t.Description, &t.Flow, &t.Amount, &t.Source, &t.CreatedAt, &t.UpdatedAt)
		txs = append(txs, t)
	}
	if txs == nil {
		txs = []domain.Transaction{}
	}
	return txs, nil
}

// AllTimeTagTotals returns expense totals grouped by tag across all time.
func (r *reportRepo) AllTimeTagTotals(ctx context.Context, userID int64, accountID *int64) ([]domain.CategorySummary, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			t.tag,
			SUM(tr.amount) AS total,
			COUNT(*)       AS cnt
		FROM transactions tr, unnest(tr.tags) AS t(tag)
		WHERE tr.flow = 'EXPENSE'
		  AND ($1::bigint IS NULL OR tr.account_id = $1)
		  AND tr.user_id = $2
		GROUP BY t.tag
		ORDER BY total DESC
	`, accountID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.CategorySummary
	for rows.Next() {
		var cs domain.CategorySummary
		if err := rows.Scan(&cs.Category, &cs.Total, &cs.Transactions); err != nil {
			return nil, err
		}
		result = append(result, cs)
	}
	if result == nil {
		result = []domain.CategorySummary{}
	}
	return result, rows.Err()
}

func (r *reportRepo) ActiveInstallments(ctx context.Context, userID int64) ([]domain.CreditCardItem, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, statement_id, date, description, amount, currency,
		       installment_current, installment_total, item_type, bank_raw_id, created_at
		FROM credit_card_items
		WHERE installment_total > 1
		  AND installment_current < installment_total
		  AND statement_id IN (SELECT id FROM credit_card_statements WHERE user_id = $1)
		ORDER BY date DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []domain.CreditCardItem
	for rows.Next() {
		var item domain.CreditCardItem
		if err := rows.Scan(
			&item.ID, &item.StatementID, &item.Date, &item.Description,
			&item.Amount, &item.Currency,
			&item.InstallmentCurrent, &item.InstallmentTotal,
			&item.ItemType, &item.BankRawID, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if items == nil {
		items = []domain.CreditCardItem{}
	}
	return items, nil
}

var _ domain.ReportRepository = (*reportRepo)(nil)
