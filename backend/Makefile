BUDGET_FILE ?= ../presupuesto-2026.xlsx
CONFIG      ?= config.yml
COMPOSE     := docker compose -f docker/docker-compose.yml

.PHONY: help run import-budget db-up db-down db-reset

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

run: ## Start the API server (override config: make run CONFIG=path/to/config.yml)
	go run ./cmd/server -config=$(CONFIG)

import-budget: ## Import budget ledger (override: make import-budget BUDGET_FILE=path.xlsx CONFIG=path.yml)
	go run ./cmd/import_excel -config=$(CONFIG) $(BUDGET_FILE)

db-up: ## Start the database container
	$(COMPOSE) up -d

db-down: ## Stop the database container
	$(COMPOSE) down

db-reset: ## Wipe and restart the database (destroys all data)
	$(COMPOSE) down -v && $(COMPOSE) up -d
