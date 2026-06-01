package pdfparser

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"rsc.io/pdf"
)

var santanderPeriodRe = regexp.MustCompile(`(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})`)

// santanderPDFminerDescs runs pdfminer via Python subprocess to extract the description
// column text (X in [109, 350)) for each row, keyed by rounded Y coordinate.
// Returns nil if pdfminer is unavailable or fails — caller falls back to rsc.io/pdf.
func santanderPDFminerDescs(data []byte) map[float64]string {
	const script = `
import sys, json, io
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTChar
data = sys.stdin.buffer.read()
out = {}
for pg in extract_pages(io.BytesIO(data)):
    chars = []
    def collect(item):
        if isinstance(item, LTChar):
            chars.append((round(item.x0,2), round(item.y0,2), item.get_text()))
        elif hasattr(item,'__iter__'):
            for c in item: collect(c)
    collect(pg)
    buckets = {}
    for x,y,s in chars:
        found = None
        for yk in buckets:
            if abs(yk-y) <= 2.0:
                found = yk
                break
        if found is None:
            found = y
            buckets[y] = []
        buckets[found].append((x,s))
    for yk, chs in buckets.items():
        desc = sorted([(x,s) for x,s in chs if 109<=x<327], key=lambda t:t[0])
        if desc:
            t = ''.join(s for _,s in desc).strip()
            if t:
                out["%.2f" % yk] = t
print(json.dumps(out))
`
	cmd := exec.Command("python3", "-c", script)
	cmd.Stdin = bytes.NewReader(data)
	raw, err := cmd.Output()
	if err != nil {
		return nil
	}
	var m map[string]string
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil
	}
	result := make(map[float64]string, len(m))
	for k, v := range m {
		var y float64
		fmt.Sscanf(k, "%f", &y)
		result[y] = v
	}
	return result
}

// santanderDescLookup finds the pdfminer description for a rsc.io/pdf row Y.
// rsc.io/pdf Y is typically ~1.5pt above pdfminer y0; search within ±3pt.
func santanderDescLookup(descs map[float64]string, rscY float64) string {
	if descs == nil {
		return ""
	}
	best, bestDist := "", 4.0
	for y, text := range descs {
		if d := math.Abs(y - rscY); d < bestDist {
			bestDist = d
			best = text
		}
	}
	return best
}

// santanderCleanDesc strips leading doc-number tokens (pure digits, len ≥ 5)
// from a pdfminer-extracted description and trims whitespace.
func santanderCleanDesc(raw string) string {
	parts := strings.Fields(raw)
	var result []string
	for _, p := range parts {
		if isAllDigits(p) && len(p) >= 5 {
			continue
		}
		result = append(result, p)
	}
	return strings.Join(result, " ")
}

// ParseSantander parses a Banco Santander Chile cuenta-corriente cartola PDF.
// It extracts transactions from the "DETALLE DE MOVIMIENTOS" table and stops
// when it reaches the "Resumen de Comisiones" section.
func ParseSantander(data []byte) (ParseResult, error) {
	// Pre-extract descriptions with correct word spacing via pdfminer.
	// Falls back to rsc.io/pdf-based reconstruction if Python/pdfminer unavailable.
	pdfDescs := santanderPDFminerDescs(data)

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
					if math.Abs(cols.abonosX-cols.cargosX) < 30 {
						// Positions too close — likely a false positive (e.g. a summary row
						// containing both keywords). Reset and keep scanning.
						cols.abonosX = 0
						cols.cargosX = 0
						continue
					}
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

			// Heuristic pre-filter: if the description clearly indicates income, trust it
			// and skip column classification. Column X positions may be wrong in some PDF
			// variants (e.g. a false-positive header row sets wrong abonosX/cargosX).
			heuristicFlow := santanderFlowHeuristic(line)

			var txAmt int64
			var flow string

			if heuristicFlow == "INCOME" {
				// High-confidence income — take the leftmost amount token.
				if v, err := parseCLPAmount(amtToks[0].Text); err == nil && v > 0 {
					txAmt = v
					flow = "INCOME"
				}
			} else {
				// No high-confidence income signal. Try column-based classification.
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
				// Column classification failed — fall back to heuristic (EXPENSE by default).
				if flow == "" && len(amtToks) > 0 {
					if v, err := parseCLPAmount(amtToks[0].Text); err == nil && v > 0 {
						txAmt = v
						flow = heuristicFlow
					}
				}
			}
			if txAmt == 0 || flow == "" {
				continue
			}

			// Build description: prefer pdfminer (correct spacing), fall back to W-based.
			desc := santanderDescLookup(pdfDescs, row.Y)
			if desc != "" {
				desc = santanderCleanDesc(desc)
			} else {
				desc = santanderDesc(row.Elems, dateToken)
			}

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
	// Income patterns: transfers received, deposits, salary credits.
	if strings.Contains(lower, "transf.") ||
		strings.Contains(lower, "transferencia") ||
		strings.Contains(lower, "deposito") ||
		strings.Contains(lower, "depósito") ||
		strings.Contains(lower, "abono") ||
		strings.Contains(lower, "remuneracion") ||
		strings.Contains(lower, "remuneración") ||
		strings.Contains(lower, "sueldo") ||
		strings.Contains(lower, "remesa") {
		return "INCOME"
	}
	// Expense patterns.
	if strings.Contains(lower, "transf a") ||
		strings.Contains(lower, "compra") ||
		strings.Contains(lower, "amortización") ||
		strings.Contains(lower, "amortizacion") ||
		strings.Contains(lower, "intereses") ||
		strings.Contains(lower, "impuesto") ||
		strings.Contains(lower, "mantencion") ||
		strings.Contains(lower, "mantención") ||
		strings.Contains(lower, "cargo") ||
		strings.Contains(lower, "comision") ||
		strings.Contains(lower, "comisión") {
		return "EXPENSE"
	}
	return "EXPENSE" // conservative default
}

// santanderWordGapPt is the deviation from the expected next-character position
// (prev.X + prev.W) that signals a word boundary. Handles both glyph-spaced PDFs
// (each char is its own element) and word-level PDFs (same-column encoding).
const santanderWordGapPt = 1.5

// santanderDesc builds a clean description from the row's raw text elements.
// It reconstructs words from the individual elements by detecting boundaries via
// glyph advance widths (W), then filters out date tokens, branch codes, and
// numeric doc numbers.
func santanderDesc(elems []textEl, dateToken string) string {
	words := santanderReconstructWords(elems)
	var parts []string
	for _, w := range words {
		if w == dateToken || isDateDDMM(w) || isDateDDMMYYYY(w) {
			continue
		}
		// Skip Santander branch code prefixes: e.g. "O.Gerencia", "G.Gerencia".
		if len(w) >= 3 && w[1] == '.' && w[0] >= 'A' && w[0] <= 'Z' && isAllAlpha(w[2:]) {
			continue
		}
		// Skip numeric codes (doc numbers, account numbers) of length ≥ 5.
		if isAllDigits(w) && len(w) >= 5 {
			continue
		}
		parts = append(parts, w)
	}
	return strings.Join(parts, " ")
}

// santanderReconstructWords groups raw text elements into words using glyph-advance
// gap detection. A word boundary is detected when |next.X - (prev.X + prev.W)| exceeds
// santanderWordGapPt. This covers both glyph-spaced PDFs (each character is a
// separate element with a unique X) and word-level PDFs where multiple words share the
// same column X (same-column encoding causes diff to be large and negative).
func santanderReconstructWords(elems []textEl) []string {
	// Exclude amount columns; keep everything to the left.
	var filtered []textEl
	for _, e := range elems {
		if e.X < 350 {
			filtered = append(filtered, e)
		}
	}
	if len(filtered) == 0 {
		return nil
	}

	var words []string
	var cur strings.Builder
	cur.WriteString(filtered[0].S)

	for i := 1; i < len(filtered); i++ {
		prev := filtered[i-1]
		curr := filtered[i]
		// Deviation from the position predicted by the previous element's advance width.
		deviation := math.Abs(curr.X - (prev.X + prev.W))
		if deviation > santanderWordGapPt {
			if cur.Len() > 0 {
				words = append(words, cur.String())
				cur.Reset()
			}
		}
		cur.WriteString(curr.S)
	}
	if cur.Len() > 0 {
		words = append(words, cur.String())
	}
	return words
}

func isAllDigits(s string) bool {
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return len(s) > 0
}

// isAllAlpha reports whether every byte in s is an ASCII letter.
func isAllAlpha(s string) bool {
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
			return false
		}
	}
	return len(s) > 0
}
