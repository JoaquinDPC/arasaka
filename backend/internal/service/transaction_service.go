package service

import (
	"context"

	"arasaka/internal/domain"
)

// TransactionService handles business logic for transactions.
type TransactionService struct {
	repo        domain.TransactionRepository
	userTagRepo domain.UserTagRepository
	inferenceSvc *TagInferenceService
}

func NewTransactionService(repo domain.TransactionRepository, userTagRepo domain.UserTagRepository, inferenceSvc *TagInferenceService) *TransactionService {
	return &TransactionService{repo: repo, userTagRepo: userTagRepo, inferenceSvc: inferenceSvc}
}

func (s *TransactionService) List(ctx context.Context, f domain.TransactionFilter) ([]domain.Transaction, error) {
	return s.repo.List(ctx, f)
}

func (s *TransactionService) Create(ctx context.Context, p domain.CreateTransactionParams) (domain.Transaction, error) {
	p.Tags = normalizeTags(p.Tags)
	t, err := s.repo.Create(ctx, p)
	if err != nil {
		return t, err
	}
	s.upsertTags(ctx, t.UserID, t.Tags)
	if s.inferenceSvc != nil && p.UserID != nil {
		s.inferenceSvc.RecordTagAssignment(ctx, *p.UserID, p.Description, t.Tags, p.CustomDescription, p.Source, p.RememberDescription)
	}
	return t, nil
}

func (s *TransactionService) Update(ctx context.Context, id int64, userID int64, p domain.UpdateTransactionParams) (domain.Transaction, error) {
	var oldTags []string
	if p.Tags != nil {
		old, err := s.repo.GetByID(ctx, id, userID)
		if err != nil {
			return domain.Transaction{}, err
		}
		oldTags = old.Tags
		normalized := normalizeTags(*p.Tags)
		p.Tags = &normalized
	}
	t, err := s.repo.Update(ctx, id, userID, p)
	if err != nil {
		return t, err
	}
	if p.Tags != nil {
		added := setDiff(t.Tags, oldTags)
		removed := setDiff(oldTags, t.Tags)
		s.upsertTags(ctx, t.UserID, added)
		if len(removed) > 0 && t.UserID != nil {
			_ = s.userTagRepo.DecrementBatch(ctx, *t.UserID, removed)
		}
	}
	rememberDesc := p.RememberDescription != nil && *p.RememberDescription
	if s.inferenceSvc != nil && t.UserID != nil && (len(t.Tags) > 0 || (p.CustomDescription != nil && rememberDesc)) {
		s.inferenceSvc.RecordTagAssignment(ctx, *t.UserID, t.Description, t.Tags, t.CustomDescription, "manual", rememberDesc)
	}
	return t, nil
}

func (s *TransactionService) upsertTags(ctx context.Context, userID *int64, tags []string) {
	if userID == nil || len(tags) == 0 {
		return
	}
	_ = s.userTagRepo.UpsertBatch(ctx, *userID, tags)
}

func (s *TransactionService) Delete(ctx context.Context, id int64, userID int64) error {
	t, err := s.repo.GetByID(ctx, id, userID)
	if err != nil {
		return err
	}
	if err := s.repo.Delete(ctx, id, userID); err != nil {
		return err
	}
	if t.UserID != nil && len(t.Tags) > 0 {
		_ = s.userTagRepo.DecrementBatch(ctx, *t.UserID, t.Tags)
	}
	return nil
}

func (s *TransactionService) ListUsedTags(ctx context.Context, userID int64, limit int) ([]string, error) {
	return s.userTagRepo.ListMostUsed(ctx, userID, limit)
}

func setDiff(a, b []string) []string {
	bSet := make(map[string]struct{}, len(b))
	for _, t := range b {
		bSet[t] = struct{}{}
	}
	var diff []string
	for _, t := range a {
		if _, ok := bSet[t]; !ok {
			diff = append(diff, t)
		}
	}
	return diff
}

func (s *TransactionService) TagSpending(ctx context.Context, userID int64, year, month int, accountID *int64) ([]domain.TagSummary, error) {
	return s.repo.TagSpending(ctx, userID, year, month, accountID)
}

func (s *TransactionService) CreateBatch(ctx context.Context, userID int64, accountID int64, params []domain.CreateTransactionParams) (imported, duplicates int, err error) {
	for i := range params {
		params[i].UserID = &userID
		params[i].AccountID = &accountID
		params[i].Tags = normalizeTags(params[i].Tags)
		if params[i].Source == "" {
			params[i].Source = "manual"
		}
	}
	return s.repo.CreateBatch(ctx, params)
}

