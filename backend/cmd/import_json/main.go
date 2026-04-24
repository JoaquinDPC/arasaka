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
	"arasaka/internal/importer"
)

func main() {
	configPath := flag.String("config", "", "path to config.yml (required)")
	flag.Parse()

	if *configPath == "" {
		fmt.Fprintln(os.Stderr, "error: -config flag is required")
		fmt.Fprintln(os.Stderr, "usage: import_json -config=<path/to/config.yml> [movimientos.json]")
		os.Exit(1)
	}

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

	var records []importer.MovimientoRecord
	if err := json.Unmarshal(data, &records); err != nil {
		fmt.Fprintf(os.Stderr, "parse json: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Loaded %d records from %s\n", len(records), jsonPath)

	ctx := context.Background()
	result, err := importer.Run(ctx, db, records, time.Time{})
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
