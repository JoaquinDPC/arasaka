package service

import (
	"context"

	"arasaka/internal/domain"
)

// AccountService handles business logic for bank accounts.
type AccountService struct {
	repo domain.AccountRepository
}

func NewAccountService(repo domain.AccountRepository) *AccountService {
	return &AccountService{repo: repo}
}

func (s *AccountService) List(ctx context.Context, userID int64) ([]domain.Account, error) {
	return s.repo.List(ctx, userID)
}

func (s *AccountService) Create(ctx context.Context, p domain.CreateAccountParams) (domain.Account, error) {
	return s.repo.Create(ctx, p)
}

func (s *AccountService) Update(ctx context.Context, id int64, p domain.UpdateAccountParams) (domain.Account, error) {
	return s.repo.Update(ctx, id, p)
}

func (s *AccountService) Delete(ctx context.Context, id int64) error {
	return s.repo.Delete(ctx, id)
}
