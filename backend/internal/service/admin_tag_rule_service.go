package service

import (
	"context"

	"arasaka/internal/domain"
)

type AdminTagRuleService struct {
	rules     domain.AppTagRuleRepository
	userRules domain.UserTagRuleRepository
}

func NewAdminTagRuleService(rules domain.AppTagRuleRepository, history domain.UserTagRuleRepository) *AdminTagRuleService {
	return &AdminTagRuleService{rules: rules, userRules: history}
}

func (s *AdminTagRuleService) ListRules(ctx context.Context) ([]domain.AppTagRule, error) {
	rules, err := s.rules.List(ctx)
	if rules == nil {
		rules = []domain.AppTagRule{}
	}
	return rules, err
}

func (s *AdminTagRuleService) CreateRule(ctx context.Context, pattern string, tags []string) (domain.AppTagRule, error) {
	return s.rules.Create(ctx, pattern, tags)
}

func (s *AdminTagRuleService) DeleteRule(ctx context.Context, id int64) error {
	return s.rules.Delete(ctx, id)
}

func (s *AdminTagRuleService) PopularUnmatched(ctx context.Context, userID int64, limit int) ([]domain.UserTagRule, error) {
	if limit <= 0 {
		limit = 20
	}
	entries, err := s.userRules.PopularUnmatched(ctx, userID, limit)
	if entries == nil {
		entries = []domain.UserTagRule{}
	}
	return entries, err
}
