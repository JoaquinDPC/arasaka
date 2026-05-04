package repository

import (
	"context"
	"database/sql"
	"fmt"

	"arasaka/internal/domain"
)

type budgetRepo struct {
	db *sql.DB
}

// NewBudgetRepository returns a postgres-backed BudgetRepository.
func NewBudgetRepository(db *sql.DB) domain.BudgetRepository {
	return &budgetRepo{db: db}
}

func (r *budgetRepo) List(ctx context.Context, userID int64, year string) ([]domain.Budget, error) {
	query := `SELECT id, user_id, category, year, month, amount, account_id FROM budgets WHERE user_id = $1`
	args := []any{userID}
	n := 2
	if year != "" {
		query += fmt.Sprintf(" AND year = $%d", n)
		args = append(args, year)
		n++
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
		if err := rows.Scan(&b.ID, &b.UserID, &b.Category, &b.Year, &b.Month, &b.Amount, &b.AccountID); err != nil {
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
		INSERT INTO budgets (user_id, category, year, month, amount, account_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT ON CONSTRAINT budgets_unique
		DO UPDATE SET amount = EXCLUDED.amount
		RETURNING id, user_id, category, year, month, amount, account_id
	`, b.UserID, b.Category, b.Year, b.Month, b.Amount, b.AccountID).
		Scan(&result.ID, &result.UserID, &result.Category, &result.Year, &result.Month, &result.Amount, &result.AccountID)
	return result, err
}

func (r *budgetRepo) UpsertBatch(ctx context.Context, budgets []domain.Budget) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO budgets (user_id, category, year, month, amount, account_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT ON CONSTRAINT budgets_unique
		DO UPDATE SET amount = EXCLUDED.amount
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, b := range budgets {
		if _, err := stmt.ExecContext(ctx, b.UserID, b.Category, b.Year, b.Month, b.Amount, b.AccountID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *budgetRepo) ListCategories(ctx context.Context) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT DISTINCT category FROM budgets ORDER BY category`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var cats []string
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	if cats == nil {
		cats = []string{}
	}
	return cats, rows.Err()
}

func (r *budgetRepo) BudgetForCategory(ctx context.Context, userID int64, category string, year, month int) (int64, error) {
	var amount int64
	err := r.db.QueryRowContext(ctx, `
		SELECT COALESCE(
			(SELECT amount FROM budgets WHERE user_id=$1 AND category=$2 AND year=$3 AND month=$4),
			(SELECT amount FROM budgets WHERE user_id=$1 AND category=$2 AND year=$3 AND month=0),
			0
		)
	`, userID, category, year, month).Scan(&amount)
	return amount, err
}
