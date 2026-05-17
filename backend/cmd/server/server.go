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
	Inference    *controller.InferenceController
	CreditCard   *controller.CreditCardController
	AdminTagRule *controller.AdminTagRuleController
}

func registerRoutes(r *gin.Engine, ctrl Controllers, jwtSecret string, devBypass bool) {
	// ── Public ─────────────────────────────────────────────────────────────────
	r.POST("/api/auth/login", ctrl.Auth.Login)

	// ── Protected ──────────────────────────────────────────────────────────────
	api := r.Group("/api", middleware.Auth(jwtSecret, devBypass))

	// ── Accounts ───────────────────────────────────────────────────────────────
	api.GET("/accounts", ctrl.Accounts.List)
	api.POST("/accounts", ctrl.Accounts.Create)
	api.PUT("/accounts/:id", ctrl.Accounts.Update)
	api.DELETE("/accounts/:id", ctrl.Accounts.Delete)

	// ── Transactions ───────────────────────────────────────────────────────────
	api.GET("/transactions", ctrl.Transactions.List)
	api.POST("/transactions", ctrl.Transactions.Create)
	api.POST("/transactions/bulk", ctrl.Transactions.CreateBatch)
	api.PUT("/transactions/:id", ctrl.Transactions.Update)
	api.DELETE("/transactions/:id", ctrl.Transactions.Delete)

	// ── Reports ────────────────────────────────────────────────────────────────
	api.GET("/reports/monthly", ctrl.Reports.MonthlyReport)
	api.GET("/reports/kpis", ctrl.Reports.KPIs)
	api.GET("/reports/trend", ctrl.Reports.Trend)
	api.GET("/reports/budget-vs-actual", ctrl.Reports.BudgetVsActual)
	api.GET("/reports/annual", ctrl.Reports.AnnualReport)
	api.GET("/reports/installments", ctrl.Reports.ActiveInstallments)
	api.GET("/categories/summary", ctrl.Reports.CategorySummary)

	// ── Tags ───────────────────────────────────────────────────────────────────
	api.GET("/tags", ctrl.Budgets.ListTags)
	api.GET("/tags/used", ctrl.Transactions.ListUsedTags)
	api.GET("/tags/spending", ctrl.Transactions.TagSpending)
	api.GET("/tags/personal", ctrl.Budgets.ListPersonalTags)
	api.POST("/tags/personal", ctrl.Budgets.SavePersonalTag)
	api.PUT("/tags/personal/:tag/icon", ctrl.Budgets.SetTagIcon)
	api.PUT("/tags/personal/:tag/color", ctrl.Budgets.SetTagColor)
	api.DELETE("/tags/personal/:tag", ctrl.Budgets.DeletePersonalTag)

	// ── Tag Budgets ────────────────────────────────────────────────────────────
	api.GET("/tag-budgets", ctrl.Budgets.ListTagBudgets)
	api.PUT("/tag-budgets", ctrl.Budgets.UpsertTagBudget)

	// ── Insights ───────────────────────────────────────────────────────────────
	api.GET("/insights", ctrl.Insights.Insights)

	// ── Sync ───────────────────────────────────────────────────────────────────
	api.POST("/sync", ctrl.Sync.Sync)

	// ── PDF Import ─────────────────────────────────────────────────────────────
	api.POST("/import/pdf", ctrl.Import.ImportPDF)

	// ── Tag Inference ──────────────────────────────────────────────────────────
	api.POST("/tags/infer", ctrl.Inference.Infer)

	// ── Admin: Tag Rules ───────────────────────────────────────────────────────
	api.GET("/admin/tag-rules", ctrl.AdminTagRule.ListRules)
	api.POST("/admin/tag-rules", ctrl.AdminTagRule.CreateRule)
	api.DELETE("/admin/tag-rules/:id", ctrl.AdminTagRule.DeleteRule)
	api.GET("/admin/popular-keys", ctrl.AdminTagRule.PopularUnmatched)

	// ── Credit Card ────────────────────────────────────────────────────────────
	api.GET("/credit-card/statements", ctrl.CreditCard.ListStatements)
	api.GET("/credit-card/statements/:id", ctrl.CreditCard.GetStatement)
	api.POST("/credit-card/link-payments", ctrl.CreditCard.LinkPayments)
	api.POST("/credit-card/import-pdf", ctrl.CreditCard.ImportPDF)
}
