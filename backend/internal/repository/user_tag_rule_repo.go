package repository

import (
	"context"
	"database/sql"

	"github.com/lib/pq"

	"arasaka/internal/domain"
)

type userTagRuleRepo struct {
	db *sql.DB
}

func NewUserTagRuleRepository(db *sql.DB) domain.UserTagRuleRepository {
	return &userTagRuleRepo{db: db}
}

func (r *userTagRuleRepo) Upsert(ctx context.Context, userID int64, descriptionKey string, tags []string, customDescription *string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO user_tag_rules (user_id, description_key, tags, custom_description, use_count, last_used_at)
		 VALUES ($1, $2, $3, $4, 1, NOW())
		 ON CONFLICT (user_id, description_key)
		 DO UPDATE SET
		     tags               = EXCLUDED.tags,
		     custom_description = COALESCE(EXCLUDED.custom_description, user_tag_rules.custom_description),
		     use_count          = user_tag_rules.use_count + 1,
		     last_used_at       = NOW()`,
		userID, descriptionKey, pq.Array(tags), customDescription,
	)
	return err
}

func (r *userTagRuleRepo) MatchBatch(ctx context.Context, userID int64, keys []string) (map[string]*domain.UserTagRule, error) {
	if len(keys) == 0 {
		return map[string]*domain.UserTagRule{}, nil
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, user_id, description_key, tags, custom_description, use_count, last_used_at
		   FROM user_tag_rules
		  WHERE user_id = $1 AND description_key = ANY($2)`,
		userID, pq.Array(keys),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]*domain.UserTagRule, len(keys))
	for rows.Next() {
		var h domain.UserTagRule
		if err := rows.Scan(&h.ID, &h.UserID, &h.DescriptionKey, pq.Array(&h.Tags), &h.CustomDescription, &h.UseCount, &h.LastUsedAt); err != nil {
			return nil, err
		}
		result[h.DescriptionKey] = &h
	}
	return result, rows.Err()
}

func (r *userTagRuleRepo) Match(ctx context.Context, userID int64, descriptionKey string) (*domain.UserTagRule, error) {
	var h domain.UserTagRule
	err := r.db.QueryRowContext(ctx,
		`SELECT id, user_id, description_key, tags, custom_description, use_count, last_used_at
		   FROM user_tag_rules
		  WHERE user_id = $1 AND description_key = $2`,
		userID, descriptionKey,
	).Scan(&h.ID, &h.UserID, &h.DescriptionKey, pq.Array(&h.Tags), &h.CustomDescription, &h.UseCount, &h.LastUsedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &h, nil
}

func (r *userTagRuleRepo) PopularUnmatched(ctx context.Context, userID int64, limit int) ([]domain.UserTagRule, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, user_id, description_key, tags, custom_description, use_count, last_used_at
		   FROM user_tag_rules
		  WHERE user_id = $1
		    AND NOT EXISTS (
		        SELECT 1 FROM app_tag_rules r
		         WHERE user_tag_rules.description_key LIKE '%' || r.pattern || '%'
		    )
		  ORDER BY use_count DESC
		  LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []domain.UserTagRule
	for rows.Next() {
		var h domain.UserTagRule
		if err := rows.Scan(&h.ID, &h.UserID, &h.DescriptionKey, pq.Array(&h.Tags), &h.CustomDescription, &h.UseCount, &h.LastUsedAt); err != nil {
			return nil, err
		}
		entries = append(entries, h)
	}
	return entries, rows.Err()
}
