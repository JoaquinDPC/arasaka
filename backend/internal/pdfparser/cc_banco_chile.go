package pdfparser

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"
	"time"

	"rsc.io/pdf"
)

// CC external account IDs — must match the values used by fintself / importer.
const (
	CCNationalExtID = "credit_card_nacional_facturados"
	CCIntlExtID     = "credit_card_internacional_facturados"
)

// CCItem is a single line item from a credit card bill.
type CCItem struct {
	Date               time.Time
	Description        string
	Amount             int64  // positive; CLP in pesos, USD in cents (e.g. 23.80 USD → 2380)
	Currency           string // "CLP" or "USD"
	InstallmentCurrent *int
	InstallmentTotal   *int
	ItemType           string  // "purchase", "installment", "commission"
	BankRawID          *string // reference code from the PDF
}

// CCBillData holds parsed data for one billing section (national CLP or international USD).
type CCBillData struct {
	ExternalAccountID string
	PeriodFrom        time.Time
	PeriodTo          time.Time
	DueDate           *time.Time
	Currency          string
	TotalAmount       int64 // positive total due
	Items             []CCItem
}

// CCParseResult holds the parsed national (CLP) and international (USD) sections.
type CCParseResult struct {
	National      *CCBillData
	International *CCBillData
}

// ccSection accumulates state while parsing one currency section.
type ccSection struct {
	externalID  string
	currency    string
	periodFrom  time.Time
	periodTo    time.Time
	dueDate     *time.Time
	totalAmount int64
	items       []CCItem
}

// ccColGap is the minimum advance-width gap (pts) that separates column tokens in
// Banco de Chile CC PDFs. Each glyph is individually positioned; intra-column
// advance gaps are ~0 pt while inter-column gaps are ≥ 3.5 pt.
const ccColGap = 3.0

// ParseCCBancoChile parses a decrypted Banco de Chile Visa/Mastercard statement PDF.
// The PDF is expected to have a national (CLP) section followed by an international
// (USD) section. Both sections are parsed in a single pass over all pages.
func ParseCCBancoChile(data []byte) (CCParseResult, error) {
	pdfReader, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return CCParseResult{}, fmt.Errorf("cc_banco_chile: open pdf: %w", err)
	}

	nat := &ccSection{externalID: CCNationalExtID, currency: "CLP"}
	intl := &ccSection{externalID: CCIntlExtID, currency: "USD"}

	for pageNum := 1; pageNum <= pdfReader.NumPage(); pageNum++ {
		page := pdfReader.Page(pageNum)
		content := page.Content()

		var elems []textEl
		for _, t := range content.Text {
			elems = append(elems, textEl{X: t.X, Y: t.Y, W: t.W, S: t.S})
		}

		ccProcessPage(groupByY(elems), nat, intl)
	}

	var result CCParseResult
	if !nat.periodFrom.IsZero() || len(nat.items) > 0 {
		result.National = &CCBillData{
			ExternalAccountID: nat.externalID,
			PeriodFrom:        nat.periodFrom,
			PeriodTo:          nat.periodTo,
			DueDate:           nat.dueDate,
			Currency:          nat.currency,
			TotalAmount:       nat.totalAmount,
			Items:             nat.items,
		}
	}
	if !intl.periodFrom.IsZero() || len(intl.items) > 0 {
		result.International = &CCBillData{
			ExternalAccountID: intl.externalID,
			PeriodFrom:        intl.periodFrom,
			PeriodTo:          intl.periodTo,
			DueDate:           intl.dueDate,
			Currency:          intl.currency,
			TotalAmount:       intl.totalAmount,
			Items:             intl.items,
		}
	}
	return result, nil
}

// ccXTokens groups individually-positioned glyphs into column-level tokens using
// the advance-width gap. A new token starts when the gap between the right edge of
// the current glyph and the X of the next glyph exceeds ccColGap.
//
// Banco de Chile CC PDFs store each glyph at its own precise X coordinate (unlike
// the account-statement PDFs where entire cell contents share one X). The advance
// widths (W field from rsc.io/pdf) are accurate, so intra-column advance gaps are
// ≈ 0 pt while inter-column gaps are ≥ 3.5 pt.
func ccXTokens(elems []textEl) []xToken {
	if len(elems) == 0 {
		return nil
	}
	var tokens []xToken
	var cur strings.Builder
	curX := elems[0].X
	cur.WriteString(elems[0].S)
	prevRight := elems[0].X + elems[0].W

	for i := 1; i < len(elems); i++ {
		e := elems[i]
		gap := e.X - prevRight
		if gap > ccColGap {
			tokens = append(tokens, xToken{Text: cur.String(), X: curX})
			cur.Reset()
			curX = e.X
		}
		cur.WriteString(e.S)
		if right := e.X + e.W; right > prevRight {
			prevRight = right
		}
	}
	if cur.Len() > 0 {
		tokens = append(tokens, xToken{Text: cur.String(), X: curX})
	}
	return tokens
}

// ccJoinRow concatenates all ccXTokens for a row into a space-separated string.
func ccJoinRow(elems []textEl) string {
	toks := ccXTokens(elems)
	parts := make([]string, 0, len(toks))
	for _, t := range toks {
		if s := strings.TrimSpace(t.Text); s != "" {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, " ")
}

// ccProcessPage scans one page's rows and populates nat/intl sections.
//
// Banco de Chile CC PDF layout (verified X positions from rsc.io/pdf):
//
//	National (CLP) transaction rows:
//	  x≈44   city (optional, skip)
//	  x≈105  date DD/MM/YY
//	  x≈143  12-digit reference code
//	  x≈195  description (extends to ~x376, includes city/interest info)
//	  x≈379  "$" currency sign
//	  x≈404  operation amount (positive; negative = payment, skip)
//	  x≈441  "$" currency sign (total column)
//	  x≈467  total amount
//	  x≈508  installment "current/total" e.g. "01/01" or "04/12"
//	  x≈535  "$" currency sign (monthly column)
//	  x≈566  monthly value
//
//	International (USD) transaction rows:
//	  x≈45   26-char reference code
//	  x≈168  date DD/MM/YY
//	  x≈207  description
//	  x≈377  merchant/site
//	  x≈448  "US" currency label
//	  x≈509  amount (comma-decimal, e.g. "23,80")
func ccProcessPage(rows []rowGroup, nat, intl *ccSection) {
	for _, row := range rows {
		toks := ccXTokens(row.Elems)
		if len(toks) == 0 {
			continue
		}
		line := ccJoinRow(row.Elems)
		upper := strings.ToUpper(line)
		hasUSD := strings.Contains(upper, "US$") || strings.Contains(upper, " US ")

		// ── Period / due date extraction (4-digit year) ──────────────────────
		var dates4 []time.Time
		for _, tok := range toks {
			if isDateDDMMYYYY(tok.Text) {
				d, m, y := parseDDMMYYYY(tok.Text)
				dates4 = append(dates4, time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC))
			}
		}

		if len(dates4) > 0 {
			// National: two 4-digit dates on same row + "FACTURADO" + no "US$"
			if len(dates4) >= 2 && strings.Contains(upper, "FACTURADO") && !hasUSD {
				if nat.periodFrom.IsZero() {
					nat.periodFrom = dates4[0]
					nat.periodTo = dates4[len(dates4)-1]
				}
			}
			// International period — one date per row with DESDE / HASTA keyword
			if strings.Contains(upper, "PERIOD") && strings.Contains(upper, "DESDE") {
				if intl.periodFrom.IsZero() {
					intl.periodFrom = dates4[0]
				}
			}
			if strings.Contains(upper, "PERIOD") && strings.Contains(upper, "HASTA") {
				if intl.periodTo.IsZero() {
					intl.periodTo = dates4[0]
				}
			}
			// Due date: row contains "PAGAR" and "HASTA"
			if strings.Contains(upper, "PAGAR") && strings.Contains(upper, "HASTA") {
				t := dates4[0]
				if hasUSD {
					if intl.dueDate == nil {
						intl.dueDate = &t
					}
				} else {
					if nat.dueDate == nil {
						nat.dueDate = &t
					}
				}
			}
		}

		// ── Total amount: payment slip at bottom of page ───────────────────────
		// Pattern: row contains "Banco" and a monetary amount token.
		// Tokens may be merged with currency prefix (e.g. "US$133,05" or "$395.005").
		if strings.Contains(upper, "BANCO") {
			for _, tok := range toks {
				s := tok.Text
				s = strings.TrimPrefix(s, "US$") // strip international prefix first
				s = strings.TrimPrefix(s, "$")   // then simple CLP prefix
				if hasUSD {
					if v, ok := parseUSDCents(s); ok && v > 0 && intl.totalAmount == 0 {
						intl.totalAmount = v
					}
				} else {
					if v, err := parseCLPAmount(s); err == nil && v > 0 && nat.totalAmount == 0 {
						nat.totalAmount = v
					}
				}
			}
		}

		// ── National (CLP) transaction row ────────────────────────────────────
		if item, ok := ccParseNatRow(toks, upper); ok {
			nat.items = append(nat.items, item)
		}

		// ── International (USD) transaction row ───────────────────────────────
		if item, ok := ccParseIntlRow(toks); ok {
			intl.items = append(intl.items, item)
		}
	}
}

// ccParseNatRow tries to parse a national (CLP) transaction row.
// Returns (item, true) on success, (CCItem{}, false) otherwise.
func ccParseNatRow(toks []xToken, upperLine string) (CCItem, bool) {
	// Must have date token at x ∈ [95, 125] in DD/MM/YY format.
	dateIdx := -1
	for i, tok := range toks {
		if tok.X >= 95 && tok.X <= 125 && isDateDDMMYY(tok.Text) {
			dateIdx = i
			break
		}
	}
	if dateIdx < 0 {
		return CCItem{}, false
	}

	// Skip rows that contain "TOTAL" in any form (subtotal/summary rows).
	if strings.Contains(upperLine, "TOTAL") {
		return CCItem{}, false
	}

	// Skip rows where the operation amount column contains a negative value
	// (those are payment rows, not purchases).
	for _, tok := range toks {
		if tok.X >= 395 && tok.X <= 445 && strings.HasPrefix(tok.Text, "-") {
			return CCItem{}, false
		}
	}

	// Parse date (DD/MM/YY → 2000s century).
	dt := ccParseShortDate(toks[dateIdx].Text)

	// Reference code at x ∈ [130, 165].
	var ref string
	for _, tok := range toks {
		if tok.X >= 130 && tok.X <= 165 {
			ref = tok.Text
			break
		}
	}

	// Description: all tokens at x ∈ [185, 376] (everything before the first "$").
	// This naturally includes merchant name, city, and any interest-rate annotations.
	var descParts []string
	for _, tok := range toks {
		if tok.X >= 185 && tok.X < 376 {
			descParts = append(descParts, tok.Text)
		}
	}
	desc := strings.TrimSpace(strings.Join(descParts, " "))

	// Operation amount at x ∈ [395, 445]. Pick the first positive CLP number.
	var amount int64
	for _, tok := range toks {
		if tok.X >= 395 && tok.X <= 445 {
			s := strings.TrimPrefix(tok.Text, "$")
			if v, err := parseCLPAmount(s); err == nil && v > 0 {
				amount = v
				break
			}
		}
	}
	if amount == 0 {
		return CCItem{}, false
	}

	// Installment field at x ∈ [498, 527], format "CC/TT".
	var instCur, instTot *int
	for _, tok := range toks {
		if tok.X >= 498 && tok.X <= 527 {
			if cur, tot, ok := parseInstallment(tok.Text); ok {
				instCur = &cur
				instTot = &tot
			}
			break
		}
	}

	itemType := ccClassifyNat(desc, instCur, instTot)

	return CCItem{
		Date:               dt,
		Description:        desc,
		Amount:             amount,
		Currency:           "CLP",
		InstallmentCurrent: instCur,
		InstallmentTotal:   instTot,
		ItemType:           itemType,
		BankRawID:          strPtr(ref),
	}, true
}

// ccParseIntlRow tries to parse an international (USD) transaction row.
func ccParseIntlRow(toks []xToken) (CCItem, bool) {
	// Date at x ∈ [158, 185] in DD/MM/YY format.
	dateIdx := -1
	for i, tok := range toks {
		if tok.X >= 158 && tok.X <= 185 && isDateDDMMYY(tok.Text) {
			dateIdx = i
			break
		}
	}
	if dateIdx < 0 {
		return CCItem{}, false
	}

	// Reference at x ∈ [35, 65]; must be non-trivial (> 4 chars).
	var ref string
	for _, tok := range toks {
		if tok.X >= 35 && tok.X <= 65 && len(tok.Text) > 4 {
			ref = tok.Text
			break
		}
	}

	// Skip payment rows: the total column (x ≈ 558–590) has a negative value.
	for _, tok := range toks {
		if tok.X >= 558 && tok.X <= 590 && strings.HasPrefix(tok.Text, "-") {
			return CCItem{}, false
		}
	}

	// Description tokens at x ∈ [200, 447] (includes description and merchant site).
	var descParts []string
	for _, tok := range toks {
		if tok.X >= 200 && tok.X <= 447 && tok.Text != "US" {
			descParts = append(descParts, tok.Text)
		}
	}
	desc := strings.TrimSpace(strings.Join(descParts, " "))

	// Amount at x ∈ [490, 535] in USD cent format (comma decimal, e.g. "23,80").
	var amount int64
	for _, tok := range toks {
		if tok.X >= 490 && tok.X <= 535 && tok.Text != "US" {
			if v, ok := parseUSDCents(tok.Text); ok && v > 0 {
				amount = v
				break
			}
		}
	}
	if amount == 0 {
		return CCItem{}, false
	}

	dt := ccParseShortDate(toks[dateIdx].Text)

	return CCItem{
		Date:        dt,
		Description: desc,
		Amount:      amount,
		Currency:    "USD",
		ItemType:    "purchase",
		BankRawID:   strPtr(ref),
	}, true
}

// ccClassifyNat assigns ItemType for national CLP items.
func ccClassifyNat(desc string, instCur, instTot *int) string {
	upper := strings.ToUpper(desc)
	if strings.Contains(upper, "COMIS") || strings.Contains(upper, "MANTEN") ||
		strings.Contains(upper, "IMPUESTO") {
		return "commission"
	}
	if instCur != nil && instTot != nil && *instTot > 1 {
		return "installment"
	}
	return "purchase"
}

// isDateDDMMYY returns true when s has exactly the format "DD/MM/YY" (8 chars).
func isDateDDMMYY(s string) bool {
	if len(s) != 8 || s[2] != '/' || s[5] != '/' {
		return false
	}
	return isAsciiDigit(s[0]) && isAsciiDigit(s[1]) &&
		isAsciiDigit(s[3]) && isAsciiDigit(s[4]) &&
		isAsciiDigit(s[6]) && isAsciiDigit(s[7])
}

// ccParseShortDate parses a "DD/MM/YY" string, assuming 2000s century.
func ccParseShortDate(s string) time.Time {
	if len(s) < 8 {
		return time.Time{}
	}
	day, _ := strconv.Atoi(s[0:2])
	month, _ := strconv.Atoi(s[3:5])
	year2, _ := strconv.Atoi(s[6:8])
	return time.Date(2000+year2, time.Month(month), day, 0, 0, 0, 0, time.UTC)
}

// parseInstallment parses "CC/TT" installment notation (e.g. "04/12" → 4, 12).
func parseInstallment(s string) (cur, tot int, ok bool) {
	parts := strings.SplitN(s, "/", 2)
	if len(parts) != 2 {
		return 0, 0, false
	}
	c, err1 := strconv.Atoi(parts[0])
	t, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil || c <= 0 || t <= 0 {
		return 0, 0, false
	}
	return c, t, true
}

// parseUSDCents converts "23,80" or "133,05" (comma-decimal USD) to integer cents.
// Returns (0, false) for invalid or negative values.
func parseUSDCents(s string) (int64, bool) {
	s = strings.TrimSpace(s)
	if s == "" || s[0] == '-' {
		return 0, false
	}
	// Remove comma to get cent integer string: "23,80" → "2380".
	s = strings.ReplaceAll(s, ",", "")
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil || n <= 0 {
		return 0, false
	}
	return n, true
}

// strPtr returns a pointer to a copy of s, or nil for empty s.
func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	cp := s
	return &cp
}
