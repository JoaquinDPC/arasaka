// @title           Arasaka Finance API
// @version         1.0
// @description     Personal finance API — transactions, budgets, reports, and financial insights.
// @host            localhost:8080
// @BasePath        /api

package main

import (
	"flag"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "arasaka/docs"
	"arasaka/internal/config"
	"arasaka/internal/controller"
	"arasaka/internal/crypto"
	"arasaka/internal/logger"
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

	log := logger.New()

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

	// ── Repositories (db connections) ──────────────────────────────────────────────────────────
	userRepo := repository.NewUserRepository(db)
	accountRepo := repository.NewAccountRepository(db)
	txRepo := repository.NewTransactionRepository(db)
	userTagRepo := repository.NewUserTagRepository(db)
	tagBudgetRepo := repository.NewTagBudgetRepository(db)
	reportRepo := repository.NewReportRepository(db)
	appTagRuleRepo := repository.NewAppTagRuleRepository(db)
	tagHistoryRepo := repository.NewUserTagRuleRepository(db)
	ccRepo := repository.NewCreditCardRepository(db)

	// ── Master key for PDF password encryption ────────────────────────────────────────────────
	var masterKey []byte
	if cfg.MasterKey != "" {
		masterKey, err = crypto.MasterKeyFromHex(cfg.MasterKey)
		if err != nil {
			fmt.Fprintln(os.Stderr, "invalid master_key in config:", err)
			os.Exit(1)
		}
	}

	// ── Services (business logic) ──────────────────────────────────────────────────────────
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)
	accountSvc := service.NewAccountService(accountRepo, txRepo)
	tagSvc := service.NewTagService(userTagRepo, tagBudgetRepo)
	adminTagRuleSvc := service.NewAdminTagRuleService(appTagRuleRepo, tagHistoryRepo)
	inferenceSvc := service.NewTagInferenceService(appTagRuleRepo, tagHistoryRepo, accountRepo)
	txSvc := service.NewTransactionService(txRepo, userTagRepo, inferenceSvc)
	reportSvc := service.NewReportService(reportRepo)
	syncSvc := service.NewSyncService(accountRepo, txRepo, ccRepo, masterKey, inferenceSvc, log)
	importSvc := service.NewImportService(accountRepo, txRepo, inferenceSvc, ccRepo, masterKey)
	ccSvc := service.NewCreditCardService(ccRepo)

	// ── Controllers (HTTP handlers) ──────────────────────────────────────────────────────────
	ctrl := Controllers{
		Auth:         controller.NewAuthController(authSvc),
		Accounts:     controller.NewAccountController(accountSvc, masterKey),
		Transactions: controller.NewTransactionController(txSvc),
		Tags:         controller.NewTagController(tagSvc),
		Reports:      controller.NewReportController(reportSvc),
		Insights:     controller.NewInsightController(reportSvc),
		Sync:         controller.NewSyncController(syncSvc),
		Import:       controller.NewImportController(importSvc),
		Inference:    controller.NewInferenceController(inferenceSvc),
		CreditCard:   controller.NewCreditCardController(ccSvc, accountSvc, masterKey),
		AdminTagRule: controller.NewAdminTagRuleController(adminTagRuleSvc),
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())
	r.Use(requestLogger(log))

	if cfg.DevBypassAuth {
		fmt.Println("WARNING: dev_bypass_auth is enabled — all requests run as user 1")
	}
	registerRoutes(r, ctrl, cfg.JWTSecret, cfg.DevBypassAuth)
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	addr := ":" + cfg.ServerPort
	fmt.Printf("API listening on http://localhost%s\n", addr)
	if err := r.Run(addr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func requestLogger(log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		status := c.Writer.Status()
		attrs := []any{
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", status,
			"latency", time.Since(start).Round(time.Millisecond),
		}

		switch {
		case status >= 500:
			log.Error("request", attrs...)
		case status >= 400:
			log.Warn("request", attrs...)
		default:
			log.Info("request", attrs...)
		}
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == "http://localhost:5173" || origin == "http://localhost:8080" {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
