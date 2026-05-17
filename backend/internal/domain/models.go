package domain

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// models.go defines the core domain entities — types that have identity,
// are persisted, and represent real concepts in the system.
// For write params see commands.go, for filters see queries.go,
// for aggregated read results see reports.go.

// AccountSettings holds per-account configuration stored as JSONB on the accounts table.
type AccountSettings struct {
	AppTagInference      bool   `json:"app_tag_inference"`
	PersonalTagInference bool   `json:"personal_tag_inference"`
	MonthlySalary        int64  `json:"monthly_salary,omitempty"`
	PDFPassword          string `json:"pdf_password,omitempty"`
}

// Scan implements sql.Scanner for PostgreSQL JSONB → AccountSettings.
func (s *AccountSettings) Scan(src any) error {
	var b []byte
	switch v := src.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	case nil:
		*s = AccountSettings{AppTagInference: true, PersonalTagInference: true}
		return nil
	default:
		return fmt.Errorf("cannot scan %T into AccountSettings", src)
	}
	return json.Unmarshal(b, s)
}

// Value implements driver.Valuer for AccountSettings → PostgreSQL JSONB.
func (s AccountSettings) Value() (driver.Value, error) {
	b, err := json.Marshal(s)
	return string(b), err
}

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
	ID            int64           `json:"id"             db:"id"`
	UserID        int64           `json:"user_id"        db:"user_id"`
	BankID        BankID          `json:"bank_id"        db:"bank_id"`
	Name          string          `json:"name"           db:"name"`
	Type          string          `json:"type"           db:"type"`
	Currency      string          `json:"currency"       db:"currency"`
	Settings      AccountSettings `json:"settings"       db:"settings"`
	Balance       int64           `json:"balance"`
	MovementCount int             `json:"movement_count"`
	LastMovement  *time.Time      `json:"last_movement"`
	CreatedAt     time.Time       `json:"created_at"     db:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"     db:"updated_at"`
}

// Transaction is the core financial record.
// Amount is always positive; direction encoded in Flow.
type Transaction struct {
	ID                int64     `json:"id"                           db:"id"`
	Date              time.Time `json:"date"                         db:"date"`
	Description       string    `json:"description"                  db:"description"`
	Flow              string    `json:"flow"                         db:"flow"`
	CustomDescription *string   `json:"custom_description,omitempty" db:"custom_description"`
	Amount            int64     `json:"amount"                       db:"amount"`
	Notes             *string   `json:"notes,omitempty"              db:"notes"`
	Source            string    `json:"source"                       db:"source"`
	BankRawID         *string   `json:"-"                            db:"bank_raw_id"`
	Currency          string    `json:"currency"                     db:"currency"`
	CCStatementID     *int64    `json:"cc_statement_id,omitempty"    db:"cc_statement_id"`
	AccountID         *int64    `json:"account_id,omitempty"         db:"account_id"`
	Tags              []string  `json:"tags"                         db:"tags"`
	CreatedAt         time.Time `json:"created_at"                   db:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"                   db:"updated_at"`
	UserID            *int64    `json:"user_id,omitempty"            db:"user_id"`
}

// TagBudget is a spending limit set by the user for a specific tag.
type TagBudget struct {
	ID        int64  `json:"id"          db:"id"`
	UserID    int64  `json:"user_id"     db:"user_id"`
	UserTagID int64  `json:"user_tag_id" db:"user_tag_id"`
	Tag       string `json:"tag"         db:"-"`
	Year      int    `json:"year"        db:"year"`
	Month     int    `json:"month"       db:"month"`
	Amount    int64  `json:"amount"      db:"amount"`
}

// UserTagEntry is a user-curated tag with optional icon and color overrides.
type UserTagEntry struct {
	Tag   string  `json:"tag"`
	Icon  *string `json:"icon,omitempty"`
	Color *string `json:"color,omitempty"`
}

// CreditCardStatement represents a single billing cycle for a credit card account.
type CreditCardStatement struct {
	ID                int64            `json:"id"                    db:"id"`
	ExternalAccountID string           `json:"external_account_id"   db:"external_account_id"`
	PeriodFrom        time.Time        `json:"period_from"           db:"period_from"`
	PeriodTo          time.Time        `json:"period_to"             db:"period_to"`
	DueDate           *time.Time       `json:"due_date"              db:"due_date"`
	Currency          string           `json:"currency"              db:"currency"`
	TotalAmount       int64            `json:"total_amount"          db:"total_amount"`
	MinPayment        int64            `json:"min_payment"           db:"min_payment"`
	AccountID         *int64           `json:"account_id,omitempty"  db:"account_id"`
	UserID            *int64           `json:"user_id,omitempty"     db:"user_id"`
	Items             []CreditCardItem `json:"items,omitempty"`
	CreatedAt         time.Time        `json:"created_at"            db:"created_at"`
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

// AppTagRule is a global description-to-tags mapping applied to all users.
type AppTagRule struct {
	ID        int64    `json:"id"         db:"id"`
	Pattern   string   `json:"pattern"    db:"pattern"`
	Tags      []string `json:"tags"       db:"tags"`
	MatchType string   `json:"match_type" db:"match_type"`
}

// UserTagRule records a user's description-to-tag and description-to-custom_description assignments learned from explicit edits.
type UserTagRule struct {
	ID                int64     `json:"id"                 db:"id"`
	UserID            int64     `json:"user_id"            db:"user_id"`
	DescriptionKey    string    `json:"description_key"    db:"description_key"`
	Tags              []string  `json:"tags"               db:"tags"`
	CustomDescription *string   `json:"custom_description" db:"custom_description"`
	UseCount          int       `json:"use_count"          db:"use_count"`
	LastUsedAt        time.Time `json:"last_used_at"       db:"last_used_at"`
}
