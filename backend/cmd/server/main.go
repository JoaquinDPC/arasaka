// @title           Arasaka Finance API
// @version         1.0
// @description     Personal finance API — transactions, budgets, reports, and financial insights.
// @host            localhost:8080
// @BasePath        /api

package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/gin-gonic/gin"
	ginSwagger "github.com/swaggo/gin-swagger"
	swaggerFiles "github.com/swaggo/files"

	_ "arasaka/docs"
	"arasaka/internal/config"
	"arasaka/internal/controller"
	"arasaka/internal/repository"
	"arasaka/internal/service"
)

func main() {
	configPath := flag.String("config", "", "path to config.yml (required)")
	flag.Parse()

	if *configPath == "" {
		fmt.Fprintln(os.Stderr, "error: -config flag is required")
		fmt.Fprintln(os.Stderr, "usage: server -config=<path/to/config.yml>")
		os.Exit(1)
	}

	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	db, err := connectDB(cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error connecting to DB: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := runMigrations(db); err != nil {
		fmt.Fprintf(os.Stderr, "Error running migrations: %v\n", err)
		os.Exit(1)
	}

	// ── Repositories ──────────────────────────────────────────────────────────
	accountRepo := repository.NewAccountRepository(db)
	txRepo := repository.NewTransactionRepository(db)
	budgetRepo := repository.NewBudgetRepository(db)
	reportRepo := repository.NewReportRepository(db)

	// ── Services ──────────────────────────────────────────────────────────────
	accountSvc := service.NewAccountService(accountRepo)
	txSvc := service.NewTransactionService(txRepo)
	reportSvc := service.NewReportService(reportRepo)
	budgetSvc := service.NewBudgetService(budgetRepo)

	// ── Services ──────────────────────────────────────────────────────────────
	syncSvc := service.NewSyncService(db, cfg.BancochileUser, cfg.BancochilePassword)

	// ── Controllers ───────────────────────────────────────────────────────────
	ctrl := Controllers{
		Accounts:     controller.NewAccountController(accountSvc),
		Transactions: controller.NewTransactionController(txSvc),
		Budgets:      controller.NewBudgetController(budgetSvc),
		Reports:      controller.NewReportController(reportSvc),
		Insights:     controller.NewInsightController(reportSvc),
		Sync:         controller.NewSyncController(syncSvc),
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()
	r.Use(corsMiddleware())

	registerRoutes(r, ctrl)
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	addr := ":" + cfg.ServerPort
	fmt.Printf("API listening on http://localhost%s\n", addr)
	if err := r.Run(addr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == "http://localhost:5173" || origin == "http://localhost:8080" {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
