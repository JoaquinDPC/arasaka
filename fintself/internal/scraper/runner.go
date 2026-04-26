package scraper

import (
	"fmt"
	"log"

	"fintself/internal/models"
)

// bankImpl is satisfied by each bank scraper's concrete type.
type bankImpl interface {
	BankID() string
	Login() error
	ScrapeMovements() ([]*models.Movement, error)
}

// Run orchestrates the full browser lifecycle for a bank scraper implementation.
// Each concrete scraper calls this from its own Scrape() method.
func Run(impl bankImpl, base *Base, user, password string) ([]*models.Movement, error) {
	base.User = user
	base.Password = password

	log.Printf("launching browser for %s (headless: %v)...", impl.BankID(), base.Headless)

	if err := base.StartBrowser(); err != nil {
		return nil, err
	}
	defer func() {
		base.CloseBrowser()
		log.Printf("browser closed for %s", impl.BankID())
	}()

	log.Printf("logging into %s...", impl.BankID())
	if err := impl.Login(); err != nil {
		base.SaveDebugInfo(impl.BankID(), "login_error")
		return nil, err
	}
	log.Printf("successfully logged into %s", impl.BankID())

	log.Printf("extracting movements from %s...", impl.BankID())
	movements, err := impl.ScrapeMovements()
	if err != nil {
		base.SaveDebugInfo(impl.BankID(), "scraping_error")
		return nil, fmt.Errorf("scraping %s: %w", impl.BankID(), err)
	}

	log.Printf("extracted %d movements from %s", len(movements), impl.BankID())
	return movements, nil
}
