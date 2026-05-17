package repository

import (
	"context"
	"database/sql"

	"github.com/lib/pq"

	"arasaka/internal/domain"
)

type appTagRuleRepo struct {
	db *sql.DB
}

func NewAppTagRuleRepository(db *sql.DB) domain.AppTagRuleRepository {
	return &appTagRuleRepo{db: db}
}

func (r *appTagRuleRepo) MatchDescription(ctx context.Context, normalizedDesc string) ([]domain.AppTagRule, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, pattern, tags, match_type
		   FROM app_tag_rules
		  WHERE $1 LIKE '%' || pattern || '%'`,
		normalizedDesc,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []domain.AppTagRule
	for rows.Next() {
		var rule domain.AppTagRule
		if err := rows.Scan(&rule.ID, &rule.Pattern, pq.Array(&rule.Tags), &rule.MatchType); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	return rules, rows.Err()
}

func (r *appTagRuleRepo) List(ctx context.Context) ([]domain.AppTagRule, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, pattern, tags, match_type FROM app_tag_rules ORDER BY pattern`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []domain.AppTagRule
	for rows.Next() {
		var rule domain.AppTagRule
		if err := rows.Scan(&rule.ID, &rule.Pattern, pq.Array(&rule.Tags), &rule.MatchType); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	return rules, rows.Err()
}

func (r *appTagRuleRepo) Create(ctx context.Context, pattern string, tags []string) (domain.AppTagRule, error) {
	var rule domain.AppTagRule
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO app_tag_rules (pattern, tags)
		 VALUES ($1, $2)
		 RETURNING id, pattern, tags, match_type`,
		pattern, pq.Array(tags),
	).Scan(&rule.ID, &rule.Pattern, pq.Array(&rule.Tags), &rule.MatchType)
	return rule, err
}

func (r *appTagRuleRepo) Delete(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM app_tag_rules WHERE id = $1`, id)
	return err
}
