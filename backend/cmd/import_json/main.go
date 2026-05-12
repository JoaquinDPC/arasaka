package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	_ "github.com/lib/pq"

	"arasaka/internal/config"
	"arasaka/internal/domain"
	"arasaka/internal/importer"
	"arasaka/internal/logger"
)

func main() {
	configPath := flag.String("config", "", "path to config.yml (required)")
	bankFlag := flag.String("bank", string(domain.BankBancoDeChile), "bank ID for description cleaning (e.g. banco_de_chile, santander)")
	flag.Parse()

	if *configPath == "" {
		fmt.Fprintln(os.Stderr, "error: -config flag is required")
		fmt.Fprintln(os.Stderr, "usage: import_json -config=<path/to/config.yml> [movimientos.json]")
		os.Exit(1)
	}

	log := logger.New()

	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	jsonPath := "../movimientos.json"
	if flag.NArg() > 0 {
		jsonPath = flag.Arg(0)
	}

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db open: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		fmt.Fprintf(os.Stderr, "db ping: %v\n", err)
		os.Exit(1)
	}

	data, err := os.ReadFile(jsonPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "read file: %v\n", err)
		os.Exit(1)
	}

	// Accept both a raw []MovimientoRecord array and an envelope { "movements": [...] }.
	var records []importer.MovimientoRecord
	if err := json.Unmarshal(data, &records); err != nil {
		var envelope struct {
			Movements []importer.MovimientoRecord `json:"movements"`
		}
		if err2 := json.Unmarshal(data, &envelope); err2 != nil {
			fmt.Fprintf(os.Stderr, "parse json (array): %v\nparse json (envelope): %v\n", err, err2)
			os.Exit(1)
		}
		records = envelope.Movements
	}

	fmt.Printf("Loaded %d records from %s\n", len(records), jsonPath)

	ctx := context.Background()
	result, err := importer.Run(ctx, db, records, time.Time{}, nil, nil, nil, domain.BankID(*bankFlag), log)
	if err != nil {
		fmt.Fprintf(os.Stderr, "import: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Bank transactions  → inserted: %d | duplicates: %d\n", result.BankImported, result.BankDuplicates)
	for _, cc := range result.CCStatements {
		fmt.Printf("CC %-45s → statement id: %d | items: %d | dupes: %d\n",
			cc.AccountID, cc.StatementID, cc.ItemsImported, cc.ItemsDuplicates)
	}
}
