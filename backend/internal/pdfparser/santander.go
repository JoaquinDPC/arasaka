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

var santanderPeriodRe = regexp.MustCompile(`(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})`)

// ParseSantander parses a Banco Santander Chile cuenta-corriente cartola PDF.
// It extracts transactions from the "DETALLE DE MOVIMIENTOS" table and stops
// when it reaches the "Resumen de Comisiones" section.
func ParseSantander(data []byte) (ParseResult, error) {
	r, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return ParseResult{}, fmt.Errorf("santander: open pdf: %w", err)
	}

	var result ParseResult
	var cols columnBounds

	for pageNum := 1; pageNum <= r.NumPage(); pageNum++ {
		page := r.Page(pageNum)
		content := page.Content()

		var elems []textEl
		for _, t := range content.Text {
			elems = append(elems, textEl{X: t.X, Y: t.Y, W: t.W, S: t.S})
		}

		rows := groupByY(elems)

		// ── First pass: detect column header positions using xTokens ──────────
		// Only look at tokens in the right half of the page (X > 300) to avoid
		// false positives from description tokens that might contain keywords.
		if !cols.found {
			for _, row := range rows {
				for _, tok := range xTokens(row.Elems) {
					if tok.X <= 300 {
						continue
					}
					up := strings.ToUpper(tok.Text)
					if strings.Contains(up, "ABONOS") || strings.Contains(up, "DEPOSITOS") {
						cols.abonosX = tok.X
					}
					if strings.Contains(up, "CARGOS") || strings.Contains(up, "CHEQUES") {
						cols.cargosX = tok.X
					}
				}
				if cols.abonosX > 0 && cols.cargosX > 0 {
					cols.found = true
					break
				}
			}
		}

		// ── Second pass: extract period and transaction rows ──────────────────
		inResumen := false
		for _, row := range rows {
			toks := xTokens(row.Elems)
			if len(toks) == 0 {
				continue
			}

			line := joinRow(row.Elems)

			// Parse period (appears as "DD/MM/YYYY DD/MM/YYYY" on a header line).
			if result.PeriodFrom.IsZero() {
				if m := santanderPeriodRe.FindStringSubmatch(line); m != nil {
					pf, e1 := time.Parse("02/01/2006", m[1])
					pt, e2 := time.Parse("02/01/2006", m[2])
					if e1 == nil && e2 == nil {
						result.PeriodFrom = pf
						result.PeriodTo = pt
					}
				}
			}

			// Stop at commission summary section.
			if strings.Contains(line, "Resumen de Comisiones") {
				inResumen = true
			}
			if inResumen {
				continue
			}

			// Transaction rows: first token must be DD/MM date.
			dateToken := toks[0].Text
			isDDMM := isDateDDMM(dateToken)
			isDDMMYYYY := isDateDDMMYYYY(dateToken)
			if !isDDMM && !isDDMMYYYY {
				continue
			}

			var day, month, txYear int
			if isDDMMYYYY {
				day, month, txYear = parseDDMMYYYY(dateToken)
			} else {
				day, _ = strconv.Atoi(dateToken[:2])
				month, _ = strconv.Atoi(dateToken[3:])
			}
			if day == 0 || month == 0 {
				continue
			}

			// Collect amount tokens: numeric strings in the right-side columns.
			// Santander date/description/docnum are all at X < 350; amounts are at X >= 350.
			var amtToks []xToken
			for _, tok := range toks[1:] {
				if tok.X < 350 {
					continue
				}
				if isCLPNumber(tok.Text) {
					amtToks = append(amtToks, tok)
				}
			}
			if len(amtToks) == 0 {
				continue
			}

			// Sort amount tokens left-to-right.
			sort.Slice(amtToks, func(i, j int) bool { return amtToks[i].X < amtToks[j].X })

			// Find the transaction amount and its flow using column classification.
			// classifyByX returns "" for SALDO (beyond the two money columns).
			var txAmt int64
			var flow string
			for _, at := range amtToks {
				f := cols.classifyByX(at.X)
				if f == "" {
					continue // SALDO column — skip
				}
				v, err := parseCLPAmount(at.Text)
				if err != nil || v == 0 {
					continue
				}
				txAmt = v
				flow = f
				break // take the first classifiable amount (leftmost CARGO or ABONO)
			}

			// Fallback: if column detection failed, take the leftmost amount and use heuristic.
			if flow == "" && len(amtToks) > 0 {
				v, err := parseCLPAmount(amtToks[0].Text)
				if err == nil && v > 0 {
					txAmt = v
					flow = santanderFlowHeuristic(line)
				}
			}
			if txAmt == 0 || flow == "" {
				continue
			}

			// Build description from non-date, non-amount tokens.
			desc := santanderDesc(toks, dateToken)

			year := txYear
			if year == 0 {
				year = inferYear(day, month, result.PeriodFrom, result.PeriodTo)
			}
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

// santanderFlowHeuristic infers flow direction from known Santander description patterns.
func santanderFlowHeuristic(line string) string {
	lower := strings.ToLower(line)
	if strings.Contains(lower, "transf.") {
		return "INCOME"
	}
	if strings.Contains(lower, "transf a") ||
		strings.Contains(lower, "compra") ||
		strings.Contains(lower, "amortización") ||
		strings.Contains(lower, "intereses") ||
		strings.Contains(lower, "impuesto") ||
		strings.Contains(lower, "mantencion") {
		return "EXPENSE"
	}
	return "EXPENSE" // conservative default
}

// santanderDesc builds a clean description string from the row's xTokens,
// skipping the date, pure-digit doc numbers (5-7 digits), and amount tokens.
func santanderDesc(toks []xToken, dateToken string) string {
	var parts []string
	for _, tok := range toks {
		s := strings.TrimSpace(tok.Text)
		if s == "" || s == dateToken {
			continue
		}
		if isDateDDMM(s) || isDateDDMMYYYY(s) {
			continue
		}
		// Skip pure-digit doc numbers (typically 5-7 digits).
		if isAllDigits(s) && len(s) >= 5 && len(s) <= 7 {
			continue
		}
		// Skip amount tokens (in the right column area).
		if tok.X >= 350 && isCLPNumber(s) {
			continue
		}
		parts = append(parts, s)
	}
	return strings.Join(parts, " ")
}

func isAllDigits(s string) bool {
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return len(s) > 0
}
