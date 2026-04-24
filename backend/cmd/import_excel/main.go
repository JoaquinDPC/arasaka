package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"github.com/xuri/excelize/v2"

	"arasaka/internal/config"
	"arasaka/internal/domain"
	"arasaka/internal/repository"
)

var excelEpoch = time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)

func main() {
	configPath := flag.String("config", "", "path to config.yml (required)")
	flag.Parse()

	if *configPath == "" {
		fmt.Fprintln(os.Stderr, "error: -config flag is required")
		fmt.Fprintln(os.Stderr, "usage: import_excel -config=<path/to/config.yml> [xlsx-path]")
		os.Exit(1)
	}

	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	dbURL := cfg.DatabaseURL

	xlsxPath := "../presupuesto-2026.xlsx"
	if flag.NArg() > 0 {
		xlsxPath = flag.Arg(0)
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db open: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		fmt.Fprintf(os.Stderr, "db ping: %v\n", err)
		os.Exit(1)
	}

	f, err := excelize.OpenFile(xlsxPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open xlsx: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	rows, err := f.GetRows("Movimientos mensuales")
	if err != nil {
		fmt.Fprintf(os.Stderr, "read sheet: %v\n", err)
		os.Exit(1)
	}

	var params []domain.CreateTransactionParams
	skipped := 0

	for i, row := range rows {
		if i < 2 { // row 0 = title, row 1 = headers
			continue
		}
		if len(row) < 8 {
			continue
		}

		dateStr := strings.TrimSpace(row[0])
		if dateStr == "" {
			continue
		}
		date, err := parseDate(dateStr)
		if err != nil {
			skipped++
			continue
		}

		flow := ""
		if len(row) > 3 {
			flow = strings.TrimSpace(row[3])
		}
		if flow == "" {
			skipped++
			continue
		}

		amountStr := strings.TrimSpace(row[7])
		if amountStr == "" {
			skipped++
			continue
		}
		amountStr = strings.ReplaceAll(amountStr, ",", "")
		amountStr = strings.ReplaceAll(amountStr, "$", "")
		amountF, err := strconv.ParseFloat(amountStr, 64)
		if err != nil {
			skipped++
			continue
		}
		amount := int64(amountF)
		if amount < 0 {
			amount = -amount
		}

		description := strings.TrimSpace(row[1])
		category := ""
		if len(row) > 2 {
			category = strings.TrimSpace(row[2])
		}

		var subtype *string
		if len(row) > 4 {
			if s := strings.TrimSpace(row[4]); s != "" {
				subtype = &s
			}
		}

		var asset *string
		if len(row) > 5 {
			if a := strings.TrimSpace(row[5]); a != "" {
				asset = &a
			}
		}

		var quantity *float64
		if len(row) > 6 {
			if q := strings.TrimSpace(row[6]); q != "" {
				if qf, err := strconv.ParseFloat(q, 64); err == nil {
					quantity = &qf
				}
			}
		}

		var notes *string
		if len(row) > 8 {
			if n := strings.TrimSpace(row[8]); n != "" {
				notes = &n
			}
		}

		rawID := excelRawID(date, description, amount, category, flow, i)

		params = append(params, domain.CreateTransactionParams{
			Date:        date,
			Description: description,
			Category:    category,
			Flow:        flow,
			Subtype:     subtype,
			Asset:       asset,
			Quantity:    quantity,
			Amount:      amount,
			Notes:       notes,
			Source:      "excel_import",
			BankRawID:   &rawID,
		})
	}

	fmt.Printf("Parsed %d entries (%d skipped)\n", len(params), skipped)
	if len(params) == 0 {
		fmt.Println("Nothing to import.")
		return
	}

	repo := repository.NewTransactionRepository(db)
	imported, duplicates, err := repo.CreateBatch(context.Background(), params)
	if err != nil {
		fmt.Fprintf(os.Stderr, "insert: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Inserted: %d | Duplicates: %d\n", imported, duplicates)
}

func excelRawID(date time.Time, description string, amount int64, category, flow string, rowIndex int) string {
	key := fmt.Sprintf("xl|%s|%s|%d|%s|%s|%d",
		date.Format("2006-01-02"), description, amount, category, flow, rowIndex)
	h := sha256.Sum256([]byte(key))
	return fmt.Sprintf("xl_%x", h[:8])
}

func parseDate(s string) (time.Time, error) {
	formats := []string{
		"2006-01-02",
		"2006/01/02",
		"02/01/2006",
		"2/1/2006",
		"01/02/2006",
		"1/2/2006",
		"2006-01-02 15:04:05",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t, nil
		}
	}
	if n, err := strconv.ParseFloat(s, 64); err == nil && n > 1000 {
		return excelEpoch.AddDate(0, 0, int(n)), nil
	}
	return time.Time{}, fmt.Errorf("unrecognised date format: %q", s)
}

