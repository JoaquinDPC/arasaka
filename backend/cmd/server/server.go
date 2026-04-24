package main

import (
	"github.com/gin-gonic/gin"

	"arasaka/internal/controller"
)

// Controllers groups all HTTP controllers for dependency injection.
type Controllers struct {
	Accounts     *controller.AccountController
	Transactions *controller.TransactionController
	Budgets      *controller.BudgetController
	Reports      *controller.ReportController
	Insights     *controller.InsightController
	Sync         *controller.SyncController
}

func registerRoutes(r *gin.Engine, ctrl Controllers) {
	api := r.Group("/api")

	// ── Accounts ───────────────────────────────────────────────────────────────
	api.GET("/accounts", ctrl.Accounts.List)
	api.POST("/accounts", ctrl.Accounts.Create)
	api.PUT("/accounts/:id", ctrl.Accounts.Update)
	api.DELETE("/accounts/:id", ctrl.Accounts.Delete)

	// ── Transactions ───────────────────────────────────────────────────────────
	api.GET("/transactions", ctrl.Transactions.List)
	api.POST("/transactions", ctrl.Transactions.Create)
	api.PUT("/transactions/:id", ctrl.Transactions.Update)
	api.DELETE("/transactions/:id", ctrl.Transactions.Delete)

	// ── Reports ────────────────────────────────────────────────────────────────
	api.GET("/reports/monthly", ctrl.Reports.MonthlyReport)
	api.GET("/reports/kpis", ctrl.Reports.KPIs)
	api.GET("/reports/trend", ctrl.Reports.Trend)
	api.GET("/reports/budget-vs-actual", ctrl.Reports.BudgetVsActual)
	api.GET("/reports/annual", ctrl.Reports.AnnualReport)
	api.GET("/categories/summary", ctrl.Reports.CategorySummary)

	// ── Budgets ────────────────────────────────────────────────────────────────
	api.GET("/budgets", ctrl.Budgets.ListBudgets)
	api.PUT("/budgets", ctrl.Budgets.UpsertBudget)
	api.PUT("/budgets/base", ctrl.Budgets.UpsertBase)

	// ── Insights ───────────────────────────────────────────────────────────────
	api.GET("/insights", ctrl.Insights.Insights)

	// ── Sync ───────────────────────────────────────────────────────────────────
	api.POST("/sync", ctrl.Sync.Sync)
}
