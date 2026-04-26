package cl

import (
	"fmt"
	"strings"

	"fintself/internal/models"
	"fintself/internal/scraper"
)

func init() {
	scraper.Register("cl_cencosud", scraper.Descriptor{
		Description: "Scraper for Tarjeta Cencosud Scotiabank.",
		Factory: func(headless, debugMode *bool) scraper.Runnable {
			return &CencosudScraper{Base: scraper.NewBase(headless, debugMode)}
		},
	})
}

// CencosudScraper extracts movements from the Tarjeta Cencosud Scotiabank portal.
type CencosudScraper struct {
	*scraper.Base
	cardID string
}

func (c *CencosudScraper) BankID() string { return "cl_cencosud" }

func (c *CencosudScraper) Scrape(user, password string) ([]*models.Movement, error) {
	return scraper.Run(c, c.Base, user, password)
}

// Login authenticates on the Cencosud Scotiabank portal.
func (c *CencosudScraper) Login() error {
	const loginURL = "https://www.tarjetacencosud.cl/login"

	if err := c.Navigate(loginURL, nil); err != nil {
		return err
	}

	// TODO: Verify and update selectors for the Cencosud login form.
	if err := c.Fill("#rut", c.User, nil); err != nil {
		return err
	}
	if err := c.Fill("#clave", c.Password, nil); err != nil {
		return err
	}
	if err := c.Click("#btn-ingresar", nil, false); err != nil {
		return err
	}

	// Wait for the account summary page to confirm login success.
	if _, err := c.WaitFor(".resumen-cuenta", "visible", nil); err != nil {
		return fmt.Errorf("login failed: account summary did not load: %w", err)
	}

	// Capture the card number shown on the summary page.
	if loc, err := c.WaitFor(".numero-tarjeta", "visible", nil); err == nil {
		if text, err := loc.First().InnerText(); err == nil {
			c.cardID = models.FormatAccountID(strings.TrimSpace(text))
		}
	}

	return nil
}

// ScrapeMovements retrieves credit-card transaction history from Cencosud's portal.
func (c *CencosudScraper) ScrapeMovements() ([]*models.Movement, error) {
	// TODO: Update the URL to Cencosud's actual movements page.
	if err := c.Navigate("https://www.tarjetacencosud.cl/movimientos", nil); err != nil {
		return nil, err
	}

	// TODO: Adjust the table selector and column mapping to match the real portal.
	if _, err := c.WaitFor("table.movimientos tbody tr", "visible", nil); err != nil {
		return nil, nil
	}

	rows := c.Page.Locator("table.movimientos tbody tr")
	count, _ := rows.Count()

	var movements []*models.Movement
	for i := 0; i < count; i++ {
		row := rows.Nth(i)

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
			Currency:        "CLP",
			TransactionType: strings.TrimSpace(txType),
			AccountID:       c.cardID,
			AccountType:     models.AccountTypeCredito,
		})
	}

	return movements, nil
}
