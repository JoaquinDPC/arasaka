package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"arasaka/internal/domain"
	"arasaka/internal/service"
)

// ReportController handles HTTP requests for financial reports.
type ReportController struct {
	svc *service.ReportService
}

func NewReportController(svc *service.ReportService) *ReportController {
	return &ReportController{svc: svc}
}

func (ctrl *ReportController) MonthlyReport(c *gin.Context) {
	year, month := yearMonthParams(c)
	accountID := accountIDParam(c)
	userID := userIDFromContext(c)
	report, err := ctrl.svc.BuildMonthlyReport(c.Request.Context(), userID, year, month, accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, report)
}

func (ctrl *ReportController) KPIs(c *gin.Context) {
	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	year, _ := strconv.Atoi(yearStr)
	accountID := accountIDParam(c)
	userID := userIDFromContext(c)

	kpis, err := ctrl.svc.CalculateKPIs(c.Request.Context(), userID, year, accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, kpis)
}

func (ctrl *ReportController) Trend(c *gin.Context) {
	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	year, _ := strconv.Atoi(yearStr)
	accountID := accountIDParam(c)
	userID := userIDFromContext(c)

	trend, err := ctrl.svc.GetTrend(c.Request.Context(), userID, year, accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, trend)
}

func (ctrl *ReportController) AnnualReport(c *gin.Context) {
	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	year, _ := strconv.Atoi(yearStr)
	accountID := accountIDParam(c)
	userID := userIDFromContext(c)

	report, err := ctrl.svc.BuildAnnualReport(c.Request.Context(), userID, year, accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, report)
}

// CategorySummary returns tag-based expense totals. Period: "mes" (default), "año", "todo".
func (ctrl *ReportController) CategorySummary(c *gin.Context) {
	period := c.DefaultQuery("period", "mes")
	year, month := yearMonthParams(c)
	accountID := accountIDParam(c)
	userID := userIDFromContext(c)

	var (
		result []domain.CategorySummary
		err    error
	)
	switch period {
	case "todo":
		result, err = ctrl.svc.GetAllTimeTagTotals(c.Request.Context(), userID, accountID)
	case "año":
		result, err = ctrl.svc.GetYearlyTagTotals(c.Request.Context(), userID, year, accountID)
	default:
		result, err = ctrl.svc.GetTagTotals(c.Request.Context(), userID, year, month, accountID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (ctrl *ReportController) ActiveInstallments(c *gin.Context) {
	userID := userIDFromContext(c)
	items, err := ctrl.svc.ActiveInstallments(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// BudgetVsActual returns tag-based spending vs tag_budgets for a given month.
func (ctrl *ReportController) BudgetVsActual(c *gin.Context) {
	year, month := yearMonthParams(c)
	accountID := accountIDParam(c)
	userID := userIDFromContext(c)
	result, err := ctrl.svc.GetTagTotals(c.Request.Context(), userID, year, month, accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}
