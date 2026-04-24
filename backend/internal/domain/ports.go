package domain

import "context"

// AccountRepository is the port for account persistence.
type AccountRepository interface {
	List(ctx context.Context) ([]Account, error)
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
}

// BudgetRepository is the port for budget persistence.
type BudgetRepository interface {
	List(ctx context.Context, year string) ([]Budget, error)
	Upsert(ctx context.Context, b Budget) (Budget, error)
	UpsertBatch(ctx context.Context, budgets []Budget) error
	BudgetForCategory(ctx context.Context, category string, year, month int) (int64, error)
}

// CreditCardRepository handles persistence for CC statements and their line items.
type CreditCardRepository interface {
	UpsertStatement(ctx context.Context, p CreateCCStatementParams) (CreditCardStatement, error)
	CreateItemsBatch(ctx context.Context, items []CreateCCItemParams) (imported, duplicates int, err error)
	UpdateStatementTotal(ctx context.Context, id int64, total int64) error
	ListStatements(ctx context.Context) ([]CreditCardStatement, error)
	GetStatementByID(ctx context.Context, id int64) (CreditCardStatement, error)
}

// ReportRepository is the port for complex read-only aggregations.
type ReportRepository interface {
	MonthlyTotals(ctx context.Context, year, month int) (income, expenses, investments int64, err error)
	CategoryTotals(ctx context.Context, year, month int) ([]CategorySummary, error)
	SubtypeTotals(ctx context.Context, year, month int) (map[string]int64, error)
	TopExpenses(ctx context.Context, year, month, limit int) ([]Transaction, error)
	YearlyKPIs(ctx context.Context, year int) (opening, income, expenses, investments, fixed int64, err error)
	MonthlyTrend(ctx context.Context, year int) ([]MonthlyReport, error)
	BudgetVsActual(ctx context.Context, year, month int) ([]CategorySummary, error)
	MonthlyHistory(ctx context.Context, year, beforeMonth int) ([]MonthlyReport, error)
	YearlyCategoryTotals(ctx context.Context, year int) ([]CategorySummary, error)
	YearlyTopExpenses(ctx context.Context, year, limit int) ([]Transaction, error)
	AllTimeCategoryTotals(ctx context.Context) ([]CategorySummary, error)
	ActiveInstallments(ctx context.Context) ([]CreditCardItem, error)
}
