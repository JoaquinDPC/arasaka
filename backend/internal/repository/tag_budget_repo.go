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
		`SELECT tb.id, tb.user_id, tb.user_tag_id, ut.tag, tb.year, tb.month, tb.amount
		 FROM tag_budgets tb
		 JOIN user_tags ut ON ut.id = tb.user_tag_id
		 WHERE tb.user_id = $1 AND tb.year = $2
		 ORDER BY ut.tag`, userID, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []domain.TagBudget{}
	for rows.Next() {
		var b domain.TagBudget
		if err := rows.Scan(&b.ID, &b.UserID, &b.UserTagID, &b.Tag, &b.Year, &b.Month, &b.Amount); err != nil {
			return nil, err
		}
		result = append(result, b)
	}
	return result, rows.Err()
}

func (r *tagBudgetRepo) Upsert(ctx context.Context, b domain.TagBudget) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO tag_budgets (user_id, user_tag_id, year, month, amount)
		SELECT ut.user_id, ut.id, $3, $4, $5
		FROM user_tags ut
		WHERE ut.user_id = $1 AND ut.tag = $2
		ON CONFLICT (user_tag_id, year, month) DO UPDATE SET amount = EXCLUDED.amount`,
		b.UserID, b.Tag, b.Year, b.Month, b.Amount)
	return err
}

func (r *tagBudgetRepo) Delete(ctx context.Context, userID int64, tag string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM tag_budgets
		 WHERE user_tag_id = (SELECT id FROM user_tags WHERE user_id = $1 AND tag = $2)`,
		userID, tag)
	return err
}
