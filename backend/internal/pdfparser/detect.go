package pdfparser

import (
	"bytes"
	"strings"

	"rsc.io/pdf"
)

// PDFDocType identifies the kind of PDF document detected.
type PDFDocType string

const (
	DocTypeDebitMonthly PDFDocType = "debit_monthly" // full-month debit cartola (CARTOLA N° format)
	DocTypeDebitPartial PDFDocType = "debit_partial" // partial debit export (Movimientos al / Saldo al format)
	DocTypeCreditCard   PDFDocType = "credit_card"   // credit card statement
	DocTypeDebit        PDFDocType = "debit"         // generic debit (non-BdC banks, e.g. Santander)
	DocTypeUnknown      PDFDocType = "unknown"       // unrecognized format
)

// DetectBancoChilePDF inspects PDF content to classify it as one of the PDFDocType constants.
// encrypted is true when the PDF is password-protected (rsc.io/pdf cannot open it).
// In BdC's case, encrypted PDFs are always CC statements.
func DetectBancoChilePDF(data []byte) (docType PDFDocType, encrypted bool, err error) {
	r, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		// rsc.io/pdf fails on encrypted PDFs; BdC CC statements are always encrypted.
		return DocTypeCreditCard, true, nil
	}

	var sb strings.Builder
	maxPages := r.NumPage()
	if maxPages > 2 {
		maxPages = 2
	}
	for i := 1; i <= maxPages; i++ {
		page := r.Page(i)
		for _, t := range page.Content().Text {
			sb.WriteString(t.S)
			sb.WriteString(" ")
		}
	}
	upper := strings.ToUpper(sb.String())
	// BdC encodes each glyph as a separate text element, producing spaced output
	// like "S A L D O  D I S P O N I B L E". Strip spaces for keyword matching.
	compact := strings.ReplaceAll(upper, " ", "")

	// Check debit types first — debit cartolas may contain "TARJETA DE CREDITO"
	// in transaction descriptions, so credit_card must not be checked first.

	// Partial cartola: "Movimientos al <date>" header — unique to partial exports.
	if strings.Contains(upper, "MOVIMIENTOS AL") || strings.Contains(compact, "MOVIMIENTOSAL") {
		return DocTypeDebitPartial, false, nil
	}
	// Monthly cartola: SALDO DISPONIBLE / CUENTA CORRIENTE in header.
	// CC PDFs use CUPO DISPONIBLE instead of SALDO DISPONIBLE.
	if strings.Contains(upper, "CUENTA CORRIENTE") || strings.Contains(compact, "CUENTACORRIENTE") ||
		strings.Contains(upper, "SALDO DISPONIBLE") || strings.Contains(compact, "SALDODISPONIBLE") {
		return DocTypeDebitMonthly, false, nil
	}
	// Credit card: only reached when no debit header was found.
	if strings.Contains(upper, "TARJETA DE CR") || strings.Contains(compact, "TARJETADECR") {
		return DocTypeCreditCard, false, nil
	}
	return DocTypeUnknown, false, nil
}
