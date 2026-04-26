package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"fintself/internal/output"
	"fintself/internal/scraper"

	// Import all bank scrapers so their init() functions register themselves.
	_ "fintself/internal/scraper/cl"

	"github.com/spf13/cobra"
)

func main() {
	log.SetFlags(0)
	if err := rootCmd().Execute(); err != nil {
		os.Exit(1)
	}
}

func rootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:   "fintself",
		Short: "Fintself: open-source collaborative bank transaction scraper.",
		Long: `Fintself automates extraction of financial movements from Chilean banks.
It exports data as XLSX, CSV, or JSON and can be used as a CLI tool or Go library.`,
	}
	root.AddCommand(listCmd(), scrapeCmd())
	return root
}

func listCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "Lists all available bank scrapers.",
		RunE: func(cmd *cobra.Command, args []string) error {
			scrapers := scraper.List()
			if len(scrapers) == 0 {
				fmt.Println("No available scrapers found.")
				return nil
			}
			fmt.Println("Available bank scrapers:")
			for id, desc := range scrapers {
				fmt.Printf("  - %s: %s\n", id, desc)
			}
			return nil
		},
	}
}

func scrapeCmd() *cobra.Command {
	var outputFile string
	var outputFormat string
	var headless *bool
	var debugMode *bool

	headlessFlag := new(bool)
	debugFlag := new(bool)

	cmd := &cobra.Command{
		Use:   "scrape <bank_id>",
		Short: "Executes a scraper to extract bank movements.",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			bankID := args[0]

			if outputFile == "" && outputFormat == "" {
				return fmt.Errorf("specify --output-file to save or --output-format (json|csv) to print to console")
			}
			if outputFile != "" && outputFormat != "" {
				fmt.Fprintln(os.Stderr, "warning: both --output-file and --output-format given; --output-file takes precedence")
				outputFormat = ""
			}

			fileFormat := ""
			if outputFile != "" {
				ext := strings.ToLower(filepath.Ext(outputFile))
				switch ext {
				case ".xlsx", ".csv", ".json":
					fileFormat = strings.TrimPrefix(ext, ".")
				default:
					return fmt.Errorf("unsupported file extension %q; use .xlsx, .csv, or .json", ext)
				}
			}

			if cmd.Flags().Changed("headless") {
				headless = headlessFlag
			}
			if cmd.Flags().Changed("debug") {
				debugMode = debugFlag
			}

			user, password, err := resolveCredentials(bankID)
			if err != nil {
				return err
			}

			s, err := scraper.Get(bankID, headless, debugMode)
			if err != nil {
				return err
			}

			movements, err := s.Scrape(user, password)
			if err != nil {
				return fmt.Errorf("scraping error: %w", err)
			}
			if len(movements) == 0 {
				fmt.Println("No movements found.")
				return nil
			}

			if outputFile != "" {
				switch fileFormat {
				case "xlsx":
					err = output.SaveXLSX(movements, outputFile)
				case "csv":
					err = output.SaveCSV(movements, outputFile)
				case "json":
					err = output.SaveJSON(movements, outputFile)
				}
				if err != nil {
					return err
				}
				fmt.Printf("Scraping completed. Data saved to %s\n", outputFile)
				return nil
			}

			var data string
			switch outputFormat {
			case "json":
				data, err = output.FormatJSON(movements)
			case "csv":
				data, err = output.FormatCSV(movements)
			default:
				return fmt.Errorf("output format %q not valid; use json or csv", outputFormat)
			}
			if err != nil {
				return err
			}
			fmt.Print(data)
			return nil
		},
	}

	cmd.Flags().StringVarP(&outputFile, "output-file", "o", "", "Output file path (format inferred from extension: .xlsx, .csv, .json)")
	cmd.Flags().StringVarP(&outputFormat, "output-format", "f", "", "Console output format if no file is given (json|csv)")
	cmd.Flags().BoolVar(headlessFlag, "headless", false, "Run browser in headless mode (may not work with all banks)")
	cmd.Flags().BoolVar(debugFlag, "debug", false, "Enable debug mode (saves screenshots and HTML on each step)")

	return cmd
}

// resolveCredentials reads credentials from environment variables (e.g. CL_SANTANDER_USER)
// and falls back to interactive prompts if not set.
func resolveCredentials(bankID string) (user, password string, err error) {
	prefix := strings.ToUpper(strings.ReplaceAll(bankID, "-", "_"))
	user = os.Getenv(prefix + "_USER")
	password = os.Getenv(prefix + "_PASSWORD")

	if user == "" {
		fmt.Printf("Username for %s: ", bankID)
		if _, err = fmt.Scanln(&user); err != nil {
			return "", "", fmt.Errorf("could not read username: %w", err)
		}
	}
	if password == "" {
		fmt.Printf("Password for %s: ", bankID)
		if _, err = fmt.Scanln(&password); err != nil {
			return "", "", fmt.Errorf("could not read password: %w", err)
		}
	}
	return user, password, nil
}
