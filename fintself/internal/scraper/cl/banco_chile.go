package cl

import (
	"fmt"
	"strings"

	"fintself/internal/models"
	"fintself/internal/scraper"
)

func init() {
	scraper.Register("cl_banco_chile", scraper.Descriptor{
		Description: "Scraper for Banco de Chile.",
		Factory: func(headless, debugMode *bool) scraper.Runnable {
			return &BancoChileScraper{Base: scraper.NewBase(headless, debugMode)}
		},
	})
}

// BancoChileScraper extracts movements from Banco de Chile's online banking portal.
type BancoChileScraper struct {
	*scraper.Base
	accountID string
}

func (b *BancoChileScraper) BankID() string { return "cl_banco_chile" }

func (b *BancoChileScraper) Scrape(user, password string) ([]*models.Movement, error) {
	return scraper.Run(b, b.Base, user, password)
}

// Login authenticates the user on Banco de Chile's online banking portal.
func (b *BancoChileScraper) Login() error {
	const loginURL = "https://portales.bancochile.cl/personas/login"

	if err := b.Navigate(loginURL, nil); err != nil {
		return err
	}

	// TODO: Verify and update selectors for Banco de Chile's login form.
	if err := b.Fill("#rut", b.User, nil); err != nil {
		return err
	}
	if err := b.Fill("#clave", b.Password, nil); err != nil {
		return err
	}
	if err := b.Click("#btn-ingresar", nil, false); err != nil {
		return err
	}

	// Wait for the home page to confirm a successful login.
	if _, err := b.WaitFor(".home-container", "visible", nil); err != nil {
		return fmt.Errorf("login failed: dashboard did not load: %w", err)
	}

	// Capture the account number shown on the landing page.
	if loc, err := b.WaitFor(".numero-cuenta", "visible", nil); err == nil {
		if text, err := loc.First().InnerText(); err == nil {
			b.accountID = models.FormatAccountID(strings.TrimSpace(text))
		}
	}

	return nil
}

// ScrapeMovements navigates to the movements section and extracts all rows.
func (b *BancoChileScraper) ScrapeMovements() ([]*models.Movement, error) {
	// TODO: Update the URL to Banco de Chile's actual movements page.
	if err := b.Navigate("https://portales.bancochile.cl/personas/cuenta-corriente/movimientos", nil); err != nil {
		return nil, err
	}

	// TODO: Adjust the table selector and column mapping to match the real portal.
	if _, err := b.WaitFor(".tabla-movimientos tbody tr", "visible", nil); err != nil {
		return nil, nil
	}

	rows := b.Page.Locator(".tabla-movimientos tbody tr")
	count, _ := rows.Count()

	var movements []*models.Movement
	for i := 0; i < count; i++ {
		row := rows.Nth(i)

		dateText, _ := row.Locator("td:nth-child(1)").InnerText()
		desc, _ := row.Locator("td:nth-child(2)").InnerText()
		amountText, _ := row.Locator("td:nth-child(3)").InnerText()

		date, err := parseChileanDate(strings.TrimSpace(dateText))
		if err != nil {
			continue
		}
		amount, err := parseChileanAmount(strings.TrimSpace(amountText))
		if err != nil {
			continue
		}

		movements = append(movements, &models.Movement{
			Date:        date,
			Description: strings.TrimSpace(desc),
			Amount:      amount,
			Currency:    "CLP",
			AccountID:   b.accountID,
			AccountType: models.AccountTypeCorriente,
		})
	}

	return movements, nil
}
