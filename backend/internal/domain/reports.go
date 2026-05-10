package domain

// reports.go defines read-only aggregated view models and response DTOs.
// These types are produced by the report and inference layers and are
// never persisted directly.

// MonthlyReport aggregates data for a single month.
type MonthlyReport struct {
	Month       int               `json:"month"`
	Year        int               `json:"year"`
	Income      int64             `json:"income"`
	Expenses    int64             `json:"expenses"`
	Investments int64             `json:"investments"`
	Balance     int64             `json:"balance"`
	SavingsRate float64           `json:"savings_rate"`
	ByCategory  []CategorySummary `json:"by_category"`
	BySubtype   map[string]int64  `json:"by_subtype"`
	TopExpenses []Transaction     `json:"top_expenses"`
}

type CategorySummary struct {
	Category     string  `json:"category"`
	Total        int64   `json:"total"`
	Budget       int64   `json:"budget"`
	PctUsed      float64 `json:"pct_used"`
	Transactions int     `json:"transactions"`
}

// TagSummary aggregates expense totals per tag for a given user and period.
type TagSummary struct {
	Tag          string `json:"tag"`
	Total        int64  `json:"total"`
	Transactions int    `json:"transactions"`
}

type KPIReport struct {
	CashBalance    int64   `json:"cash_balance"`
	NetWorth       int64   `json:"net_worth"`
	IncomeYTD      int64   `json:"income_ytd"`
	ExpensesYTD    int64   `json:"expenses_ytd"`
	InvestmentsYTD int64   `json:"investments_ytd"`
	InvestmentRate float64 `json:"investment_rate"`
	CostOfLiving   float64 `json:"cost_of_living"`
	FixedExpenses  int64   `json:"fixed_expenses"`
}

type Insight struct {
	Type     string `json:"type"`
	Category string `json:"category,omitempty"`
	Message  string `json:"message"`
}

// AnnualReport aggregates all financial data for a full calendar year.
type AnnualReport struct {
	Year               int               `json:"year"`
	KPIs               KPIReport         `json:"kpis"`
	MonthlyTrend       []MonthlyReport   `json:"monthly_trend"`
	CategoryTotals     []CategorySummary `json:"category_totals"`
	TopExpenses        []Transaction     `json:"top_expenses"`
	Projection         int64             `json:"projection"`
	ActiveInstallments []CreditCardItem  `json:"active_installments"`
}

type ImportResult struct {
	Imported   int `json:"imported"`
	Duplicates int `json:"duplicates"`
}

// TagSuggestion is one inferred tag with its source level.
type TagSuggestion struct {
	Tag    string `json:"tag"`
	Source string `json:"source"` // "personal" | "app"
}

// InferTagsResult groups all suggestions for a given description.
type InferTagsResult struct {
	Description string          `json:"description"`
	Suggestions []TagSuggestion `json:"suggestions"`
	KeyUser     *string         `json:"key_user,omitempty"`
}
