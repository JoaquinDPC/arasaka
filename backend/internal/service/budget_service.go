package service

import (
	"context"

	"arasaka/internal/domain"
)

// BudgetService handles business logic for budget targets.
type BudgetService struct {
	budgets domain.BudgetRepository
}

func NewBudgetService(budgets domain.BudgetRepository) *BudgetService {
	return &BudgetService{budgets: budgets}
}

func (s *BudgetService) ListBudgets(ctx context.Context, year string) ([]domain.Budget, error) {
	return s.budgets.List(ctx, year)
}

func (s *BudgetService) UpsertBudget(ctx context.Context, b domain.Budget) (domain.Budget, error) {
	return s.budgets.Upsert(ctx, b)
}

func (s *BudgetService) UpsertBatch(ctx context.Context, budgets []domain.Budget) error {
	return s.budgets.UpsertBatch(ctx, budgets)
}
