package output

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"fintself/internal/models"
	finterrors "fintself/internal/errors"

	"github.com/xuri/excelize/v2"
)

var headers = []string{
	"date", "description", "amount", "currency",
	"transaction_type", "account_id", "account_type",
}

func toRow(m *models.Movement) []string {
	return []string{
		m.Date.Format("2006-01-02T15:04:05"),
		m.Description,
		strconv.FormatFloat(m.Amount, 'f', 2, 64),
		m.Currency,
		m.TransactionType,
		m.AccountID,
		string(m.AccountType),
	}
}

// SaveXLSX writes movements to an Excel file at filePath.
func SaveXLSX(movements []*models.Movement, filePath string) error {
	f := excelize.NewFile()
	sheet := "Movements"
	f.SetSheetName("Sheet1", sheet)

	for col, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(col+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	for row, m := range movements {
		for col, val := range toRow(m) {
			cell, _ := excelize.CoordinatesToCellName(col+1, row+2)
			f.SetCellValue(sheet, cell, val)
		}
	}

	if err := f.SaveAs(filePath); err != nil {
		return finterrors.NewOutputError(fmt.Sprintf("could not save XLSX: %v", err))
	}
	return nil
}

// SaveCSV writes movements to a CSV file at filePath.
func SaveCSV(movements []*models.Movement, filePath string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return finterrors.NewOutputError(fmt.Sprintf("could not create CSV file: %v", err))
	}
	defer file.Close()

	w := csv.NewWriter(file)
	if err := w.Write(headers); err != nil {
		return finterrors.NewOutputError(fmt.Sprintf("could not write CSV headers: %v", err))
	}
	for _, m := range movements {
		if err := w.Write(toRow(m)); err != nil {
			return finterrors.NewOutputError(fmt.Sprintf("could not write CSV row: %v", err))
		}
	}
	w.Flush()
	return nil
}

// SaveJSON writes movements to a JSON file at filePath.
func SaveJSON(movements []*models.Movement, filePath string) error {
	data, err := json.MarshalIndent(movements, "", "  ")
	if err != nil {
		return finterrors.NewOutputError(fmt.Sprintf("could not marshal JSON: %v", err))
	}
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return finterrors.NewOutputError(fmt.Sprintf("could not write JSON file: %v", err))
	}
	return nil
}

// FormatCSV returns movements as a CSV string (for console output).
func FormatCSV(movements []*models.Movement) (string, error) {
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	if err := w.Write(headers); err != nil {
		return "", finterrors.NewOutputError(fmt.Sprintf("could not write CSV headers: %v", err))
	}
	for _, m := range movements {
		if err := w.Write(toRow(m)); err != nil {
			return "", finterrors.NewOutputError(fmt.Sprintf("could not write CSV row: %v", err))
		}
	}
	w.Flush()
	return sb.String(), nil
}

// FormatJSON returns movements as an indented JSON string (for console output).
func FormatJSON(movements []*models.Movement) (string, error) {
	data, err := json.MarshalIndent(movements, "", "  ")
	if err != nil {
		return "", finterrors.NewOutputError(fmt.Sprintf("could not marshal JSON: %v", err))
	}
	return string(data), nil
}
