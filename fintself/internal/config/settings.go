package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

var (
	Debug           bool
	HeadlessMode    bool
	DefaultTimeout  int
	SlowMo          int
	UserAgent       string
	ViewportWidth   int
	ViewportHeight  int
	Locale          string
	TimezoneID      string
	MinHumanDelayMs float64
	MaxHumanDelayMs float64
)

func init() {
	_ = godotenv.Load()

	Debug = boolEnv("DEBUG", false)
	HeadlessMode = boolEnv("SCRAPER_HEADLESS_MODE", false)
	DefaultTimeout = intEnv("SCRAPER_DEFAULT_TIMEOUT", 15000)
	SlowMo = intEnv("SCRAPER_SLOW_MO", 100)
	UserAgent = stringEnv("SCRAPER_USER_AGENT",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36")
	ViewportWidth = intEnv("SCRAPER_VIEWPORT_WIDTH", 1366)
	ViewportHeight = intEnv("SCRAPER_VIEWPORT_HEIGHT", 768)
	Locale = stringEnv("SCRAPER_LOCALE", "es-CL")
	TimezoneID = stringEnv("SCRAPER_TIMEZONE_ID", "America/Santiago")
	MinHumanDelayMs = float64Env("SCRAPER_MIN_HUMAN_DELAY_MS", 200.0)
	MaxHumanDelayMs = float64Env("SCRAPER_MAX_HUMAN_DELAY_MS", 800.0)
}

func boolEnv(key string, def bool) bool {
	switch os.Getenv(key) {
	case "true", "1", "yes":
		return true
	case "false", "0", "no":
		return false
	default:
		return def
	}
}

func intEnv(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func float64Env(key string, def float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return def
}

func stringEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
