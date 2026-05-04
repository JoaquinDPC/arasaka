package domain

import "time"

// User is an authenticated principal that owns one or more accounts.
type User struct {
	ID           int64     `json:"id"         db:"id"`
	Email        string    `json:"email"      db:"email"`
	PasswordHash string    `json:"-"          db:"password_hash"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// Account represents a bank account.
type Account struct {
	ID            int64      `json:"id"             db:"id"`
	UserID        int64      `json:"user_id"        db:"user_id"`
	BankID        string     `json:"bank_id"        db:"bank_id"`
	Name          string     `json:"name"           db:"name"`
	Type          string     `json:"type"           db:"type"`
	Currency      string     `json:"currency"       db:"currency"`
	Balance       int64      `json:"balance"`
	MovementCount int        `json:"movement_count"`
	LastMovement  *time.Time `json:"last_movement"`
	CreatedAt     time.Time  `json:"created_at"     db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"     db:"updated_at"`
}

type CreateAccountParams struct {
	UserID   int64
	BankID   string
	Name     string
	Type     string
	Currency string
}

type UpdateAccountParams struct {
	BankID *string
	Name   *string
	Type   *string
}

// Transaction is the core financial record.
// Amount is always positive; direction encoded in Flow.
type Transaction struct {
	ID             int64     `json:"id"                        db:"id"`
	Date           time.Time `json:"date"                      db:"date"`
	Description    string    `json:"description"               db:"description"`
	Category       string    `json:"category"                  db:"category"`
	Flow           string    `json:"flow"                      db:"flow"`
	Subtype        *string   `json:"subtype,omitempty"         db:"subtype"`
	Asset          *string   `json:"asset,omitempty"           db:"asset"`
	KeyUser        *string   `json:"key_user,omitempty"        db:"key_user"`
	Quantity       *float64  `json:"quantity,omitempty"        db:"quantity"`
	Amount         int64     `json:"amount"                    db:"amount"`
	Notes          *string   `json:"notes,omitempty"           db:"notes"`
	Source         string    `json:"source"                    db:"source"`
	BankRawID      *string   `json:"-"                         db:"bank_raw_id"`
	Currency       string    `json:"currency"                  db:"currency"`
	CCStatementID  *int64    `json:"cc_statement_id,omitempty" db:"cc_statement_id"`
	AccountID      *int64    `json:"account_id,omitempty"      db:"account_id"`
	Tags           []string  `json:"tags"                      db:"tags"`
	RunningBalance *int64    `json:"running_balance,omitempty" db:"running_balance"`
	CreatedAt      time.Time `json:"created_at"                db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"                db:"updated_at"`
	UserID         *int64    `json:"user_id,omitempty"         db:"user_id"`
}

// TransactionFilter holds optional query filters for listing transactions.
type TransactionFilter struct {
	Year      string
	Month     string
	Category  string
	Flow      string
	AccountID string
	Tags      []string // AND filter: rows must contain all listed tags (tags @> ARRAY[...])
	Limit     int      // 0 means use default (1000)
}

// CreateTransactionParams carries the data needed to create a new transaction.
type CreateTransactionParams struct {
	Date        time.Time
	Description string
	Category    string
	Flow        string
	Subtype     *string
	Asset       *string
	KeyUser     *string
	Quantity    *float64
	Amount      int64
	Notes       *string
	Source      string
	BankRawID   *string
	Currency    string   // defaults to "CLP" when empty
	AccountID   *int64
	Tags        []string // hashtag labels, e.g. ["#streaming", "#annual"]
	UserID      *int64
}

// UpdateTransactionParams carries the optional fields for a partial update.
type UpdateTransactionParams struct {
	Date        *time.Time
	Description *string
	Category    *string
	Flow        *string
	Subtype     *string
	Asset       *string
	KeyUser     *string
	Quantity    *float64
	Amount      *int64
	Notes       *string
	Tags        *[]string
}

type Budget struct {
	ID        int64  `json:"id"                   db:"id"`
	UserID    int64  `json:"user_id"              db:"user_id"`
	Category  string `json:"category"             db:"category"`
	Year      int    `json:"year"                 db:"year"`
	Month     int    `json:"month"                db:"month"`
	Amount    int64  `json:"amount"               db:"amount"`
	AccountID *int64 `json:"account_id,omitempty" db:"account_id"`
}

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

// TagBudget is a spending limit set by the user for a specific tag.
type TagBudget struct {
	ID     int64  `json:"id"      db:"id"`
	UserID int64  `json:"user_id" db:"user_id"`
	Tag    string `json:"tag"     db:"tag"`
	Year   int    `json:"year"    db:"year"`
	Month  int    `json:"month"   db:"month"`
	Amount int64  `json:"amount"  db:"amount"`
}

// UserTagEntry is a user-curated tag with an optional icon override.
type UserTagEntry struct {
	Tag  string  `json:"tag"`
	Icon *string `json:"icon,omitempty"`
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

// CreditCardStatement represents a single billing cycle for a credit card account.
type CreditCardStatement struct {
	ID                 int64            `json:"id"                    db:"id"`
	ExternalAccountID  string           `json:"external_account_id"   db:"external_account_id"`
	PeriodFrom         time.Time        `json:"period_from"           db:"period_from"`
	PeriodTo           time.Time        `json:"period_to"             db:"period_to"`
	DueDate            *time.Time       `json:"due_date"              db:"due_date"`
	Currency           string           `json:"currency"              db:"currency"`
	TotalAmount        int64            `json:"total_amount"          db:"total_amount"`
	MinPayment         int64            `json:"min_payment"           db:"min_payment"`
	AccountID          *int64           `json:"account_id,omitempty"  db:"account_id"`
	UserID             *int64           `json:"user_id,omitempty"     db:"user_id"`
	Items              []CreditCardItem `json:"items,omitempty"`
	CreatedAt          time.Time        `json:"created_at"            db:"created_at"`
}

// CreditCardItem is a single line on a credit card statement.
type CreditCardItem struct {
	ID                 int64     `json:"id"                            db:"id"`
	StatementID        int64     `json:"statement_id"                  db:"statement_id"`
	Date               time.Time `json:"date"                          db:"date"`
	Description        string    `json:"description"                   db:"description"`
	Amount             int64     `json:"amount"                        db:"amount"`
	Currency           string    `json:"currency"                      db:"currency"`
	InstallmentCurrent *int      `json:"installment_current,omitempty" db:"installment_current"`
	InstallmentTotal   *int      `json:"installment_total,omitempty"   db:"installment_total"`
	ItemType           string    `json:"item_type"                     db:"item_type"`
	BankRawID          *string   `json:"-"                             db:"bank_raw_id"`
	AccountID          *int64    `json:"account_id,omitempty"          db:"account_id"`
	UserID             *int64    `json:"user_id,omitempty"             db:"user_id"`
	CreatedAt          time.Time `json:"created_at"                    db:"created_at"`
}

type CreateCCStatementParams struct {
	ExternalAccountID string
	PeriodFrom        time.Time
	PeriodTo          time.Time
	DueDate           *time.Time
	Currency          string
	TotalAmount       int64
	MinPayment        int64
	AccountID         *int64
	UserID            *int64
}

type CreateCCItemParams struct {
	StatementID        int64
	Date               time.Time
	Description        string
	Amount             int64
	Currency           string
	InstallmentCurrent *int
	InstallmentTotal   *int
	ItemType           string
	BankRawID          *string
	AccountID          *int64
	UserID             *int64
}
