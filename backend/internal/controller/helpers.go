package controller

import (
	"fmt"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// yearMonthParams extracts year/month query params, defaulting to current date.
func yearMonthParams(c *gin.Context) (int, int) {
	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	monthStr := c.DefaultQuery("month", strconv.Itoa(int(time.Now().Month())))
	year, _ := strconv.Atoi(yearStr)
	month, _ := strconv.Atoi(monthStr)
	return year, month
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
