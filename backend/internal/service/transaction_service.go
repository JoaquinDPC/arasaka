package service

import (
	"context"
	"strings"
	"unicode"

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

// splitCamelCase inserts "-" before each uppercase letter preceded by a lowercase letter.
func splitCamelCase(s string) string {
	var b strings.Builder
	runes := []rune(s)
	for i, r := range runes {
		if i > 0 && unicode.IsUpper(r) && unicode.IsLower(runes[i-1]) {
			b.WriteRune('-')
		}
		b.WriteRune(r)
	}
	return b.String()
}

// toTagFormat normalizes a tag: split on spaces/hyphens/underscores and camelCase boundaries,
// lowercase all, join with "-", capitalize first letter only.
// e.g. "comidaMascota" → "Comida-mascota", "INVERSION" → "Inversion", "My Tag" → "My-tag"
func toTagFormat(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	s = splitCamelCase(s)
	words := strings.FieldsFunc(s, func(r rune) bool {
		return r == ' ' || r == '-' || r == '_'
	})
	if len(words) == 0 {
		return ""
	}
	result := strings.ToLower(strings.Join(words, "-"))
	runes := []rune(result)
	runes[0] = unicode.ToUpper(runes[0])
	return string(runes)
}

// normalizeTags converts tags to standard format, trims, and deduplicates.
func normalizeTags(tags []string) []string {
	seen := make(map[string]struct{}, len(tags))
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		t = toTagFormat(t)
		if t == "" {
			continue
		}
		if _, dup := seen[t]; dup {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	return out
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

func (s *TransactionService) Update(ctx context.Context, id int64, p domain.UpdateTransactionParams) (domain.Transaction, error) {
	if p.Tags != nil {
		normalized := normalizeTags(*p.Tags)
		p.Tags = &normalized
	}
	t, err := s.repo.Update(ctx, id, p)
	if err != nil {
		return t, err
	}
	if p.Tags != nil {
		s.upsertTags(ctx, t.UserID, t.Tags)
	}
	rememberDesc := p.RememberDescription != nil && *p.RememberDescription
	if s.inferenceSvc != nil && t.UserID != nil && (len(t.Tags) > 0 || (p.CustomDescription != nil && rememberDesc)) {
		s.inferenceSvc.RecordTagAssignment(ctx, *t.UserID, t.Description, t.Tags, t.CustomDescription, "manual", rememberDesc)
	}
	return t, nil
}

func (s *TransactionService) upsertTags(ctx context.Context, userID *int64, tags []string) {
	if userID == nil {
		return
	}
	for _, tag := range tags {
		_ = s.userTagRepo.Upsert(ctx, *userID, tag)
	}
}

func (s *TransactionService) Delete(ctx context.Context, id int64) error {
	return s.repo.Delete(ctx, id)
}

func (s *TransactionService) ListUsedTags(ctx context.Context, userID int64, limit int) ([]string, error) {
	return s.repo.ListUsedTags(ctx, userID, limit)
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

