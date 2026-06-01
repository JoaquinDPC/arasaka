package service

import (
	"context"

	"arasaka/internal/domain"
	"arasaka/internal/util"
)

// normalizeTransactionBatch applies the shared normalization pipeline to a batch of params:
// clean descriptions (bank-specific noise removal) then auto-tag (app rules + personal history).
// All future normalization steps belong here so both bank_json and PDF sources stay in sync.
func normalizeTransactionBatch(
	ctx context.Context,
	userID int64,
	bankID domain.BankID,
	settings domain.AccountSettings,
	params []domain.CreateTransactionParams,
	inferenceSvc *TagInferenceService,
) []domain.CreateTransactionParams {
	for i := range params {
		params[i].Description = util.CleanDescription(bankID, params[i].Description)
	}
	if inferenceSvc != nil {
		params = inferenceSvc.AutoTagBatch(ctx, userID, settings, params)
	}
	return params
}
