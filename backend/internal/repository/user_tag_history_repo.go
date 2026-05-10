package repository

import (
	"context"
	"database/sql"

	"github.com/lib/pq"

	"arasaka/internal/domain"
)

type userTagHistoryRepo struct {
	db *sql.DB
}

func NewUserTagHistoryRepository(db *sql.DB) domain.UserTagHistoryRepository {
	return &userTagHistoryRepo{db: db}
}

func (r *userTagHistoryRepo) Upsert(ctx context.Context, userID int64, descriptionKey string, tags []string, keyUser *string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO user_tag_history (user_id, description_key, tags, key_user, use_count, last_used_at)
		 VALUES ($1, $2, $3, $4, 1, NOW())
		 ON CONFLICT (user_id, description_key)
		 DO UPDATE SET
		     tags         = EXCLUDED.tags,
		     key_user     = COALESCE(EXCLUDED.key_user, user_tag_history.key_user),
		     use_count    = user_tag_history.use_count + 1,
		     last_used_at = NOW()`,
		userID, descriptionKey, pq.Array(tags), keyUser,
	)
	return err
}

func (r *userTagHistoryRepo) Match(ctx context.Context, userID int64, descriptionKey string) (*domain.UserTagHistory, error) {
	var h domain.UserTagHistory
	err := r.db.QueryRowContext(ctx,
		`SELECT id, user_id, description_key, tags, key_user, use_count, last_used_at
		   FROM user_tag_history
		  WHERE user_id = $1 AND description_key = $2`,
		userID, descriptionKey,
	).Scan(&h.ID, &h.UserID, &h.DescriptionKey, pq.Array(&h.Tags), &h.KeyUser, &h.UseCount, &h.LastUsedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &h, nil
}
