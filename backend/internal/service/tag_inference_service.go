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
	userRules   domain.UserTagRuleRepository
	accountRepo domain.AccountRepository
}

func NewTagInferenceService(
	appRules domain.AppTagRuleRepository,
	history domain.UserTagRuleRepository,
	accountRepo domain.AccountRepository,
) *TagInferenceService {
	return &TagInferenceService{appRules: appRules, userRules: history, accountRepo: accountRepo}
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

	key := normalizeDescription(description)
	seen := make(map[string]struct{})
	var suggestions []domain.TagSuggestion
	var customDescription *string

	if settings.PersonalTagInference {
		personalEntry, err := s.userRules.Match(ctx, userID, key)
		if err == nil && personalEntry != nil {
			customDescription = personalEntry.CustomDescription
			for _, tag := range personalEntry.Tags {
				if _, dup := seen[tag]; !dup {
					seen[tag] = struct{}{}
					suggestions = append(suggestions, domain.TagSuggestion{Tag: tag, Source: "personal"})
				}
			}
		}
	}

	if settings.AppTagInference {
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
// Records when source is "manual" and either tags are non-empty or (customDescription is non-nil and rememberDescription is true).
// Tags are always recorded; customDescription is only persisted when rememberDescription is true.
func (s *TagInferenceService) RecordTagAssignment(ctx context.Context, userID int64, description string, tags []string, customDescription *string, source string, rememberDescription bool) {
	if source != "manual" {
		return
	}
	if len(tags) == 0 && (customDescription == nil || !rememberDescription) {
		return
	}
	var cd *string
	if rememberDescription {
		cd = customDescription
	}
	key := normalizeDescription(description)
	_ = s.userRules.Upsert(ctx, userID, key, tags, cd)
}

// AutoTagBatch applies inference rules to untagged params using the provided account settings.
// settings comes from the caller (import pipeline) which already has the account.
// Executes at most 2 DB queries regardless of len(params).
func (s *TagInferenceService) AutoTagBatch(ctx context.Context, userID int64, settings domain.AccountSettings, params []domain.CreateTransactionParams) []domain.CreateTransactionParams {
	result := make([]domain.CreateTransactionParams, len(params))
	copy(result, params)

	// Collect normalized keys for batch lookup.
	keys := make([]string, len(params))
	for i, p := range params {
		keys[i] = normalizeDescription(p.Description)
	}

	// Single query for all personal history entries.
	historyMap, _ := s.userRules.MatchBatch(ctx, userID, keys)
	if historyMap == nil {
		historyMap = map[string]*domain.UserTagRule{}
	}

	// Single query for all app rules (loaded once, matched in-memory).
	var appRules []domain.AppTagRule
	if settings.AppTagInference {
		appRules, _ = s.appRules.List(ctx)
	}

	for i, p := range result {
		key := keys[i]
		historyEntry := historyMap[key]

		if len(p.Tags) == 0 {
			if settings.PersonalTagInference && historyEntry != nil && len(historyEntry.Tags) > 0 {
				result[i].Tags = historyEntry.Tags
			} else if settings.AppTagInference {
				seen := make(map[string]struct{})
				var tags []string
				for _, rule := range appRules {
					if strings.Contains(key, rule.Pattern) {
						for _, tag := range rule.Tags {
							if _, dup := seen[tag]; !dup {
								seen[tag] = struct{}{}
								tags = append(tags, tag)
							}
						}
					}
				}
				if len(tags) > 0 {
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
