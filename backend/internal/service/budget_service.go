package service

import (
	"context"

	"arasaka/internal/domain"
)

// BudgetService handles business logic for budget targets.
type BudgetService struct {
	budgets    domain.BudgetRepository
	userTags   domain.UserTagRepository
	tagBudgets domain.TagBudgetRepository
}

func NewBudgetService(budgets domain.BudgetRepository, userTags domain.UserTagRepository, tagBudgets domain.TagBudgetRepository) *BudgetService {
	return &BudgetService{budgets: budgets, userTags: userTags, tagBudgets: tagBudgets}
}

func (s *BudgetService) ListBudgets(ctx context.Context, userID int64, year string) ([]domain.Budget, error) {
	return s.budgets.List(ctx, userID, year)
}

func (s *BudgetService) UpsertBudget(ctx context.Context, b domain.Budget) (domain.Budget, error) {
	return s.budgets.Upsert(ctx, b)
}

func (s *BudgetService) UpsertBatch(ctx context.Context, budgets []domain.Budget) error {
	return s.budgets.UpsertBatch(ctx, budgets)
}

func (s *BudgetService) ListCategories(ctx context.Context) ([]string, error) {
	return s.budgets.ListCategories(ctx)
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
