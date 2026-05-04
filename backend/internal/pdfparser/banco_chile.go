package pdfparser

import (
	"bytes"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"rsc.io/pdf"
)

var bdcPeriodRe = regexp.MustCompile(`(\d{2}/\d{2}/\d{4})`)

// bdcSkipPatterns: Banco de Chile description tokens that are NOT transactions.
var bdcSkipPatterns = []string{
	"SALDO INICIAL",
	"SALDO FINAL",
	"RETENCION",
	"DEPOSITOS CHEQUES",
	"INFORMESE",
}

// bdcAmtMinX is the minimum X at which monetary amounts appear in BdC PDFs.
// Anything to the left is date/description/sucursal.
const bdcAmtMinX = 370.0

// bdcSaldoX is the X threshold above which an amount is in the running-balance
// (SALDO) column and should be ignored as a transaction amount.
const bdcSaldoX = 530.0

// ParseBancoChile parses a Banco de Chile cuenta-corriente cartola PDF.
// The cartola may span multiple pages; all pages are processed.
func ParseBancoChile(data []byte) (ParseResult, error) {
	r, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return ParseResult{}, fmt.Errorf("banco_chile: open pdf: %w", err)
	}

	var result ParseResult

	for pageNum := 1; pageNum <= r.NumPage(); pageNum++ {
		page := r.Page(pageNum)
		content := page.Content()

		var elems []textEl
		for _, t := range content.Text {
			elems = append(elems, textEl{X: t.X, Y: t.Y, W: t.W, S: t.S})
		}

		rows := groupByY(elems)

		// BdC PDFs use scrambled font encoding for column headers, making
		// positional column detection unreliable. We rely on the description
		// keyword heuristic (bdcFlowHeuristic) for all flow classification.

		for _, row := range rows {
			toks := xTokens(row.Elems)
			if len(toks) == 0 {
				continue
			}

			// Period detection: look for individual DD/MM/YYYY tokens.
			if result.PeriodFrom.IsZero() {
				var dates []time.Time
				for _, tok := range toks {
					if m := bdcPeriodRe.FindString(tok.Text); m != "" {
						t, err := time.Parse("02/01/2006", m)
						if err == nil {
							dates = append(dates, t)
						}
					}
				}
				if len(dates) >= 2 {
					result.PeriodFrom = dates[0]
					result.PeriodTo = dates[len(dates)-1]
				} else if len(dates) == 1 && result.PeriodFrom.IsZero() {
					result.PeriodFrom = dates[0]
				}
			}

			// Transaction rows: first token must be DD/MM date.
			dateToken := toks[0].Text
			if !isDateDDMM(dateToken) {
				continue
			}

			line := joinRow(row.Elems)

			// Skip known non-transaction rows.
			if bdcShouldSkip(line) {
				continue
			}

			day, _ := strconv.Atoi(dateToken[:2])
			month, _ := strconv.Atoi(dateToken[3:])
			if day == 0 || month == 0 {
				continue
			}

			// Collect amount tokens in the right-side columns.
			var amtToks []xToken
			for _, tok := range toks[1:] {
				if tok.X < bdcAmtMinX {
					continue
				}
				if isCLPNumber(tok.Text) {
					amtToks = append(amtToks, tok)
				}
			}
			if len(amtToks) == 0 {
				continue
			}

			// Sort amounts left-to-right.
			sort.Slice(amtToks, func(i, j int) bool { return amtToks[i].X < amtToks[j].X })

			// Separate SALDO amounts (X >= bdcSaldoX) from transaction amounts.
			var txToks, saldoToks []xToken
			for _, at := range amtToks {
				if at.X >= bdcSaldoX {
					saldoToks = append(saldoToks, at)
				} else {
					txToks = append(txToks, at)
				}
			}
			_ = saldoToks // not used; retained for clarity

			if len(txToks) == 0 {
				// Only SALDO amount present — this is a balance-only marker row.
				continue
			}

				// Classify flow using keyword heuristic on the row description.
			var txAmt int64
			var flow string

			v, err := parseCLPAmount(txToks[0].Text)
			if err == nil && v > 0 {
				txAmt = v
				flow = bdcFlowHeuristic(line)
			}

			if txAmt == 0 || flow == "" {
				continue
			}

			desc := bdcDesc(toks, dateToken)

			year := inferYear(day, month, result.PeriodFrom, result.PeriodTo)
			date := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)

			result.Rows = append(result.Rows, Row{
				Date:        date,
				Description: strings.TrimSpace(desc),
				Amount:      txAmt,
				Flow:        flow,
			})
		}
	}

	return result, nil
}

// bdcShouldSkip returns true for Banco de Chile rows that are balance markers
// or section headers rather than individual transactions.
func bdcShouldSkip(line string) bool {
	upper := strings.ToUpper(line)
	for _, p := range bdcSkipPatterns {
		if strings.Contains(upper, p) {
			return true
		}
	}
	return false
}

// bdcFlowHeuristic infers flow from known Banco de Chile description patterns.
// The PDF concatenates all characters in a cell at the same X position, so
// "TRASPASO DE:..." becomes "TRASPASODE:..." (no internal spaces in the token).
func bdcFlowHeuristic(line string) string {
	// Collapse all spaces so we can match regardless of how the PDF stores the text.
	upper := strings.ToUpper(strings.ReplaceAll(line, " ", ""))
	if strings.Contains(upper, "TRASPASODE:") ||
		strings.Contains(upper, "DEPOSITO") ||
		strings.Contains(upper, "ABONOREMUNERACION") {
		return "INCOME"
	}
	return "EXPENSE"
}

// bdcDesc builds a human-readable description from the row's xTokens,
// skipping the date token and amount tokens.
func bdcDesc(toks []xToken, dateToken string) string {
	var parts []string
	for _, tok := range toks {
		s := strings.TrimSpace(tok.Text)
		if s == "" || s == dateToken {
			continue
		}
		if isDateDDMM(s) {
			continue
		}
		// Skip amount tokens in the right-column area.
		if tok.X >= bdcAmtMinX && isCLPNumber(s) {
			continue
		}
		// Skip pure-digit doc/sucursal codes (3-9 digits).
		if isAllDigits(s) && len(s) >= 3 && len(s) <= 9 {
			continue
		}
		parts = append(parts, s)
	}
	return strings.Join(parts, " ")
}

// extractBdCAccountNumber extracts the account number from the PDF text if available.
func extractBdCAccountNumber(lines []string) string {
	re := regexp.MustCompile(`\b(\d{10,})\b`)
	for _, l := range lines {
		if m := re.FindString(l); m != "" {
			return m
		}
	}
	return ""
}
