package service

import (
	"context"
	"strings"
	"unicode"

	"arasaka/internal/domain"
)

// TransactionService handles business logic for transactions.
type TransactionService struct {
	repo domain.TransactionRepository
}

func NewTransactionService(repo domain.TransactionRepository) *TransactionService {
	return &TransactionService{repo: repo}
}

// titleCase converts a string to title case: each word's first letter uppercased, rest lowercased.
// e.g. "CASA" → "Casa", "sin categoría" → "Sin Categoría"
func titleCase(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		runes := []rune(w)
		for j, r := range runes {
			if j == 0 {
				runes[j] = unicode.ToUpper(r)
			} else {
				runes[j] = unicode.ToLower(r)
			}
		}
		words[i] = string(runes)
	}
	return strings.Join(words, " ")
}

func (s *TransactionService) List(ctx context.Context, f domain.TransactionFilter) ([]domain.Transaction, error) {
	return s.repo.List(ctx, f)
}

func (s *TransactionService) Create(ctx context.Context, p domain.CreateTransactionParams) (domain.Transaction, error) {
	p.Category = titleCase(p.Category)
	return s.repo.Create(ctx, p)
}

func (s *TransactionService) Update(ctx context.Context, id int64, p domain.UpdateTransactionParams) (domain.Transaction, error) {
	if p.Category != nil {
		normalized := titleCase(*p.Category)
		p.Category = &normalized
	}
	return s.repo.Update(ctx, id, p)
}

func (s *TransactionService) Delete(ctx context.Context, id int64) error {
	return s.repo.Delete(ctx, id)
}
