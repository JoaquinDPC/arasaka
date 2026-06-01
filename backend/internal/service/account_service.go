package service

import (
	"context"

	"arasaka/internal/domain"
)

// AccountService handles business logic for bank accounts.
type AccountService struct {
	repo   domain.AccountRepository
	txRepo domain.TransactionRepository
}

func NewAccountService(repo domain.AccountRepository, txRepo domain.TransactionRepository) *AccountService {
	return &AccountService{repo: repo, txRepo: txRepo}
}

func (s *AccountService) List(ctx context.Context, userID int64) ([]domain.Account, error) {
	return s.repo.List(ctx, userID)
}

func (s *AccountService) Create(ctx context.Context, p domain.CreateAccountParams) (domain.Account, error) {
	return s.repo.Create(ctx, p)
}

func (s *AccountService) Update(ctx context.Context, id int64, userID int64, p domain.UpdateAccountParams) (domain.Account, error) {
	return s.repo.Update(ctx, id, userID, p)
}

func (s *AccountService) GetByID(ctx context.Context, id int64, userID int64) (domain.Account, error) {
	return s.repo.GetByID(ctx, id, userID)
}

func (s *AccountService) Delete(ctx context.Context, id int64, userID int64) error {
	return s.repo.Delete(ctx, id, userID)
}

func (s *AccountService) DeletePreview(ctx context.Context, id int64, userID int64) (domain.AccountDeletePreview, error) {
	return s.repo.DeletePreview(ctx, id, userID)
}

func (s *AccountService) DeleteCascade(ctx context.Context, id int64, userID int64) error {
	return s.repo.DeleteCascade(ctx, id, userID)
}

func (s *AccountService) UpsertOpeningBalance(ctx context.Context, accountID, userID, amount int64) error {
	return s.txRepo.UpsertOpeningBalance(ctx, accountID, userID, amount)
}
