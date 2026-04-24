package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"arasaka/internal/domain"
	"arasaka/internal/service"
)

// InsightController handles HTTP requests for financial insights.
type InsightController struct {
	reports *service.ReportService
}

func NewInsightController(reports *service.ReportService) *InsightController {
	return &InsightController{reports: reports}
}

// Insights godoc
// @Summary      Financial insights for a month
// @Description  Returns rule-based alerts comparing current month data against historical averages and budgets.
// @Tags         insights
// @Produce      json
// @Param        year   query  int  false  "Year (defaults to current)"
// @Param        month  query  int  false  "Month 1-12 (defaults to current)"
// @Success      200  {array}   domain.Insight
// @Failure      500  {object}  map[string]string
// @Router       /insights [get]
func (ctrl *InsightController) Insights(c *gin.Context) {
	year, month := yearMonthParams(c)
	ctx := c.Request.Context()

	current, err := ctrl.reports.BuildMonthlyReport(ctx, year, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	history, err := ctrl.reports.GetMonthlyHistory(ctx, year, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	insights := service.GenerateInsights(current, history)
	if insights == nil {
		insights = []domain.Insight{}
	}
	c.JSON(http.StatusOK, insights)
}
