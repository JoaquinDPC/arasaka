// Package logger provides a slog.Logger factory that switches between a
// colorful pretty-printer for local development and a structured JSON handler
// for production / cloud deployments.
//
// Selection is driven by the LOG_FORMAT environment variable:
//
//	LOG_FORMAT=json   → newline-delimited JSON (stdout) — use in prod/containers
//	LOG_FORMAT=text   → plain key=value text (stdout) — useful in CI without color
//	<unset>           → colorful pretty output (stdout) — default for local dev
package logger

import (
	"log/slog"
	"os"
	"time"

	"github.com/lmittmann/tint"
)

// New returns a *slog.Logger and sets it as the global default (slog.SetDefault).
// Call this once at program startup.
func New() *slog.Logger {
	var handler slog.Handler

	switch os.Getenv("LOG_FORMAT") {
	case "json":
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level: level(),
		})
	case "text":
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level: level(),
		})
	default:
		handler = tint.NewHandler(os.Stdout, &tint.Options{
			Level:      level(),
			TimeFormat: time.TimeOnly,
		})
	}

	logger := slog.New(handler)
	slog.SetDefault(logger)
	return logger
}

// level reads LOG_LEVEL from the environment (debug/info/warn/error).
// Defaults to Info.
func level() slog.Level {
	switch os.Getenv("LOG_LEVEL") {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
