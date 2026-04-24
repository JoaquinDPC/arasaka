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

// MonthlyReport godoc
// @Summary      Monthly financial report
// @Tags         reports
// @Produce      json
// @Param        year   query  int  false  "Year (defaults to current)"
// @Param        month  query  int  false  "Month 1-12 (defaults to current)"
// @Success      200  {object}  domain.MonthlyReport
// @Failure      500  {object}  map[string]string
// @Router       /reports/monthly [get]
func (ctrl *ReportController) MonthlyReport(c *gin.Context) {
	year, month := yearMonthParams(c)
	report, err := ctrl.svc.BuildMonthlyReport(c.Request.Context(), year, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, report)
}

// KPIs godoc
// @Summary      Annual KPIs
// @Tags         reports
// @Produce      json
// @Param        year  query  int  false  "Year (defaults to current)"
// @Success      200  {object}  domain.KPIReport
// @Failure      500  {object}  map[string]string
// @Router       /reports/kpis [get]
func (ctrl *ReportController) KPIs(c *gin.Context) {
	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	year, _ := strconv.Atoi(yearStr)

	kpis, err := ctrl.svc.CalculateKPIs(c.Request.Context(), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, kpis)
}

// Trend godoc
// @Summary      Monthly spending/income trend for a year
// @Tags         reports
// @Produce      json
// @Param        year  query  int  false  "Year (defaults to current)"
// @Success      200  {array}   domain.MonthlyReport
// @Failure      500  {object}  map[string]string
// @Router       /reports/trend [get]
func (ctrl *ReportController) Trend(c *gin.Context) {
	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	year, _ := strconv.Atoi(yearStr)

	trend, err := ctrl.svc.GetTrend(c.Request.Context(), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, trend)
}

// AnnualReport godoc
// @Summary      Full-year financial overview
// @Description  Returns KPIs, monthly income/expense trend, and category totals for the given year
// @Tags         reports
// @Produce      json
// @Param        year  query  int  false  "Year (defaults to current)"
// @Success      200  {object}  domain.AnnualReport
// @Failure      500  {object}  map[string]string
// @Router       /reports/annual [get]
func (ctrl *ReportController) AnnualReport(c *gin.Context) {
	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	year, _ := strconv.Atoi(yearStr)

	report, err := ctrl.svc.BuildAnnualReport(c.Request.Context(), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, report)
}

// CategorySummary godoc
// @Summary      Category spending summary
// @Tags         reports
// @Produce      json
// @Param        period  query  string  false  "mes | año | todo (default: mes)"
// @Param        year    query  int     false  "Year (defaults to current)"
// @Param        month   query  int     false  "Month 1-12 (defaults to current, used when period=mes)"
// @Success      200  {array}   domain.CategorySummary
// @Failure      500  {object}  map[string]string
// @Router       /categories/summary [get]
func (ctrl *ReportController) CategorySummary(c *gin.Context) {
	period := c.DefaultQuery("period", "mes")
	year, month := yearMonthParams(c)

	var (
		result []domain.CategorySummary
		err    error
	)
	switch period {
	case "todo":
		result, err = ctrl.svc.GetAllTimeCategoryTotals(c.Request.Context())
	case "año":
		result, err = ctrl.svc.GetYearlyCategoryTotals(c.Request.Context(), year)
	default:
		result, err = ctrl.svc.GetBudgetVsActual(c.Request.Context(), year, month)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// BudgetVsActual godoc
// @Summary      Budget vs actual spending
// @Tags         reports
// @Produce      json
// @Param        year   query  int  false  "Year (defaults to current)"
// @Param        month  query  int  false  "Month 1-12 (defaults to current)"
// @Success      200  {array}   domain.CategorySummary
// @Failure      500  {object}  map[string]string
// @Router       /reports/budget-vs-actual [get]
func (ctrl *ReportController) BudgetVsActual(c *gin.Context) {
	year, month := yearMonthParams(c)
	result, err := ctrl.svc.GetBudgetVsActual(c.Request.Context(), year, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}
