package models

import (
	"regexp"
	"time"
)

type AccountType string

const (
	AccountTypeCorriente AccountType = "corriente"
	AccountTypeCredito   AccountType = "credito"
	AccountTypeDebito    AccountType = "debito"
	AccountTypePrepago   AccountType = "prepago"
)

type Movement struct {
	Date            time.Time              `json:"date"`
	Description     string                 `json:"description"`
	Amount          float64                `json:"amount"`
	Currency        string                 `json:"currency"`
	TransactionType string                 `json:"transaction_type,omitempty"`
	AccountID       string                 `json:"account_id,omitempty"`
	AccountType     AccountType            `json:"account_type,omitempty"`
	RawData         map[string]interface{} `json:"raw_data,omitempty"`
}

var nonDigit = regexp.MustCompile(`\D`)

// FormatAccountID keeps only the last 4 digits of an account identifier.
func FormatAccountID(v string) string {
	digits := nonDigit.ReplaceAllString(v, "")
	if len(digits) >= 4 {
		return digits[len(digits)-4:]
	}
	if digits != "" {
		return digits
	}
	return v
}
