package main

import (
	"github.com/gin-gonic/gin"

	"arasaka/internal/controller"
	"arasaka/internal/middleware"
)

// Controllers groups all HTTP controllers for dependency injection.
type Controllers struct {
	Auth         *controller.AuthController
	Accounts     *controller.AccountController
	Transactions *controller.TransactionController
	Budgets      *controller.BudgetController
	Reports      *controller.ReportController
	Insights     *controller.InsightController
	Sync         *controller.SyncController
	Import       *controller.ImportController
}

func registerRoutes(r *gin.Engine, ctrl Controllers, jwtSecret string) {
	// ── Public ─────────────────────────────────────────────────────────────────
	r.POST("/api/auth/login", ctrl.Auth.Login)

	// ── Protected ──────────────────────────────────────────────────────────────
	api := r.Group("/api", middleware.Auth(jwtSecret))

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
	api.GET("/tags", ctrl.Budgets.ListTags)
	api.GET("/tags/used", ctrl.Transactions.ListUsedTags)
	api.GET("/tags/spending", ctrl.Transactions.TagSpending)
	api.GET("/tags/personal", ctrl.Budgets.ListPersonalTags)
	api.POST("/tags/personal", ctrl.Budgets.SavePersonalTag)
	api.PUT("/tags/personal/:tag/icon", ctrl.Budgets.SetTagIcon)

	// ── Tag Budgets ────────────────────────────────────────────────────────────
	api.GET("/tag-budgets", ctrl.Budgets.ListTagBudgets)
	api.PUT("/tag-budgets", ctrl.Budgets.UpsertTagBudget)

	// ── Insights ───────────────────────────────────────────────────────────────
	api.GET("/insights", ctrl.Insights.Insights)

	// ── Sync ───────────────────────────────────────────────────────────────────
	api.POST("/sync", ctrl.Sync.Sync)

	// ── PDF Import ─────────────────────────────────────────────────────────────
	api.POST("/import/pdf", ctrl.Import.ImportPDF)
}
