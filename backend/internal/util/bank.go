package util

import (
	"crypto/sha256"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"arasaka/internal/domain"
)

// ParseDate handles both RFC3339 ("2026-04-13T00:00:00Z") and the no-timezone
// variant produced by fintself ("2026-04-13T00:00:00").
func ParseDate(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02T15:04:05", s)
}

// BankRawID computes the deduplication key for a corriente (bank_json) movement.
// occurrence disambiguates same-day identical transactions; 0 preserves the legacy key format.
func BankRawID(accountID, dateStr, amount, description string, occurrence int) string {
	var key string
	if occurrence == 0 {
		key = fmt.Sprintf("bj|%s|%s|%s|%s", accountID, dateStr, amount, description)
	} else {
		key = fmt.Sprintf("bj|%s|%s|%s|%s|%d", accountID, dateStr, amount, description, occurrence)
	}
	h := sha256.Sum256([]byte(key))
	return fmt.Sprintf("bj_%x", h[:8])
}

// PDFRawID computes the deduplication key for a transaction imported from a PDF cartola.
// Uses accountID + date + amount + description so that re-importing the same cartola
// (or importing overlapping cartolas for the same account) never creates duplicates.
// accountID scopes uniqueness per-account so different accounts can share the same
// transaction without conflict.
func PDFRawID(accountID int64, date time.Time, amount int64, description string) string {
	key := fmt.Sprintf("pdf|%d|%s|%d|%s",
		accountID, date.Format("2006-01-02"), amount, description)
	h := sha256.Sum256([]byte(key))
	return fmt.Sprintf("pdf_%x", h[:8])
}

// CCRawID computes the deduplication key for a credito CC item.
// occurrence disambiguates same-day identical transactions; 0 preserves the legacy key format.
func CCRawID(accountID, dateStr, amount, description string, occurrence int) string {
	var key string
	if occurrence == 0 {
		key = fmt.Sprintf("cc|%s|%s|%s|%s", accountID, dateStr, amount, description)
	} else {
		key = fmt.Sprintf("cc|%s|%s|%s|%s|%d", accountID, dateStr, amount, description, occurrence)
	}
	h := sha256.Sum256([]byte(key))
	return fmt.Sprintf("cc_%x", h[:8])
}

// bdcPrefixes maps lowercased BDC noise prefixes to their human-readable display form.
// Ordered longest-first to avoid partial matches.
var bdcPrefixes = []struct{ raw, display string }{
	{"traspaso a:", "Traspaso a"},
	{"traspaso de:", "Traspaso de"},
	{"traspaso:", "Traspaso"},
	{"pago:", "Pago"},
}

func ParseAbsAmountCLP(s string) (int64, error) {
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0, fmt.Errorf("parse clp amount %q: %w", s, err)
	}
	if f < 0 {
		f = -f
	}
	return int64(f), nil
}

func ParseAbsAmountUSD(s string) (int64, error) {
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0, fmt.Errorf("parse usd amount %q: %w", s, err)
	}
	if f < 0 {
		f = -f
	}
	return int64(math.Round(f * 100)), nil
}

// CleanDescription strips bank-specific noise prefixes from raw descriptions.
// The original description must be used for RawID computation before calling this.
func CleanDescription(bankID domain.BankID, desc string) string {
	switch bankID {
	case domain.BankBancoDeChile:
		lower := strings.ToLower(desc)
		for _, p := range bdcPrefixes {
			if strings.HasPrefix(lower, p.raw) {
				rest := strings.TrimSpace(desc[len(p.raw):])
				return p.display + " " + rest
			}
		}
	}
	return desc
}
