package service

import (
	"context"
	"strings"
	"unicode"

	"arasaka/internal/domain"
)

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

// TagService handles business logic for user tags and per-tag budgets.
type TagService struct {
	userTags   domain.UserTagRepository
	tagBudgets domain.TagBudgetRepository
}

func NewTagService(userTags domain.UserTagRepository, tagBudgets domain.TagBudgetRepository) *TagService {
	return &TagService{userTags: userTags, tagBudgets: tagBudgets}
}

func (s *TagService) ListUserTags(ctx context.Context, userID int64) ([]string, error) {
	return s.userTags.ListByUserID(ctx, userID)
}

func (s *TagService) SaveUserTag(ctx context.Context, userID int64, tag string) error {
	normalized := toTagFormat(tag)
	if normalized == "" {
		return nil
	}
	return s.userTags.Upsert(ctx, userID, normalized)
}

func (s *TagService) ListUserTagsWithIcons(ctx context.Context, userID int64) ([]domain.UserTagEntry, error) {
	return s.userTags.ListWithIcons(ctx, userID)
}

func (s *TagService) SetTagIcon(ctx context.Context, userID int64, tag, icon string) error {
	normalized := toTagFormat(tag)
	if normalized == "" {
		return nil
	}
	return s.userTags.SetIcon(ctx, userID, normalized, icon)
}

func (s *TagService) SetTagColor(ctx context.Context, userID int64, tag, color string) error {
	normalized := toTagFormat(tag)
	if normalized == "" {
		return nil
	}
	return s.userTags.SetColor(ctx, userID, normalized, color)
}

func (s *TagService) DeleteUserTag(ctx context.Context, userID int64, tag string) error {
	return s.userTags.Delete(ctx, userID, tag)
}

func (s *TagService) ListTagBudgets(ctx context.Context, userID int64, year int) ([]domain.TagBudget, error) {
	return s.tagBudgets.List(ctx, userID, year)
}

func (s *TagService) UpsertTagBudget(ctx context.Context, b domain.TagBudget) error {
	return s.tagBudgets.Upsert(ctx, b)
}
