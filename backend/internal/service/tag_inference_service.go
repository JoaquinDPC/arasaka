package service

import (
	"context"
	"regexp"
	"strings"

	"arasaka/internal/domain"
)

var nonAlphanumRe = regexp.MustCompile(`[^\w\s]`)

// normalizeDescription lowercases, strips punctuation, and collapses whitespace.
// "McDonald's Rancagua" → "mcdonalds rancagua"
func normalizeDescription(s string) string {
	s = strings.ToLower(s)
	s = nonAlphanumRe.ReplaceAllString(s, " ")
	return strings.Join(strings.Fields(s), " ")
}

// TagInferenceService provides two-level tag suggestions and batch auto-tagging.
type TagInferenceService struct {
	appRules domain.AppTagRuleRepository
	history  domain.UserTagHistoryRepository
	userRepo domain.UserRepository
}

func NewTagInferenceService(
	appRules domain.AppTagRuleRepository,
	history domain.UserTagHistoryRepository,
	userRepo domain.UserRepository,
) *TagInferenceService {
	return &TagInferenceService{appRules: appRules, history: history, userRepo: userRepo}
}

// InferTags returns tag and key_user suggestions for a description at both personal and app levels.
// Returns an empty result when inference is disabled for the user.
func (s *TagInferenceService) InferTags(ctx context.Context, userID int64, description string) (domain.InferTagsResult, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return domain.InferTagsResult{Description: description}, nil
	}
	settings := user.Settings

	if !settings.InferenceEnabled {
		return domain.InferTagsResult{Description: description, Suggestions: []domain.TagSuggestion{}}, nil
	}

	key := normalizeDescription(description)
	seen := make(map[string]struct{})
	var suggestions []domain.TagSuggestion
	var keyUser *string

	if settings.PersonalEnabled {
		entry, err := s.history.Match(ctx, userID, key)
		if err == nil && entry != nil {
			for _, tag := range entry.Tags {
				if _, dup := seen[tag]; !dup {
					seen[tag] = struct{}{}
					suggestions = append(suggestions, domain.TagSuggestion{Tag: tag, Source: "personal"})
				}
			}
			keyUser = entry.KeyUser
		}
	}

	if settings.AppEnabled {
		rules, err := s.appRules.MatchDescription(ctx, key)
		if err == nil {
			for _, rule := range rules {
				for _, tag := range rule.Tags {
					if _, dup := seen[tag]; !dup {
						seen[tag] = struct{}{}
						suggestions = append(suggestions, domain.TagSuggestion{Tag: tag, Source: "app"})
					}
				}
			}
		}
	}

	if suggestions == nil {
		suggestions = []domain.TagSuggestion{}
	}
	return domain.InferTagsResult{Description: description, Suggestions: suggestions, KeyUser: keyUser}, nil
}

// RecordTagAssignment learns from an explicit manual tag or key_user assignment.
// Records when source is "manual" and either tags are non-empty or keyUser is non-nil.
func (s *TagInferenceService) RecordTagAssignment(ctx context.Context, userID int64, description string, tags []string, keyUser *string, source string) {
	if source != "manual" {
		return
	}
	if len(tags) == 0 && keyUser == nil {
		return
	}
	key := normalizeDescription(description)
	_ = s.history.Upsert(ctx, userID, key, tags, keyUser)
}

// AutoTagBatch applies app-level rules to untagged params and personal history for key_user in a batch import.
// Respects the user's inference settings.
func (s *TagInferenceService) AutoTagBatch(ctx context.Context, userID int64, params []domain.CreateTransactionParams) []domain.CreateTransactionParams {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || !user.Settings.InferenceEnabled {
		return params
	}
	settings := user.Settings

	result := make([]domain.CreateTransactionParams, len(params))
	copy(result, params)

	for i, p := range result {
		key := normalizeDescription(p.Description)

		var historyEntry *domain.UserTagHistory
		if settings.PersonalEnabled {
			historyEntry, _ = s.history.Match(ctx, userID, key)
		}

		if len(p.Tags) == 0 {
			if historyEntry != nil && len(historyEntry.Tags) > 0 {
				result[i].Tags = historyEntry.Tags
			} else if settings.AppEnabled {
				rules, err := s.appRules.MatchDescription(ctx, key)
				if err == nil && len(rules) > 0 {
					seen := make(map[string]struct{})
					var tags []string
					for _, rule := range rules {
						for _, tag := range rule.Tags {
							if _, dup := seen[tag]; !dup {
								seen[tag] = struct{}{}
								tags = append(tags, tag)
							}
						}
					}
					result[i].Tags = tags
				}
			}
		}

		if p.KeyUser == nil && historyEntry != nil && historyEntry.KeyUser != nil {
			result[i].KeyUser = historyEntry.KeyUser
		}
	}
	return result
}
