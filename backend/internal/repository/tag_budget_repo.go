package repository

import (
	"context"
	"database/sql"

	"arasaka/internal/domain"
)

type tagBudgetRepo struct {
	db *sql.DB
}

func NewTagBudgetRepository(db *sql.DB) domain.TagBudgetRepository {
	return &tagBudgetRepo{db: db}
}

func (r *tagBudgetRepo) List(ctx context.Context, userID int64, year int) ([]domain.TagBudget, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, user_id, tag, year, month, amount
		 FROM tag_budgets
		 WHERE user_id = $1 AND year = $2
		 ORDER BY tag`, userID, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []domain.TagBudget{}
	for rows.Next() {
		var b domain.TagBudget
		if err := rows.Scan(&b.ID, &b.UserID, &b.Tag, &b.Year, &b.Month, &b.Amount); err != nil {
			return nil, err
		}
		result = append(result, b)
	}
	return result, rows.Err()
}

func (r *tagBudgetRepo) Upsert(ctx context.Context, b domain.TagBudget) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO tag_budgets (user_id, tag, year, month, amount)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, tag, year, month) DO UPDATE SET amount = EXCLUDED.amount`,
		b.UserID, b.Tag, b.Year, b.Month, b.Amount)
	return err
}
