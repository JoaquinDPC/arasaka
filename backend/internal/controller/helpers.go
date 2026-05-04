package controller

import (
	"fmt"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"arasaka/internal/middleware"
)

// userIDFromContext returns the authenticated user's ID set by the auth middleware.
func userIDFromContext(c *gin.Context) int64 {
	return c.GetInt64(middleware.UserIDKey)
}

// yearMonthParams extracts year/month query params, defaulting to current date.
func yearMonthParams(c *gin.Context) (int, int) {
	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	monthStr := c.DefaultQuery("month", strconv.Itoa(int(time.Now().Month())))
	year, _ := strconv.Atoi(yearStr)
	month, _ := strconv.Atoi(monthStr)
	return year, month
}

// accountIDParam parses the optional account_id query param. Returns nil when absent or invalid.
func accountIDParam(c *gin.Context) *int64 {
	s := c.Query("account_id")
	if s == "" {
		return nil
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return nil
	}
	return &v
}

// sseHeaders sets the standard SSE response headers.
func sseHeaders(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
}

// sseEvent writes a named SSE event to the response and flushes.
func sseEvent(c *gin.Context, event, data string) {
	fmt.Fprintf(c.Writer, "event: %s\ndata: %s\n\n", event, data)
	c.Writer.Flush()
}
