package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"arasaka/internal/domain"
	"github.com/lib/pq"
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

func (r *userTagRepo) UpsertBatch(ctx context.Context, userID int64, tags []string) error {
	if len(tags) == 0 {
		return nil
	}
	args := make([]any, 0, 1+len(tags))
	args = append(args, userID)
	placeholders := make([]string, len(tags))
	for i, tag := range tags {
		args = append(args, tag)
		placeholders[i] = fmt.Sprintf("($1, $%d)", i+2)
	}
	query := "INSERT INTO user_tags (user_id, tag) VALUES " +
		strings.Join(placeholders, ", ") +
		" ON CONFLICT (user_id, tag) DO UPDATE SET usage_count = user_tags.usage_count + 1"
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *userTagRepo) DecrementBatch(ctx context.Context, userID int64, tags []string) error {
	if len(tags) == 0 {
		return nil
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE user_tags SET usage_count = GREATEST(0, usage_count - 1) WHERE user_id = $1 AND tag = ANY($2)`,
		userID, pq.Array(tags))
	return err
}

func (r *userTagRepo) ListMostUsed(ctx context.Context, userID int64, limit int) ([]string, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT tag FROM user_tags WHERE user_id = $1 ORDER BY usage_count DESC LIMIT $2`,
		userID, limit)
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
		`SELECT tag, icon, color FROM user_tags WHERE user_id = $1 ORDER BY tag`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []domain.UserTagEntry{}
	for rows.Next() {
		var e domain.UserTagEntry
		if err := rows.Scan(&e.Tag, &e.Icon, &e.Color); err != nil {
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
		`INSERT INTO user_tags (user_id, tag, icon) VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, tag) DO UPDATE SET icon = EXCLUDED.icon`,
		userID, tag, iconVal)
	return err
}

func (r *userTagRepo) SetColor(ctx context.Context, userID int64, tag, color string) error {
	var colorVal *string
	if color != "" {
		colorVal = &color
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO user_tags (user_id, tag, color) VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, tag) DO UPDATE SET color = EXCLUDED.color`,
		userID, tag, colorVal)
	return err
}

func (r *userTagRepo) Delete(ctx context.Context, userID int64, tag string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM user_tags WHERE user_id = $1 AND tag = $2`,
		userID, tag)
	return err
}
