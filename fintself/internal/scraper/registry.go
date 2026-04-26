package scraper

import (
	finterrors "fintself/internal/errors"
	"fintself/internal/models"
)

// Runnable is the public interface the CLI uses to invoke any bank scraper.
type Runnable interface {
	BankID() string
	Scrape(user, password string) ([]*models.Movement, error)
}

// Factory constructs a Runnable scraper for a given bank.
type Factory func(headless, debugMode *bool) Runnable

// Descriptor holds metadata and the factory for a registered bank scraper.
type Descriptor struct {
	Factory     Factory
	Description string
}

var registry = map[string]Descriptor{}

// Register adds a bank scraper to the global registry.
// Call this from each bank package's init() function.
func Register(bankID string, d Descriptor) {
	registry[bankID] = d
}

// Get returns a ready-to-use Runnable for the given bank ID.
func Get(bankID string, headless, debugMode *bool) (Runnable, error) {
	d, ok := registry[bankID]
	if !ok {
		return nil, finterrors.NewScraperNotFound(bankID)
	}
	return d.Factory(headless, debugMode), nil
}

// List returns all registered bank IDs with their descriptions.
func List() map[string]string {
	out := make(map[string]string, len(registry))
	for id, d := range registry {
		out[id] = d.Description
	}
	return out
}
