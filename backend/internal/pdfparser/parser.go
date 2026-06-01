package pdfparser

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
)

// Row is a single parsed transaction from a bank statement PDF.
type Row struct {
	Date        time.Time
	Description string
	Amount      int64  // always positive, in the minor unit of the currency (CLP = pesos, no decimals)
	Flow        string // "INCOME" or "EXPENSE"
}

// ParseResult holds all rows and metadata extracted from a PDF.
type ParseResult struct {
	Rows          []Row
	PeriodFrom    time.Time
	PeriodTo      time.Time
	AccountNumber string
}

// textEl is a single positioned text fragment from the PDF content stream.
type textEl struct {
	X, Y, W float64 // X,Y position; W = glyph advance width
	S        string
}

// rightEdge returns the estimated right edge of the text element.
func (t textEl) rightEdge() float64 { return t.X + t.W }

// rowGroup holds all text elements that share approximately the same Y.
type rowGroup struct {
	Y     float64
	Elems []textEl
}

const yTolerance = 3.0 // points; elements within this Y delta are on the same visual line

// groupByY groups text elements into rows sorted top-to-bottom (descending Y).
func groupByY(texts []textEl) []rowGroup {
	if len(texts) == 0 {
		return nil
	}
	var groups []rowGroup
	for _, t := range texts {
		placed := false
		for i := range groups {
			if math.Abs(groups[i].Y-t.Y) < yTolerance {
				groups[i].Elems = append(groups[i].Elems, t)
				placed = true
				break
			}
		}
		if !placed {
			groups = append(groups, rowGroup{Y: t.Y, Elems: []textEl{t}})
		}
	}
	// Sort rows top-to-bottom (highest Y first in PDF coordinates).
	sort.Slice(groups, func(i, j int) bool { return groups[i].Y > groups[j].Y })
	// Within each row, sort elements left-to-right.
	for i := range groups {
		sort.Slice(groups[i].Elems, func(a, b int) bool { return groups[i].Elems[a].X < groups[i].Elems[b].X })
	}
	return groups
}

// xToken is a column-level token: all characters that share the same X coordinate
// in the PDF content stream are concatenated into one token. Bank PDFs store each
// table cell at a single X position regardless of how many characters it contains,
// so grouping by X gives us clean column values (dates, descriptions, amounts, etc.).
type xToken struct {
	Text string
	X    float64
}

// xTokens groups the elements of a row into column tokens by X coordinate.
// Elements with the same X (within 0.5 pts) belong to the same token.
// The resulting slice is ordered left-to-right.
func xTokens(elems []textEl) []xToken {
	if len(elems) == 0 {
		return nil
	}
	var tokens []xToken
	var cur strings.Builder
	curX := elems[0].X
	cur.WriteString(elems[0].S)
	for i := 1; i < len(elems); i++ {
		if math.Abs(elems[i].X-curX) > 0.5 {
			tokens = append(tokens, xToken{Text: cur.String(), X: curX})
			cur.Reset()
			curX = elems[i].X
		}
		cur.WriteString(elems[i].S)
	}
	if cur.Len() > 0 {
		tokens = append(tokens, xToken{Text: cur.String(), X: curX})
	}
	return tokens
}

// joinRow concatenates all tokens for a row into a space-separated string,
// useful for regex-based period and header detection.
func joinRow(elems []textEl) string {
	toks := xTokens(elems)
	if len(toks) == 0 {
		return ""
	}
	parts := make([]string, 0, len(toks))
	for _, t := range toks {
		if s := strings.TrimSpace(t.Text); s != "" {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, " ")
}

// parseCLPAmount converts a Chilean peso string like "1.234.567" to integer pesos.
func parseCLPAmount(s string) (int64, error) {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ".", "")
	s = strings.ReplaceAll(s, ",", "")
	if s == "" {
		return 0, fmt.Errorf("empty amount")
	}
	var n int64
	for _, ch := range s {
		if !unicode.IsDigit(ch) {
			return 0, fmt.Errorf("invalid char %q in amount", ch)
		}
		n = n*10 + int64(ch-'0')
	}
	return n, nil
}

// isDateDDMM returns true when s has the format "DD/MM".
func isDateDDMM(s string) bool {
	if len(s) != 5 || s[2] != '/' {
		return false
	}
	return isAsciiDigit(s[0]) && isAsciiDigit(s[1]) && isAsciiDigit(s[3]) && isAsciiDigit(s[4])
}

// isDateDDMMYYYY returns true when s has the format "DD/MM/YYYY".
func isDateDDMMYYYY(s string) bool {
	if len(s) != 10 || s[2] != '/' || s[5] != '/' {
		return false
	}
	return isAsciiDigit(s[0]) && isAsciiDigit(s[1]) &&
		isAsciiDigit(s[3]) && isAsciiDigit(s[4]) &&
		isAsciiDigit(s[6]) && isAsciiDigit(s[7]) &&
		isAsciiDigit(s[8]) && isAsciiDigit(s[9])
}

// parseDDMMYYYY parses day, month, year from a "DD/MM/YYYY" token.
func parseDDMMYYYY(s string) (day, month, year int) {
	d, _ := strconv.Atoi(s[0:2])
	m, _ := strconv.Atoi(s[3:5])
	y, _ := strconv.Atoi(s[6:10])
	return d, m, y
}

func isAsciiDigit(b byte) bool { return b >= '0' && b <= '9' }

// inferYear returns the year that places (day, month) within [from, to] date bounds.
// When from is zero (period not detected from the PDF header), it falls back to a
// ±13-month window around the current date so that cross-year cartolas work correctly
// (e.g. a December → January statement imported in April 2026 yields years 2025/2026).
func inferYear(day, month int, from, to time.Time) int {
	if from.IsZero() {
		now := time.Now().UTC()
		from = now.AddDate(-1, -1, 0) // 13 months ago
		to = now.AddDate(0, 1, 0)     // 1 month in the future
	}
	// Try the most-recent year first so that April 2026 is preferred over April 2025
	// when both fall within the ±13-month fallback window (avoids wrong-year assignment
	// when the PDF period header is absent or not parsed).
	years := []int{to.Year(), from.Year()}
	if to.Year() > from.Year()+10 {
		// Period end looks scrambled (e.g. year 2326 from bad glyph encoding).
		// Restrict to statement start year and the next.
		years = []int{from.Year(), from.Year() + 1}
	}
	for _, y := range years {
		t := time.Date(y, time.Month(month), day, 0, 0, 0, 0, time.UTC)
		if !t.Before(from.AddDate(0, 0, -1)) && !t.After(to.AddDate(0, 0, 1)) {
			return y
		}
	}
	return from.Year()
}

// columnBounds holds detected X positions for the INCOME (abonos) and EXPENSE (cargos) columns.
type columnBounds struct {
	abonosX float64 // X of the "DEPOSITOS / ABONOS" column header element
	cargosX float64 // X of the "CHEQUES / CARGOS" column header element
	found   bool
}

// classifyByX assigns INCOME/EXPENSE based on which column the amount's X is closer to.
// Returns "" when the amount lies beyond both columns (SALDO column) or cannot be classified.
// Amounts are right-aligned in their column so their X start varies, but they always sit
// between the column header X and the next column header X.
func (cb columnBounds) classifyByX(amtX float64) string {
	if !cb.found {
		return ""
	}
	colSpread := math.Abs(cb.abonosX - cb.cargosX)
	rightEdge := math.Max(cb.abonosX, cb.cargosX) + colSpread*0.8
	if amtX > rightEdge {
		return "" // beyond the rightmost money column — this is the SALDO value
	}
	dAbonos := math.Abs(amtX - cb.abonosX)
	dCargos := math.Abs(amtX - cb.cargosX)
	if dAbonos <= dCargos {
		return "INCOME"
	}
	return "EXPENSE"
}

// isCLPNumber returns true when s looks like a Chilean peso amount.
// Accepts digits optionally separated by dots (e.g. "200", "1.234", "9.347.001").
func isCLPNumber(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" || !unicode.IsDigit(rune(s[0])) {
		return false
	}
	for _, ch := range s {
		if ch != '.' && !unicode.IsDigit(ch) {
			return false
		}
	}
	return true
}
