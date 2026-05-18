package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"strings"

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
		Long: `Fintself automates extraction of financial movements from Chilean banks
and imports them directly into the Arasaka backend.`,
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
	var serverURL string
	var accountID int64
	var token string
	var headlessFlag = new(bool)
	var debugFlag = new(bool)

	cmd := &cobra.Command{
		Use:   "scrape <bank_id>",
		Short: "Scrapes bank movements and imports them into the server.",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			bankID := args[0]

			if accountID == 0 {
				return fmt.Errorf("--account-id is required")
			}
			if token == "" {
				return fmt.Errorf("--token is required")
			}

			var headless, debugMode *bool
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

			type txItem struct {
				Date        string `json:"date"`
				Description string `json:"description"`
				Flow        string `json:"flow"`
				Amount      int64  `json:"amount"`
			}
			type bulkReq struct {
				AccountID    int64    `json:"account_id"`
				Transactions []txItem `json:"transactions"`
			}

			items := make([]txItem, 0, len(movements))
			for _, m := range movements {
				flow := "EXPENSE"
				if m.Amount >= 0 {
					flow = "INCOME"
				}
				items = append(items, txItem{
					Date:        m.Date.Format("2006-01-02"),
					Description: m.Description,
					Flow:        flow,
					Amount:      int64(math.Round(math.Abs(m.Amount))),
				})
			}

			body, err := json.Marshal(bulkReq{AccountID: accountID, Transactions: items})
			if err != nil {
				return fmt.Errorf("marshal error: %w", err)
			}

			req, err := http.NewRequest(http.MethodPost, serverURL+"/api/transactions/bulk", bytes.NewReader(body))
			if err != nil {
				return fmt.Errorf("request error: %w", err)
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+token)

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return fmt.Errorf("server error: %w", err)
			}
			defer resp.Body.Close()

			respBody, _ := io.ReadAll(resp.Body)
			if resp.StatusCode != http.StatusOK {
				return fmt.Errorf("server returned %d: %s", resp.StatusCode, respBody)
			}

			var result map[string]int
			if err := json.Unmarshal(respBody, &result); err != nil {
				fmt.Printf("Scraping completed. Server response: %s\n", respBody)
				return nil
			}
			fmt.Printf("Imported %d, duplicates %d\n", result["imported"], result["duplicates"])
			return nil
		},
	}

	cmd.Flags().StringVar(&serverURL, "server-url", "http://localhost:8080", "Backend server base URL")
	cmd.Flags().Int64Var(&accountID, "account-id", 0, "Backend account ID to import movements into")
	cmd.Flags().StringVar(&token, "token", "", "JWT bearer token for backend authentication")
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
