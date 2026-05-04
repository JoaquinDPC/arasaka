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

func (ctrl *InsightController) Insights(c *gin.Context) {
	year, month := yearMonthParams(c)
	accountID := accountIDParam(c)
	ctx := c.Request.Context()

	current, err := ctrl.reports.BuildMonthlyReport(ctx, year, month, accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	history, err := ctrl.reports.GetMonthlyHistory(ctx, year, month, accountID)
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
