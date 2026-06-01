package domain

import "time"

// commands.go defines write operation parameter objects (commands/DTOs).
// These are not domain entities — they carry input data from one layer to
// another and have no identity or persistence of their own.

type CreateAccountParams struct {
	UserID   int64
	BankID   BankID
	Name     string
	Type     string
	Currency string
	Settings AccountSettings
}

type UpdateAccountParams struct {
	BankID   *BankID
	Name     *string
	Type     *string
	Settings *AccountSettings
}

// CreateTransactionParams carries the data needed to create a new transaction.
type CreateTransactionParams struct {
	Date                time.Time
	Description         string
	Flow                string
	CustomDescription   *string
	Amount              int64
	Notes               *string
	Source              string
	BankRawID           *string
	Currency            string   // defaults to "CLP" when empty
	AccountID           *int64
	Tags                []string // hashtag labels, e.g. ["#streaming", "#annual"]
	UserID              *int64
	RememberDescription bool // if true, persist custom_description in personal rules
}

// UpdateTransactionParams carries the optional fields for a partial update.
type UpdateTransactionParams struct {
	Date                *time.Time
	Description         *string
	Flow                *string
	CustomDescription   *string
	Amount              *int64
	Notes               *string
	Tags                *[]string
	RememberDescription *bool // if true, persist custom_description in personal rules
}

type CreateCCBillParams struct {
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
	BillID             int64
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
