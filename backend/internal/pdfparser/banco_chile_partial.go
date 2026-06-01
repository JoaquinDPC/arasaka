package pdfparser

import (
	"bytes"
	"fmt"
	"math"
	"strings"
	"time"

	"rsc.io/pdf"
)

// X column thresholds for Banco de Chile partial movement export PDFs.
// Partial exports differ from the monthly cartola: text is not glyph-spaced,
// dates are full DD/MM/YYYY, and flow is determined by Cargos vs Abonos column position.
const (
	bdcpDateX      = 53.0  // date column (DD/MM/YYYY)
	bdcpCargosMinX = 295.0 // Cargos (EXPENSE) left bound
	bdcpAbonosMinX = 390.0 // Abonos (INCOME) left bound
	bdcpSaldoMinX  = 475.0 // Saldo (running balance) — ignored
)

// ParseBancoChilePartial parses a Banco de Chile partial movement export PDF.
// Each page is processed; multi-line descriptions are joined into a single row.
func ParseBancoChilePartial(data []byte) (ParseResult, error) {
	r, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return ParseResult{}, fmt.Errorf("banco_chile_partial: open pdf: %w", err)
	}

	var result ParseResult
	var pRow *Row
	var pDesc strings.Builder

	flushRow := func() {
		if pRow == nil {
			return
		}
		pRow.Description = strings.TrimSpace(pDesc.String())
		if pRow.Description != "" && !bdcShouldSkip(pRow.Description) {
			result.Rows = append(result.Rows, *pRow)
		}
		pRow = nil
		pDesc.Reset()
	}

	for pageNum := 1; pageNum <= r.NumPage(); pageNum++ {
		page := r.Page(pageNum)
		var elems []textEl
		for _, t := range page.Content().Text {
			elems = append(elems, textEl{X: t.X, Y: t.Y, W: t.W, S: t.S})
		}

		for _, rg := range groupByY(elems) {
			toks := xTokens(rg.Elems)
			if len(toks) == 0 {
				continue
			}

			// Period end: header line containing "Saldo al DD/MM/YYYY".
			if result.PeriodTo.IsZero() {
				upper := strings.ToUpper(joinRow(rg.Elems))
				if strings.Contains(upper, "SALDO AL") {
					for _, tok := range toks {
						if isDateDDMMYYYY(tok.Text) {
							d, m, y := parseDDMMYYYY(tok.Text)
							result.PeriodTo = time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC)
						}
					}
				}
			}

			// Locate date token at X≈bdcpDateX.
			var dateTok *xToken
			for i := range toks {
				if math.Abs(toks[i].X-bdcpDateX) < 15 && isDateDDMMYYYY(toks[i].Text) {
					dateTok = &toks[i]
					break
				}
			}

			if dateTok == nil {
				// Continuation line: append description text to the pending row.
				if pRow != nil {
					for _, tok := range toks {
						if tok.X < bdcpCargosMinX {
							s := strings.TrimSpace(tok.Text)
							if s != "" {
								if pDesc.Len() > 0 {
									pDesc.WriteString(" ")
								}
								pDesc.WriteString(s)
							}
						}
					}
				}
				continue
			}

			// New transaction line — flush previous row first.
			flushRow()

			d, m, y := parseDDMMYYYY(dateTok.Text)
			if d == 0 || m == 0 || y == 0 {
				continue
			}

			// Classify amount by column position (Cargos = EXPENSE, Abonos = INCOME).
			var amount int64
			var flow string
			for _, tok := range toks {
				s := strings.TrimSpace(tok.Text)
				if !isCLPNumber(s) {
					continue
				}
				if tok.X >= bdcpCargosMinX && tok.X < bdcpAbonosMinX {
					if v, e2 := parseCLPAmount(s); e2 == nil && v > 0 {
						amount = v
						flow = "EXPENSE"
					}
				} else if tok.X >= bdcpAbonosMinX && tok.X < bdcpSaldoMinX {
					if v, e2 := parseCLPAmount(s); e2 == nil && v > 0 {
						amount = v
						flow = "INCOME"
					}
				}
			}

			if amount == 0 || flow == "" {
				continue
			}

			date := time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC)
			if result.PeriodFrom.IsZero() {
				result.PeriodFrom = date
			}

			pRow = &Row{Date: date, Amount: amount, Flow: flow}

			// Collect description tokens between date X and cargos X.
			for _, tok := range toks {
				if tok.X > bdcpDateX+5 && tok.X < bdcpCargosMinX {
					s := strings.TrimSpace(tok.Text)
					if s != "" {
						if pDesc.Len() > 0 {
							pDesc.WriteString(" ")
						}
						pDesc.WriteString(s)
					}
				}
			}
		}

		flushRow()
	}

	return result, nil
}
