package pdfparser

import (
	"bytes"
	"strings"

	"rsc.io/pdf"
)

// DetectBancoChilePDF inspects PDF content to classify it as:
//
//	"debit":       a debit account statement (cartola or partial export)
//	"credit_card": a credit card statement
//	"unknown":     unrecognized Banco de Chile format
//
// encrypted is true when the PDF is password-protected (rsc.io/pdf cannot open it).
// In BdC's case, encrypted PDFs are always CC statements.
func DetectBancoChilePDF(data []byte) (docType string, encrypted bool, err error) {
	r, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		// rsc.io/pdf fails on encrypted PDFs; BdC CC statements are always encrypted.
		return "credit_card", true, nil
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

	if strings.Contains(upper, "TARJETA DE CR") {
		return "credit_card", false, nil
	}
	if strings.Contains(upper, "CUENTA CORRIENTE") ||
		strings.Contains(upper, "SALDO AL") ||
		strings.Contains(upper, "MOVIMIENTOS AL") ||
		strings.Contains(upper, "SALDO DISPONIBLE") {
		return "debit", false, nil
	}
	return "unknown", false, nil
}
