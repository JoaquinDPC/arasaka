package repository

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

func parseDate(s string) (time.Time, error) {
	if len(s) >= 19 {
		return time.Parse("2006-01-02T15:04:05", s[:19])
	}
	if len(s) >= 10 {
		return time.Parse("2006-01-02", s[:10])
	}
	return time.Time{}, fmt.Errorf("unknown format: %q", s)
}

func parseAmount(s string) (float64, error) {
	s = strings.ReplaceAll(s, "$", "")
	s = strings.ReplaceAll(s, " ", "")
	if strings.Contains(s, ",") {
		s = strings.ReplaceAll(s, ".", "")
		s = strings.ReplaceAll(s, ",", ".")
	} else {
		s = strings.ReplaceAll(s, ".", "")
	}
	return strconv.ParseFloat(strings.TrimSpace(s), 64)
}
