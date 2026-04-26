package scraper

import (
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"time"

	"fintself/internal/config"
	finterrors "fintself/internal/errors"

	"github.com/playwright-community/playwright-go"
)

// BankScraper is implemented by every bank-specific scraper.
type BankScraper interface {
	BankID() string
	Login() error
	ScrapeMovements() ([]Movement, error)
}

// Movement is re-exported here to avoid import cycles in bank packages.
type Movement = interface{}

// Base holds browser state and helper methods shared across all scrapers.
type Base struct {
	DebugMode       bool
	Headless        bool
	DebugDir        string
	DefaultTimeout  float64
	SlowMo          float64
	UserAgent       string
	ViewportWidth   int
	ViewportHeight  int
	Locale          string
	TimezoneID      string
	MinHumanDelayMs float64
	MaxHumanDelayMs float64

	User     string
	Password string
	Page     playwright.Page

	pw      *playwright.Playwright
	browser playwright.Browser
}

func NewBase(headless, debugMode *bool) *Base {
	debug := config.Debug
	if debugMode != nil {
		debug = *debugMode
	}

	hl := config.HeadlessMode
	if headless != nil {
		hl = *headless
	}
	if debug {
		hl = false
	}

	return &Base{
		DebugMode:       debug,
		Headless:        hl,
		DebugDir:        "debug_output",
		DefaultTimeout:  float64(config.DefaultTimeout),
		SlowMo:          float64(config.SlowMo),
		UserAgent:       config.UserAgent,
		ViewportWidth:   config.ViewportWidth,
		ViewportHeight:  config.ViewportHeight,
		Locale:          config.Locale,
		TimezoneID:      config.TimezoneID,
		MinHumanDelayMs: config.MinHumanDelayMs,
		MaxHumanDelayMs: config.MaxHumanDelayMs,
	}
}

// StartBrowser launches a Chromium browser with anti-detection context options.
func (b *Base) StartBrowser() error {
	pw, err := playwright.Run()
	if err != nil {
		return fmt.Errorf("could not start playwright: %w", err)
	}
	b.pw = pw

	browser, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(b.Headless),
		SlowMo:   playwright.Float(b.SlowMo),
	})
	if err != nil {
		return fmt.Errorf("could not launch browser: %w", err)
	}
	b.browser = browser

	ctx, err := browser.NewContext(playwright.BrowserNewContextOptions{
		UserAgent: playwright.String(b.UserAgent),
		Viewport: &playwright.Size{
			Width:  b.ViewportWidth,
			Height: b.ViewportHeight,
		},
		Locale:     playwright.String(b.Locale),
		TimezoneId: playwright.String(b.TimezoneID),
	})
	if err != nil {
		return fmt.Errorf("could not create browser context: %w", err)
	}

	// Mask the webdriver property to avoid bot detection.
	if err := ctx.AddInitScript(playwright.Script{
		Content: playwright.String("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"),
	}); err != nil {
		return fmt.Errorf("could not add init script: %w", err)
	}

	page, err := ctx.NewPage()
	if err != nil {
		return fmt.Errorf("could not create page: %w", err)
	}
	page.SetDefaultTimeout(b.DefaultTimeout)
	b.Page = page
	return nil
}

// CloseBrowser shuts down the browser and playwright runtime.
func (b *Base) CloseBrowser() {
	if b.browser != nil {
		b.browser.Close()
	}
	if b.pw != nil {
		b.pw.Stop()
	}
}

// HumanDelay sleeps for a random duration to simulate human interaction timing.
func (b *Base) HumanDelay(minMs, maxMs *float64) {
	lo := b.MinHumanDelayMs
	hi := b.MaxHumanDelayMs
	if minMs != nil {
		lo = *minMs
	}
	if maxMs != nil {
		hi = *maxMs
	}
	if lo <= 0 && hi <= 0 {
		return
	}
	if lo > hi {
		lo, hi = hi, lo
	}
	delayMs := lo + rand.Float64()*(hi-lo)
	time.Sleep(time.Duration(delayMs) * time.Millisecond)
}

// Navigate goes to a URL, waiting for load with human-like delay after.
func (b *Base) Navigate(url string, timeout *float64) error {
	t := b.timeout(timeout)
	if _, err := b.Page.Goto(url, playwright.PageGotoOptions{Timeout: playwright.Float(t)}); err != nil {
		return finterrors.NewDataExtractionError(fmt.Sprintf("error navigating to %s: %v", url, err))
	}
	b.HumanDelay(nil, nil)
	return nil
}

// Click waits for a selector to be visible, hovers, then clicks it.
func (b *Base) Click(selector string, timeout *float64, force bool) error {
	t := b.timeout(timeout)
	loc := b.Page.Locator(selector).First()

	// WaitForSelectorStateVisible is already a *WaitForSelectorState pointer.
	if err := loc.WaitFor(playwright.LocatorWaitForOptions{State: playwright.WaitForSelectorStateVisible, Timeout: playwright.Float(t)}); err != nil {
		return finterrors.NewDataExtractionError(fmt.Sprintf("timeout waiting for '%s'", selector))
	}
	_ = loc.ScrollIntoViewIfNeeded()

	if !force {
		if err := loc.Hover(playwright.LocatorHoverOptions{Timeout: playwright.Float(t)}); err != nil {
			force = true
		}
	}

	min50, max150 := 50.0, 150.0
	b.HumanDelay(&min50, &max150)

	if err := loc.Click(playwright.LocatorClickOptions{Timeout: playwright.Float(t), Force: playwright.Bool(force)}); err != nil {
		return finterrors.NewDataExtractionError(fmt.Sprintf("error clicking '%s': %v", selector, err))
	}
	b.HumanDelay(nil, nil)
	return nil
}

// Fill clears the field then types the text character by character.
func (b *Base) Fill(selector, text string, timeout *float64) error {
	t := b.timeout(timeout)
	loc := b.Page.Locator(selector).First()

	if err := loc.WaitFor(playwright.LocatorWaitForOptions{State: playwright.WaitForSelectorStateVisible, Timeout: playwright.Float(t)}); err != nil {
		return finterrors.NewDataExtractionError(fmt.Sprintf("timeout waiting for '%s'", selector))
	}
	if err := loc.Fill("", playwright.LocatorFillOptions{Timeout: playwright.Float(t)}); err != nil {
		return finterrors.NewDataExtractionError(fmt.Sprintf("error clearing '%s': %v", selector, err))
	}
	if err := loc.Type(text, playwright.LocatorTypeOptions{Delay: playwright.Float(50), Timeout: playwright.Float(t)}); err != nil {
		return finterrors.NewDataExtractionError(fmt.Sprintf("error typing into '%s': %v", selector, err))
	}
	b.HumanDelay(nil, nil)
	return nil
}

// stateFromString converts a plain string ("visible", "hidden", etc.) to the playwright pointer type.
func stateFromString(s string) *playwright.WaitForSelectorState {
	switch s {
	case "hidden":
		return playwright.WaitForSelectorStateHidden
	case "attached":
		return playwright.WaitForSelectorStateAttached
	case "detached":
		return playwright.WaitForSelectorStateDetached
	default:
		return playwright.WaitForSelectorStateVisible
	}
}

// WaitFor waits for a selector to reach the given state ("visible", "hidden", "attached", "detached").
func (b *Base) WaitFor(selector, state string, timeout *float64) (playwright.Locator, error) {
	t := b.timeout(timeout)
	loc := b.Page.Locator(selector)
	if err := loc.First().WaitFor(playwright.LocatorWaitForOptions{State: stateFromString(state), Timeout: playwright.Float(t)}); err != nil {
		return nil, finterrors.NewDataExtractionError(fmt.Sprintf("timeout waiting for '%s'", selector))
	}
	return loc, nil
}

// SaveDebugInfo writes a screenshot and the page HTML to the debug directory.
func (b *Base) SaveDebugInfo(bankID, step string) {
	if !b.DebugMode || b.Page == nil {
		return
	}
	ts := time.Now().Format("20060102_150405")
	dir := filepath.Join(b.DebugDir, bankID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return
	}

	screenshotPath := filepath.Join(dir, fmt.Sprintf("%s_%s.png", ts, step))
	if _, err := b.Page.Screenshot(playwright.PageScreenshotOptions{
		Path:     playwright.String(screenshotPath),
		FullPage: playwright.Bool(true),
	}); err == nil {
		log.Printf("screenshot saved: %s", screenshotPath)
	}

	htmlPath := filepath.Join(dir, fmt.Sprintf("%s_%s.html", ts, step))
	if content, err := b.Page.Content(); err == nil {
		_ = os.WriteFile(htmlPath, []byte(content), 0644)
		log.Printf("HTML saved: %s", htmlPath)
	}
}

func (b *Base) timeout(override *float64) float64 {
	if override != nil {
		return *override
	}
	return b.DefaultTimeout
}
