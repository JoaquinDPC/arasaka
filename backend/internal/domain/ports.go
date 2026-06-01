// Package domain defines the core business interfaces (ports) for the
// hexagonal architecture. Each interface here is an outbound port: a contract
// the domain requires from the outside world (database, external services, etc.)
// without knowing the concrete implementation. The actual implementations
// (adapters) live in internal/repository/.
package domain

import (
	"context"
	"time"
)

// UserRepository is the port for user persistence.
type UserRepository interface {
	GetByEmail(ctx context.Context, email string) (User, error)
	GetByID(ctx context.Context, id int64) (User, error)
	Create(ctx context.Context, email, passwordHash string) (User, error)
}

// AccountDeletePreview holds the count of records that will be removed when an account is deleted.
type AccountDeletePreview struct {
	Transactions int `json:"transactions"`
	CCBills      int `json:"cc_bills"`
	CCItems      int `json:"cc_items"`
}

// AccountRepository is the port for account persistence.
type AccountRepository interface {
	List(ctx context.Context, userID int64) ([]Account, error)
	GetByID(ctx context.Context, id int64, userID int64) (Account, error)
	Create(ctx context.Context, p CreateAccountParams) (Account, error)
	Update(ctx context.Context, id int64, userID int64, p UpdateAccountParams) (Account, error)
	Delete(ctx context.Context, id int64, userID int64) error
	DeletePreview(ctx context.Context, id int64, userID int64) (AccountDeletePreview, error)
	DeleteCascade(ctx context.Context, id int64, userID int64) error
}

// DedupCandidate is a lightweight transaction projection used for cross-source
// deduplication when importing PDFs against existing bank_json records.
type DedupCandidate struct {
	Date        time.Time
	Amount      int64
	Flow        string
	Description string
	Source      string
}

// TransactionRepository is the port for transaction persistence.
type TransactionRepository interface {
	List(ctx context.Context, f TransactionFilter) ([]Transaction, error)
	GetByID(ctx context.Context, id int64, userID int64) (Transaction, error)
	Create(ctx context.Context, p CreateTransactionParams) (Transaction, error)
	Update(ctx context.Context, id int64, userID int64, p UpdateTransactionParams) (Transaction, error)
	Delete(ctx context.Context, id int64, userID int64) error
	// CreateBatch inserts transactions with deduplication; returns imported + duplicates counts.
	CreateBatch(ctx context.Context, params []CreateTransactionParams) (imported, duplicates int, err error)
	// TagSpending returns per-tag expense totals for the given user and period.
	// month=0 means full year. accountID=nil means all accounts.
	TagSpending(ctx context.Context, userID int64, year, month int, accountID *int64) ([]TagSummary, error)
	// UpsertOpeningBalance inserts or updates the single OPENING transaction for an account.
	// If amount == 0, the existing OPENING transaction is deleted instead.
	UpsertOpeningBalance(ctx context.Context, accountID, userID, amount int64) error
	// LatestBankDate returns the most recent date of a bank_json transaction for the account.
	// Returns (zero, false, nil) when no such transaction exists.
	LatestBankDate(ctx context.Context, accountID int64) (time.Time, bool, error)
	// DedupCandidates returns transactions (bank_json and pdf) for accountID in a
	// ±2-day window around [minDate, maxDate], used for cross-source dedup on PDF import.
	DedupCandidates(ctx context.Context, accountID int64, minDate, maxDate time.Time) ([]DedupCandidate, error)
}

// UserTagRepository is the port for user-defined tag persistence.
type UserTagRepository interface {
	ListByUserID(ctx context.Context, userID int64) ([]string, error)
	// ListWithIcons returns the user's tags with optional icon and color overrides.
	ListWithIcons(ctx context.Context, userID int64) ([]UserTagEntry, error)
	// ListMostUsed returns the top `limit` tags ordered by usage_count DESC.
	ListMostUsed(ctx context.Context, userID int64, limit int) ([]string, error)
	Upsert(ctx context.Context, userID int64, tag string) error
	UpsertBatch(ctx context.Context, userID int64, tags []string) error
	// DecrementBatch decrements usage_count for each tag (floor 0).
	DecrementBatch(ctx context.Context, userID int64, tags []string) error
	// SetIcon sets or clears the icon override for a tag (empty string clears it).
	SetIcon(ctx context.Context, userID int64, tag, icon string) error
	// SetColor sets or clears the color override for a tag (empty string clears it).
	SetColor(ctx context.Context, userID int64, tag, color string) error
	// Delete removes a tag from the user's personal vocabulary.
	Delete(ctx context.Context, userID int64, tag string) error
}

// TagBudgetRepository is the port for per-tag spending limits.
type TagBudgetRepository interface {
	List(ctx context.Context, userID int64, year int) ([]TagBudget, error)
	Upsert(ctx context.Context, b TagBudget) error
	// Delete removes all budget entries for a tag across all years/months.
	Delete(ctx context.Context, userID int64, tag string) error
}

// CreditCardRepository handles persistence for CC bills and their line items.
type CreditCardRepository interface {
	UpsertBill(ctx context.Context, p CreateCCBillParams) (CreditCardBill, error)
	CreateItemsBatch(ctx context.Context, items []CreateCCItemParams) (imported, duplicates int, err error)
	UpdateBillTotal(ctx context.Context, id int64, userID int64, total int64) error
	ListBills(ctx context.Context, userID int64, accountID int64) ([]CreditCardBill, error)
	GetBillByID(ctx context.Context, id int64, userID int64) (CreditCardBill, error)
	// LinkAllBills bulk-links unlinked bank transactions to CC bills for the given user
	// and account. bankID selects the description pattern; SQL params are userID + accountID only.
	// Uses amount matching (CLP) or due-date proximity (USD). Safe to call repeatedly.
	LinkAllBills(ctx context.Context, userID int64, accountID int64, bankID BankID) error
}

// AppTagRuleRepository is the port for global description-to-tag inference rules.
type AppTagRuleRepository interface {
	// MatchDescription returns rules whose pattern is a substring of normalizedDesc.
	MatchDescription(ctx context.Context, normalizedDesc string) ([]AppTagRule, error)
	List(ctx context.Context) ([]AppTagRule, error)
	Create(ctx context.Context, pattern string, tags []string) (AppTagRule, error)
	Delete(ctx context.Context, id int64) error
}

// UserTagRuleRepository is the port for behavioral tag and custom_description learning per user.
type UserTagRuleRepository interface {
	// Upsert records or updates a description-to-tag and description-to-custom_description mapping, incrementing use_count.
	// customDescription nil leaves any existing custom_description value unchanged.
	Upsert(ctx context.Context, userID int64, descriptionKey string, tags []string, customDescription *string) error
	// Match returns the rule entry for an exact description_key, or nil if not found.
	Match(ctx context.Context, userID int64, descriptionKey string) (*UserTagRule, error)
	// MatchBatch returns a map of description_key → rule for all keys that have a match.
	MatchBatch(ctx context.Context, userID int64, keys []string) (map[string]*UserTagRule, error)
	// PopularUnmatched returns the top `limit` rule entries by use_count for userID
	// that are not already covered by any app_tag_rule pattern.
	PopularUnmatched(ctx context.Context, userID int64, limit int) ([]UserTagRule, error)
}

// ReportRepository is the port for complex read-only aggregations.
// userID scopes all results to the authenticated user.
// accountID further filters to a single account when non-nil; nil means all accounts for that user.
type ReportRepository interface {
	MonthlyTotals(ctx context.Context, userID int64, year, month int, accountID *int64) (income, expenses, investments int64, err error)
	// TagTotals returns expense totals grouped by tag for a given month, joined with tag_budgets.
	TagTotals(ctx context.Context, userID int64, year, month int, accountID *int64) ([]CategorySummary, error)
	TopExpenses(ctx context.Context, userID int64, year, month, limit int, accountID *int64) ([]Transaction, error)
	YearlyKPIs(ctx context.Context, userID int64, year int, accountID *int64) (opening, income, expenses, investments int64, err error)
	MonthlyTrend(ctx context.Context, userID int64, year int, accountID *int64) ([]MonthlyReport, error)
	MonthlyHistory(ctx context.Context, userID int64, year, beforeMonth int, accountID *int64) ([]MonthlyReport, error)
	YearlyTagTotals(ctx context.Context, userID int64, year int, accountID *int64) ([]CategorySummary, error)
	YearlyTopExpenses(ctx context.Context, userID int64, year, limit int, accountID *int64) ([]Transaction, error)
	AllTimeTagTotals(ctx context.Context, userID int64, accountID *int64) ([]CategorySummary, error)
	ActiveInstallments(ctx context.Context, userID int64) ([]CreditCardItem, error)
}
