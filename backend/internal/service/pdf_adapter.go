package service

import (
	"strconv"
	"time"

	"arasaka/internal/pdfparser"
)

// PDFRowsToBankRecords converts parsed PDF rows to the canonical BankRecord format
// so they can flow through the shared processDebitBatch pipeline.
func PDFRowsToBankRecords(rows []pdfparser.Row, externalAccountID string) []BankRecord {
	out := make([]BankRecord, 0, len(rows))
	for _, r := range rows {
		txType := "Cargo"
		if r.Flow == "INCOME" {
			txType = "Abono"
		}
		out = append(out, BankRecord{
			Date:            r.Date.Format(time.RFC3339),
			Description:     r.Description,
			Amount:          strconv.FormatInt(r.Amount, 10),
			Currency:        "CLP",
			TransactionType: txType,
			AccountID:       externalAccountID,
			AccountType:     accountTypeChecking,
			Source:          "pdf",
			RawData: RawData{
				DateStr: r.Date.Format("2006-01-02"),
			},
		})
	}
	return out
}
