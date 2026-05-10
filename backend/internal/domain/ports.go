// Package domain defines the core business interfaces (ports) for the
// hexagonal architecture. Each interface here is an outbound port: a contract
// the domain requires from the outside world (database, external services, etc.)
// without knowing the concrete implementation. The actual implementations
// (adapters) live in internal/repository/.
package domain

import "context"

// UserRepository is the port for user persistence.
type UserRepository interface {
	GetByEmail(ctx context.Context, email string) (User, error)
	GetByID(ctx context.Context, id int64) (User, error)
	Create(ctx context.Context, email, passwordHash string) (User, error)
	UpdateSettings(ctx context.Context, userID int64, s UserSettings) error
}

// AccountRepository is the port for account persistence.
type AccountRepository interface {
	List(ctx context.Context, userID int64) ([]Account, error)
	Create(ctx context.Context, p CreateAccountParams) (Account, error)
	Update(ctx context.Context, id int64, p UpdateAccountParams) (Account, error)
	Delete(ctx context.Context, id int64) error
}

// TransactionRepository is the port for transaction persistence.
type TransactionRepository interface {
	List(ctx context.Context, f TransactionFilter) ([]Transaction, error)
	Create(ctx context.Context, p CreateTransactionParams) (Transaction, error)
	Update(ctx context.Context, id int64, p UpdateTransactionParams) (Transaction, error)
	Delete(ctx context.Context, id int64) error
	// CreateBatch inserts transactions with deduplication; returns imported + duplicates counts.
	CreateBatch(ctx context.Context, params []CreateTransactionParams) (imported, duplicates int, err error)
	// ListUsedTags returns the top `limit` tags by usage frequency for the given user.
	ListUsedTags(ctx context.Context, userID int64, limit int) ([]string, error)
	// TagSpending returns per-tag expense totals for the given user and period.
	// month=0 means full year. accountID=nil means all accounts.
	TagSpending(ctx context.Context, userID int64, year, month int, accountID *int64) ([]TagSummary, error)
}

// BudgetRepository is the port for budget persistence.
type BudgetRepository interface {
	List(ctx context.Context, userID int64, year string) ([]Budget, error)
	Upsert(ctx context.Context, b Budget) (Budget, error)
	UpsertBatch(ctx context.Context, budgets []Budget) error
	BudgetForCategory(ctx context.Context, userID int64, category string, year, month int) (int64, error)
	ListCategories(ctx context.Context) ([]string, error)
}

// UserTagRepository is the port for user-defined tag persistence.
type UserTagRepository interface {
	ListByUserID(ctx context.Context, userID int64) ([]string, error)
	// ListWithIcons returns the user's tags with optional icon overrides.
	ListWithIcons(ctx context.Context, userID int64) ([]UserTagEntry, error)
	Upsert(ctx context.Context, userID int64, tag string) error
	// SetIcon sets or clears the icon override for a tag (empty string clears it).
	SetIcon(ctx context.Context, userID int64, tag, icon string) error
	// Delete removes a tag from the user's personal vocabulary.
	Delete(ctx context.Context, userID int64, tag string) error
}

// TagBudgetRepository is the port for per-tag spending limits.
type TagBudgetRepository interface {
	List(ctx context.Context, userID int64, year int) ([]TagBudget, error)
	Upsert(ctx context.Context, b TagBudget) error
}

// CreditCardRepository handles persistence for CC statements and their line items.
type CreditCardRepository interface {
	UpsertStatement(ctx context.Context, p CreateCCStatementParams) (CreditCardStatement, error)
	CreateItemsBatch(ctx context.Context, items []CreateCCItemParams) (imported, duplicates int, err error)
	UpdateStatementTotal(ctx context.Context, id int64, total int64) error
	ListStatements(ctx context.Context) ([]CreditCardStatement, error)
	GetStatementByID(ctx context.Context, id int64) (CreditCardStatement, error)
}

// AppTagRuleRepository is the port for global description-to-tag inference rules.
type AppTagRuleRepository interface {
	// MatchDescription returns rules whose pattern is a substring of normalizedDesc.
	MatchDescription(ctx context.Context, normalizedDesc string) ([]AppTagRule, error)
}

// UserTagHistoryRepository is the port for behavioral tag and key_user learning per user.
type UserTagHistoryRepository interface {
	// Upsert records or updates a description-to-tag and description-to-key_user mapping, incrementing use_count.
	// keyUser nil leaves any existing key_user value unchanged.
	Upsert(ctx context.Context, userID int64, descriptionKey string, tags []string, keyUser *string) error
	// Match returns the history entry for an exact description_key, or nil if not found.
	Match(ctx context.Context, userID int64, descriptionKey string) (*UserTagHistory, error)
}

// ReportRepository is the port for complex read-only aggregations.
// accountID filters results to a single account when non-nil; nil means all accounts.
type ReportRepository interface {
	MonthlyTotals(ctx context.Context, year, month int, accountID *int64) (income, expenses, investments int64, err error)
	CategoryTotals(ctx context.Context, year, month int, accountID *int64) ([]CategorySummary, error)
	SubtypeTotals(ctx context.Context, year, month int, accountID *int64) (map[string]int64, error)
	TopExpenses(ctx context.Context, year, month, limit int, accountID *int64) ([]Transaction, error)
	YearlyKPIs(ctx context.Context, year int, accountID *int64) (opening, income, expenses, investments, fixed int64, err error)
	MonthlyTrend(ctx context.Context, year int, accountID *int64) ([]MonthlyReport, error)
	BudgetVsActual(ctx context.Context, year, month int, accountID *int64) ([]CategorySummary, error)
	MonthlyHistory(ctx context.Context, year, beforeMonth int, accountID *int64) ([]MonthlyReport, error)
	YearlyCategoryTotals(ctx context.Context, year int, accountID *int64) ([]CategorySummary, error)
	YearlyTopExpenses(ctx context.Context, year, limit int, accountID *int64) ([]Transaction, error)
	AllTimeCategoryTotals(ctx context.Context, accountID *int64) ([]CategorySummary, error)
	ActiveInstallments(ctx context.Context) ([]CreditCardItem, error)
}
