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

func (r *reportRepo) MonthlyTotals(ctx context.Context, year, month int) (income, expenses, investments int64, err error) {
	err = r.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN flow = 'INCOME'  THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'EXPENSE' THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'INVEST'  THEN amount ELSE 0 END), 0)
		FROM transactions
		WHERE EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
	`, year, month).Scan(&income, &expenses, &investments)
	return
}

func (r *reportRepo) CategoryTotals(ctx context.Context, year, month int) ([]domain.CategorySummary, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			t.category,
			SUM(t.amount) AS total,
			COALESCE(
				(SELECT amount FROM budgets WHERE category = t.category AND year = $1 AND month = $2),
				(SELECT amount FROM budgets WHERE category = t.category AND year = $1 AND month = 0),
				0
			) AS budget,
			COUNT(*) AS cnt
		FROM transactions t
		WHERE EXTRACT(YEAR FROM t.date) = $1
		  AND EXTRACT(MONTH FROM t.date) = $2
		  AND t.flow = 'EXPENSE'
		GROUP BY t.category
		ORDER BY total DESC
	`, year, month)
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
	return result, nil
}

func (r *reportRepo) SubtypeTotals(ctx context.Context, year, month int) (map[string]int64, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT COALESCE(subtype, 'N/A'), COALESCE(SUM(amount), 0)
		FROM transactions
		WHERE EXTRACT(YEAR FROM date) = $1
		  AND EXTRACT(MONTH FROM date) = $2
		  AND flow = 'EXPENSE'
		GROUP BY subtype
	`, year, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]int64)
	for rows.Next() {
		var st string
		var total int64
		rows.Scan(&st, &total)
		result[st] = total
	}
	return result, nil
}

func (r *reportRepo) TopExpenses(ctx context.Context, year, month, limit int) ([]domain.Transaction, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, date, description, category, flow, subtype, asset, quantity, amount, notes, source, bank_raw_id, created_at, updated_at
		FROM transactions
		WHERE EXTRACT(YEAR FROM date) = $1
		  AND EXTRACT(MONTH FROM date) = $2
		  AND flow = 'EXPENSE'
		ORDER BY amount DESC
		LIMIT $3
	`, year, month, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []domain.Transaction
	for rows.Next() {
		var t domain.Transaction
		rows.Scan(&t.ID, &t.Date, &t.Description, &t.Category, &t.Flow,
			&t.Subtype, &t.Asset, &t.Quantity, &t.Amount, &t.Notes,
			&t.Source, &t.BankRawID, &t.CreatedAt, &t.UpdatedAt)
		txs = append(txs, t)
	}
	if txs == nil {
		txs = []domain.Transaction{}
	}
	return txs, nil
}

func (r *reportRepo) YearlyKPIs(ctx context.Context, year int) (opening, income, expenses, investments, fixed int64, err error) {
	err = r.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN flow = 'OPENING' THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'INCOME'  THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'EXPENSE' THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'INVEST'  THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'EXPENSE' AND subtype = 'FIJO' THEN amount ELSE 0 END), 0)
		FROM transactions
		WHERE EXTRACT(YEAR FROM date) = $1
	`, year).Scan(&opening, &income, &expenses, &investments, &fixed)
	return
}

func (r *reportRepo) MonthlyTrend(ctx context.Context, year int) ([]domain.MonthlyReport, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			EXTRACT(MONTH FROM date)::int,
			COALESCE(SUM(CASE WHEN flow = 'INCOME'  THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'EXPENSE' THEN amount ELSE 0 END), 0)
		FROM transactions
		WHERE EXTRACT(YEAR FROM date) = $1
		GROUP BY EXTRACT(MONTH FROM date)
		ORDER BY 1 ASC
	`, year)
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

func (r *reportRepo) BudgetVsActual(ctx context.Context, year, month int) ([]domain.CategorySummary, error) {
	// Collect categories with budgets for this year
	budgetRows, err := r.db.QueryContext(ctx, `
		SELECT DISTINCT category FROM budgets WHERE year = $1
	`, year)
	if err != nil {
		return nil, err
	}
	defer budgetRows.Close()

	var budgetCats []string
	for budgetRows.Next() {
		var cat string
		budgetRows.Scan(&cat)
		budgetCats = append(budgetCats, cat)
	}

	// Actual expenses by category for the month
	actualRows, err := r.db.QueryContext(ctx, `
		SELECT category, COALESCE(SUM(amount), 0), COUNT(*)
		FROM transactions
		WHERE EXTRACT(YEAR FROM date) = $1
		  AND EXTRACT(MONTH FROM date) = $2
		  AND flow = 'EXPENSE'
		GROUP BY category
	`, year, month)
	if err != nil {
		return nil, err
	}
	defer actualRows.Close()

	actuals := map[string]domain.CategorySummary{}
	for actualRows.Next() {
		var cs domain.CategorySummary
		actualRows.Scan(&cs.Category, &cs.Total, &cs.Transactions)
		actuals[cs.Category] = cs
	}

	var result []domain.CategorySummary
	seen := map[string]bool{}

	appendCat := func(cat string) {
		if seen[cat] {
			return
		}
		seen[cat] = true
		cs := actuals[cat]
		cs.Category = cat

		var budget int64
		r.db.QueryRowContext(ctx, `
			SELECT COALESCE(
				(SELECT amount FROM budgets WHERE category=$1 AND year=$2 AND month=$3),
				(SELECT amount FROM budgets WHERE category=$1 AND year=$2 AND month=0),
				0
			)
		`, cat, year, month).Scan(&budget)

		cs.Budget = budget
		if budget > 0 {
			cs.PctUsed = float64(cs.Total) / float64(budget)
		}
		result = append(result, cs)
	}

	for _, cat := range budgetCats {
		appendCat(cat)
	}
	for cat := range actuals {
		appendCat(cat)
	}

	if result == nil {
		result = []domain.CategorySummary{}
	}
	return result, nil
}

func (r *reportRepo) MonthlyHistory(ctx context.Context, year, beforeMonth int) ([]domain.MonthlyReport, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			EXTRACT(MONTH FROM date)::int,
			COALESCE(SUM(CASE WHEN flow = 'INCOME'  THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN flow = 'EXPENSE' THEN amount ELSE 0 END), 0)
		FROM transactions
		WHERE EXTRACT(YEAR FROM date) = $1
		  AND EXTRACT(MONTH FROM date) < $2
		GROUP BY EXTRACT(MONTH FROM date)
		ORDER BY 1 ASC
	`, year, beforeMonth)
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

		// Per-category details for insight rules
		catRows, err := r.db.QueryContext(ctx, `
			SELECT
				t.category,
				SUM(t.amount),
				COALESCE(
					(SELECT amount FROM budgets WHERE category = t.category AND year = $1 AND month = $2),
					(SELECT amount FROM budgets WHERE category = t.category AND year = $1 AND month = 0),
					0
				),
				COUNT(*)
			FROM transactions t
			WHERE EXTRACT(YEAR FROM t.date) = $1
			  AND EXTRACT(MONTH FROM t.date) = $2
			  AND t.flow = 'EXPENSE'
			GROUP BY t.category
		`, year, m.Month)
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

func (r *reportRepo) YearlyCategoryTotals(ctx context.Context, year int) ([]domain.CategorySummary, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			CASE WHEN t.category = 'Nan' THEN 'Sin categoría' ELSE t.category END AS category,
			SUM(t.amount) AS total,
			COUNT(*)      AS cnt
		FROM transactions t
		WHERE EXTRACT(YEAR FROM t.date) = $1
		  AND t.flow = 'EXPENSE'
		GROUP BY CASE WHEN t.category = 'Nan' THEN 'Sin categoría' ELSE t.category END
		ORDER BY total DESC
	`, year)
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

func (r *reportRepo) YearlyTopExpenses(ctx context.Context, year, limit int) ([]domain.Transaction, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, date, description, category, flow, subtype, asset, quantity, amount, notes, source, bank_raw_id, created_at, updated_at
		FROM transactions
		WHERE EXTRACT(YEAR FROM date) = $1
		  AND flow = 'EXPENSE'
		ORDER BY amount DESC
		LIMIT $2
	`, year, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []domain.Transaction
	for rows.Next() {
		var t domain.Transaction
		rows.Scan(&t.ID, &t.Date, &t.Description, &t.Category, &t.Flow,
			&t.Subtype, &t.Asset, &t.Quantity, &t.Amount, &t.Notes,
			&t.Source, &t.BankRawID, &t.CreatedAt, &t.UpdatedAt)
		txs = append(txs, t)
	}
	if txs == nil {
		txs = []domain.Transaction{}
	}
	return txs, nil
}

func (r *reportRepo) AllTimeCategoryTotals(ctx context.Context) ([]domain.CategorySummary, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			CASE WHEN category = 'Nan' THEN 'Sin categoría' ELSE category END AS category,
			SUM(amount) AS total,
			COUNT(*) AS cnt
		FROM transactions
		WHERE flow = 'EXPENSE'
		GROUP BY CASE WHEN category = 'Nan' THEN 'Sin categoría' ELSE category END
		ORDER BY total DESC
	`)
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

func (r *reportRepo) ActiveInstallments(ctx context.Context) ([]domain.CreditCardItem, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, statement_id, date, description, amount, currency,
		       installment_current, installment_total, item_type, bank_raw_id, created_at
		FROM credit_card_items
		WHERE installment_total > 1
		  AND installment_current < installment_total
		ORDER BY date DESC
	`)
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
