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
	appRules    domain.AppTagRuleRepository
	history     domain.UserTagHistoryRepository
	accountRepo domain.AccountRepository
}

func NewTagInferenceService(
	appRules domain.AppTagRuleRepository,
	history domain.UserTagHistoryRepository,
	accountRepo domain.AccountRepository,
) *TagInferenceService {
	return &TagInferenceService{appRules: appRules, history: history, accountRepo: accountRepo}
}

// InferTags returns tag and custom_description suggestions for a description.
// accountID scopes the inference settings to the target account.
// Returns an empty result when inference is disabled for the account.
func (s *TagInferenceService) InferTags(ctx context.Context, userID, accountID int64, description string) (domain.InferTagsResult, error) {
	account, err := s.accountRepo.GetByID(ctx, accountID, userID)
	if err != nil {
		return domain.InferTagsResult{Description: description}, nil
	}
	settings := account.Settings

	if !settings.InferenceEnabled {
		return domain.InferTagsResult{Description: description, Suggestions: []domain.TagSuggestion{}}, nil
	}

	key := normalizeDescription(description)
	seen := make(map[string]struct{})
	var suggestions []domain.TagSuggestion
	var customDescription *string

	if settings.PersonalEnabled {
		entry, err := s.history.Match(ctx, userID, key)
		if err == nil && entry != nil {
			for _, tag := range entry.Tags {
				if _, dup := seen[tag]; !dup {
					seen[tag] = struct{}{}
					suggestions = append(suggestions, domain.TagSuggestion{Tag: tag, Source: "personal"})
				}
			}
			customDescription = entry.CustomDescription
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
	return domain.InferTagsResult{Description: description, Suggestions: suggestions, CustomDescription: customDescription}, nil
}

// RecordTagAssignment learns from an explicit manual tag or custom_description assignment.
// Records when source is "manual" and either tags are non-empty or customDescription is non-nil.
func (s *TagInferenceService) RecordTagAssignment(ctx context.Context, userID int64, description string, tags []string, customDescription *string, source string) {
	if source != "manual" {
		return
	}
	if len(tags) == 0 && customDescription == nil {
		return
	}
	key := normalizeDescription(description)
	_ = s.history.Upsert(ctx, userID, key, tags, customDescription)
}

// AutoTagBatch applies inference rules to untagged params using the provided account settings.
// settings comes from the caller (import pipeline) which already has the account.
func (s *TagInferenceService) AutoTagBatch(ctx context.Context, userID int64, settings domain.AccountSettings, params []domain.CreateTransactionParams) []domain.CreateTransactionParams {
	if !settings.InferenceEnabled {
		return params
	}

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

		if p.CustomDescription == nil && historyEntry != nil && historyEntry.CustomDescription != nil {
			result[i].CustomDescription = historyEntry.CustomDescription
		}
	}
	return result
}
