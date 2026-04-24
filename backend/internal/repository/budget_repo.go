package repository

import (
	"context"
	"database/sql"

	"arasaka/internal/domain"
)

type budgetRepo struct {
	db *sql.DB
}

// NewBudgetRepository returns a postgres-backed BudgetRepository.
func NewBudgetRepository(db *sql.DB) domain.BudgetRepository {
	return &budgetRepo{db: db}
}

func (r *budgetRepo) List(ctx context.Context, year string) ([]domain.Budget, error) {
	query := `SELECT id, category, year, month, amount FROM budgets WHERE 1=1`
	var args []any
	if year != "" {
		query += " AND year = $1"
		args = append(args, year)
	}
	query += " ORDER BY year DESC, month ASC, category ASC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var budgets []domain.Budget
	for rows.Next() {
		var b domain.Budget
		if err := rows.Scan(&b.ID, &b.Category, &b.Year, &b.Month, &b.Amount); err != nil {
			return nil, err
		}
		budgets = append(budgets, b)
	}
	if budgets == nil {
		budgets = []domain.Budget{}
	}
	return budgets, nil
}

func (r *budgetRepo) Upsert(ctx context.Context, b domain.Budget) (domain.Budget, error) {
	var result domain.Budget
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO budgets (category, year, month, amount)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT ON CONSTRAINT budgets_unique
		DO UPDATE SET amount = EXCLUDED.amount
		RETURNING id, category, year, month, amount
	`, b.Category, b.Year, b.Month, b.Amount).
		Scan(&result.ID, &result.Category, &result.Year, &result.Month, &result.Amount)
	return result, err
}

func (r *budgetRepo) UpsertBatch(ctx context.Context, budgets []domain.Budget) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO budgets (category, year, month, amount)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT ON CONSTRAINT budgets_unique
		DO UPDATE SET amount = EXCLUDED.amount
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, b := range budgets {
		if _, err := stmt.ExecContext(ctx, b.Category, b.Year, b.Month, b.Amount); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *budgetRepo) BudgetForCategory(ctx context.Context, category string, year, month int) (int64, error) {
	var amount int64
	err := r.db.QueryRowContext(ctx, `
		SELECT COALESCE(
			(SELECT amount FROM budgets WHERE category=$1 AND year=$2 AND month=$3),
			(SELECT amount FROM budgets WHERE category=$1 AND year=$2 AND month=0),
			0
		)
	`, category, year, month).Scan(&amount)
	return amount, err
}
