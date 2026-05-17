package service

import (
	"context"

	"arasaka/internal/domain"
)

// BudgetService handles business logic for tag budgets and user tags.
type BudgetService struct {
	userTags   domain.UserTagRepository
	tagBudgets domain.TagBudgetRepository
}

func NewBudgetService(userTags domain.UserTagRepository, tagBudgets domain.TagBudgetRepository) *BudgetService {
	return &BudgetService{userTags: userTags, tagBudgets: tagBudgets}
}

func (s *BudgetService) ListUserTags(ctx context.Context, userID int64) ([]string, error) {
	return s.userTags.ListByUserID(ctx, userID)
}

func (s *BudgetService) SaveUserTag(ctx context.Context, userID int64, tag string) error {
	normalized := toTagFormat(tag)
	if normalized == "" {
		return nil
	}
	return s.userTags.Upsert(ctx, userID, normalized)
}

func (s *BudgetService) ListUserTagsWithIcons(ctx context.Context, userID int64) ([]domain.UserTagEntry, error) {
	return s.userTags.ListWithIcons(ctx, userID)
}

func (s *BudgetService) SetTagIcon(ctx context.Context, userID int64, tag, icon string) error {
	return s.userTags.SetIcon(ctx, userID, tag, icon)
}

func (s *BudgetService) DeleteUserTag(ctx context.Context, userID int64, tag string) error {
	return s.userTags.Delete(ctx, userID, tag)
}

func (s *BudgetService) ListTagBudgets(ctx context.Context, userID int64, year int) ([]domain.TagBudget, error) {
	return s.tagBudgets.List(ctx, userID, year)
}

func (s *BudgetService) UpsertTagBudget(ctx context.Context, b domain.TagBudget) error {
	return s.tagBudgets.Upsert(ctx, b)
}
