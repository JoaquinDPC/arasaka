package repository

import (
	"context"
	"database/sql"

	"arasaka/internal/domain"
)

type userTagRepo struct {
	db *sql.DB
}

func NewUserTagRepository(db *sql.DB) domain.UserTagRepository {
	return &userTagRepo{db: db}
}

func (r *userTagRepo) Upsert(ctx context.Context, userID int64, tag string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO user_tags (user_id, tag) VALUES ($1, $2) ON CONFLICT (user_id, tag) DO NOTHING`,
		userID, tag)
	return err
}

func (r *userTagRepo) ListByUserID(ctx context.Context, userID int64) ([]string, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT tag FROM user_tags WHERE user_id = $1 ORDER BY tag`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tags := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	return tags, rows.Err()
}

func (r *userTagRepo) ListWithIcons(ctx context.Context, userID int64) ([]domain.UserTagEntry, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT tag, icon FROM user_tags WHERE user_id = $1 ORDER BY tag`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []domain.UserTagEntry{}
	for rows.Next() {
		var e domain.UserTagEntry
		if err := rows.Scan(&e.Tag, &e.Icon); err != nil {
			return nil, err
		}
		result = append(result, e)
	}
	return result, rows.Err()
}

func (r *userTagRepo) SetIcon(ctx context.Context, userID int64, tag, icon string) error {
	var iconVal *string
	if icon != "" {
		iconVal = &icon
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE user_tags SET icon = $1 WHERE user_id = $2 AND tag = $3`,
		iconVal, userID, tag)
	return err
}
