package cl

import (
	"fmt"
	"strings"

	"fintself/internal/models"
	"fintself/internal/scraper"
)

func init() {
	scraper.Register("cl_estado", scraper.Descriptor{
		Description: "Scraper for Banco Estado Chile (CuentaRUT).",
		Factory: func(headless, debugMode *bool) scraper.Runnable {
			return &BancoEstadoScraper{Base: scraper.NewBase(headless, debugMode)}
		},
	})
}

// BancoEstadoScraper extracts movements from Banco Estado's CuentaRUT online portal.
type BancoEstadoScraper struct {
	*scraper.Base
	accountID string
}

func (e *BancoEstadoScraper) BankID() string { return "cl_estado" }

func (e *BancoEstadoScraper) Scrape(user, password string) ([]*models.Movement, error) {
	return scraper.Run(e, e.Base, user, password)
}

// Login authenticates on Banco Estado's portal.
func (e *BancoEstadoScraper) Login() error {
	const loginURL = "https://www.bancoestado.cl/content/bancoestado-public/cl/es/home/home-personas/login.html"

	if err := e.Navigate(loginURL, nil); err != nil {
		return err
	}

	// TODO: Verify and update selectors for Banco Estado's login form.
	if err := e.Fill("#rut", e.User, nil); err != nil {
		return err
	}
	if err := e.Fill("#clave", e.Password, nil); err != nil {
		return err
	}
	if err := e.Click("#btn-login", nil, false); err != nil {
		return err
	}

	// Wait for the authenticated home page to load.
	if _, err := e.WaitFor(".mi-cuenta", "visible", nil); err != nil {
		return fmt.Errorf("login failed: authenticated home did not load: %w", err)
	}

	// Capture the CuentaRUT identifier from the dashboard.
	if loc, err := e.WaitFor(".cuenta-rut .numero", "visible", nil); err == nil {
		if text, err := loc.First().InnerText(); err == nil {
			e.accountID = models.FormatAccountID(strings.TrimSpace(text))
		}
	}

	return nil
}

// ScrapeMovements retrieves CuentaRUT transaction history.
func (e *BancoEstadoScraper) ScrapeMovements() ([]*models.Movement, error) {
	// TODO: Update the URL to Banco Estado's actual movements page.
	if err := e.Navigate("https://www.bancoestado.cl/content/bancoestado-public/cl/es/home/home-personas/cuenta-rut/movimientos.html", nil); err != nil {
		return nil, err
	}

	// TODO: Adjust the table selector and column mapping to match the real portal.
	if _, err := e.WaitFor("table.movimientos tbody tr", "visible", nil); err != nil {
		return nil, nil
	}

	rows := e.Page.Locator("table.movimientos tbody tr")
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
			AccountID:   e.accountID,
			AccountType: models.AccountTypeDebito,
		})
	}

	return movements, nil
}
