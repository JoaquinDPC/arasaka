package cl

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"fintself/internal/models"
	"fintself/internal/scraper"
)

func init() {
	scraper.Register("cl_santander", scraper.Descriptor{
		Description: "Scraper for Banco Santander Chile.",
		Factory: func(headless, debugMode *bool) scraper.Runnable {
			return &SantanderScraper{Base: scraper.NewBase(headless, debugMode)}
		},
	})
}

// SantanderScraper extracts movements from Banco Santander Chile's online banking.
type SantanderScraper struct {
	*scraper.Base
	checkingAccountID string
	creditCardIDs     []string
}

func (s *SantanderScraper) BankID() string { return "cl_santander" }

func (s *SantanderScraper) Scrape(user, password string) ([]*models.Movement, error) {
	return scraper.Run(s, s.Base, user, password)
}

// Login navigates to the Santander portal and authenticates with the provided credentials.
func (s *SantanderScraper) Login() error {
	const loginURL = "https://banco.santander.cl/personas"

	if err := s.Navigate(loginURL, nil); err != nil {
		return err
	}

	// TODO: Update the selectors below if Santander changes its portal HTML.
	if err := s.Fill("#rut", s.User, nil); err != nil {
		return err
	}
	if err := s.Click("#btn-continuar", nil, false); err != nil {
		return err
	}
	if err := s.Fill("#clave", s.Password, nil); err != nil {
		return err
	}
	if err := s.Click("#btn-ingresar", nil, false); err != nil {
		return err
	}

	// Wait for the dashboard to confirm a successful login.
	if _, err := s.WaitFor(".dashboard-container", "visible", nil); err != nil {
		return fmt.Errorf("login failed or dashboard did not load: %w", err)
	}

	if err := s.detectAccounts(); err != nil {
		return err
	}

	return nil
}

// detectAccounts reads account and credit-card identifiers from the dashboard.
func (s *SantanderScraper) detectAccounts() error {
	// TODO: Update selector for the checking-account number shown on the dashboard.
	if loc, err := s.WaitFor(".cuenta-corriente .numero-cuenta", "visible", nil); err == nil {
		if text, err := loc.First().InnerText(); err == nil {
			s.checkingAccountID = models.FormatAccountID(strings.TrimSpace(text))
		}
	}

	// TODO: Update selector for the credit-card carousel items.
	cards := s.Page.Locator(".tarjeta-credito-item")
	count, _ := cards.Count()
	for i := 0; i < count; i++ {
		if text, err := cards.Nth(i).InnerText(); err == nil {
			s.creditCardIDs = append(s.creditCardIDs, models.FormatAccountID(strings.TrimSpace(text)))
		}
	}
	return nil
}

// ScrapeMovements collects movements from the checking account and all detected credit cards.
func (s *SantanderScraper) ScrapeMovements() ([]*models.Movement, error) {
	var all []*models.Movement

	debitMovements, err := s.extractDebitMovements()
	if err != nil {
		return nil, err
	}
	all = append(all, debitMovements...)

	for _, cardID := range s.creditCardIDs {
		creditMovements, err := s.extractCreditMovements(cardID)
		if err != nil {
			return nil, err
		}
		all = append(all, creditMovements...)
	}

	return all, nil
}

// extractDebitMovements scrapes the checking-account transaction history.
func (s *SantanderScraper) extractDebitMovements() ([]*models.Movement, error) {
	// TODO: Update the URL / selector path to the checking-account movements page.
	if err := s.Navigate("https://banco.santander.cl/personas/mi-cuenta/movimientos", nil); err != nil {
		return nil, err
	}

	return s.parseMovementsTable(".tabla-movimientos-cc", models.AccountTypeCorriente, s.checkingAccountID, "CLP")
}

// extractCreditMovements scrapes billed and unbilled transactions for a credit card.
func (s *SantanderScraper) extractCreditMovements(cardID string) ([]*models.Movement, error) {
	// TODO: Navigate to the specific credit-card movements page (may require clicking a carousel).
	if err := s.Navigate("https://banco.santander.cl/personas/mi-cuenta/tarjeta-credito", nil); err != nil {
		return nil, err
	}

	var all []*models.Movement
	for _, currency := range []string{"CLP", "USD"} {
		// TODO: Switch between currency tabs using the correct selector.
		tabSelector := fmt.Sprintf(".tab-moneda[data-currency='%s']", strings.ToLower(currency))
		_ = s.Click(tabSelector, nil, false)

		movements, err := s.parseMovementsTable(".tabla-movimientos-tc", models.AccountTypeCredito, cardID, currency)
		if err != nil {
			return nil, err
		}
		all = append(all, movements...)
	}
	return all, nil
}

// parseMovementsTable extracts rows from a transaction table and maps them to Movement structs.
func (s *SantanderScraper) parseMovementsTable(tableSelector string, accountType models.AccountType, accountID, currency string) ([]*models.Movement, error) {
	if _, err := s.WaitFor(tableSelector+" tbody tr", "visible", nil); err != nil {
		// An empty table is not an error.
		return nil, nil
	}

	rows := s.Page.Locator(tableSelector + " tbody tr")
	count, _ := rows.Count()

	var movements []*models.Movement
	for i := 0; i < count; i++ {
		row := rows.Nth(i)

		// TODO: Adjust column indices to match Santander's actual table layout.
		dateText, _ := row.Locator("td:nth-child(1)").InnerText()
		desc, _ := row.Locator("td:nth-child(2)").InnerText()
		amountText, _ := row.Locator("td:nth-child(3)").InnerText()
		txType, _ := row.Locator("td:nth-child(4)").InnerText()

		date, err := parseChileanDate(strings.TrimSpace(dateText))
		if err != nil {
			continue
		}

		amount, err := parseChileanAmount(strings.TrimSpace(amountText))
		if err != nil {
			continue
		}

		movements = append(movements, &models.Movement{
			Date:            date,
			Description:     strings.TrimSpace(desc),
			Amount:          amount,
			Currency:        currency,
			TransactionType: strings.TrimSpace(txType),
			AccountID:       accountID,
			AccountType:     accountType,
		})
	}

	return movements, nil
}

// parseChileanDate parses dates in the formats commonly used by Chilean banks (dd/mm/yyyy or dd-mm-yyyy).
func parseChileanDate(s string) (time.Time, error) {
	for _, layout := range []string{"02/01/2006", "02-01-2006", "2006-01-02"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognized date format: %q", s)
}

// parseChileanAmount converts a Chilean-formatted number string (e.g. "1.234.567") to float64.
// A leading '-' is preserved as a negative value.
func parseChileanAmount(s string) (float64, error) {
	negative := strings.HasPrefix(s, "-")
	s = strings.TrimPrefix(s, "-")
	s = strings.ReplaceAll(s, ".", "")
	s = strings.ReplaceAll(s, ",", ".")
	s = strings.TrimSpace(s)
	s = strings.Map(func(r rune) rune {
		if (r >= '0' && r <= '9') || r == '.' {
			return r
		}
		return -1
	}, s)
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, err
	}
	if negative {
		v = -v
	}
	return v, nil
}
