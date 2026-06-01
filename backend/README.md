# Arasaka Backend

Personal finance API — tracks bank transactions, budgets, reports, and financial insights. Scrapes movements from **Banco de Chile** and **Santander** via the `fintself` CLI, and exposes a Gin HTTP API consumed by the Arasaka frontend.

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Data Flow](#data-flow)
- [Database & Migrations](#database--migrations)
- [Authentication](#authentication)
- [Tag Inference](#tag-inference)
- [PDF Import](#pdf-import)
- [Middleware](#middleware)
- [Project Structure](#project-structure)

---

## Architecture

The backend follows a strict layered architecture: HTTP handlers delegate to services, services call repository interfaces, repositories talk to PostgreSQL.

```
┌─────────────────────────────────────────────────────────┐
│                        HTTP Client                       │
└───────────────────────────┬─────────────────────────────┘
                            │ REST / JSON
┌───────────────────────────▼─────────────────────────────┐
│              Gin HTTP Server (:8080)                     │
│  ┌─────────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ CORS        │  │ JWT Auth │  │  Request Logger    │  │
│  │ Middleware  │  │Middleware│  │  Middleware         │  │
│  └─────────────┘  └──────────┘  └────────────────────┘  │
│                                                          │
│  Controllers (one per resource)                          │
│  Auth │ Accounts │ Transactions │ Budgets │ Reports      │
│  Sync │ Import   │ Insights     │ Inference              │
└───────────────────────────┬─────────────────────────────┘
                            │ function calls
┌───────────────────────────▼─────────────────────────────┐
│                      Services                            │
│  AuthSvc │ AccountSvc │ TransactionSvc │ BudgetSvc       │
│  ReportSvc │ SyncSvc  │ ImportSvc │ TagInferenceSvc      │
└───────────────────────────┬─────────────────────────────┘
                            │ interface (port)
┌───────────────────────────▼─────────────────────────────┐
│                    Repositories                          │
│  UserRepo │ AccountRepo │ TransactionRepo │ BudgetRepo   │
│  ReportRepo │ TagBudgetRepo │ UserTagRepo │ ...          │
└───────────────────────────┬─────────────────────────────┘
                            │ database/sql
┌───────────────────────────▼─────────────────────────────┐
│               PostgreSQL (Docker, :5432)                 │
└─────────────────────────────────────────────────────────┘
```

### Dependency injection

Wiring happens once in `cmd/server/main.go`: repos are created, injected into services, and services injected into controllers. No global state, no singletons.

---

## Prerequisites

| Dependency | Version | Purpose |
|---|---|---|
| Go | ≥ 1.26 | Runtime |
| Docker + Compose | any | PostgreSQL |
| Python + pip | 3.12+ | `fintself` scraper |
| `fintself` | latest | Bank scraping CLI |

Install the scraper:

```bash
pip3 install fintself --break-system-packages
```

> **Note:** `fintself` requires a real (headed) Chromium browser at runtime. Auth0 blocks headless mode.

### fintself patch (Banco de Chile, single-account)

The file `/home/joaquindpc/.local/lib/python3.12/site-packages/fintself/scrapers/cl/banco_chile.py` must be patched to handle single-account users. Without it, the scraper returns empty results when no "select account" modal appears.

---

## Quick Start

```bash
# 1. Start the database
docker compose up -d

# 2. Copy and fill in the configuration
cp config.example.yml config.yml
# edit config.yml with your credentials

# 3. Run the server (config flag is required)
go run ./cmd/server -config=config.yml
```

The API will be available at `http://localhost:8080`.  
Interactive docs (Swagger UI) at `http://localhost:8080/swagger/index.html`.

### Reset the database

```bash
docker compose down -v && docker compose up -d
```

Migrations re-run automatically on next startup.

---

## Configuration

The server requires a YAML config file passed via the `-config` flag. There is no `.env` fallback.

```yaml
# config.yml
database_url: "postgres://user:password@localhost:5432/mydb?sslmode=disable"
server_port: "8080"           # optional, defaults to "8080"
jwt_secret: "change-me"       # optional, defaults to "change-me-in-production"

# Bank credentials for the /sync endpoint
bancochile_user: "12345678-9"
bancochile_password: "your_bdc_password"
santander_user: "your_rut"
santander_password: "your_santander_password"
```

### Validation rules

| Field | Required | Default |
|---|---|---|
| `database_url` | **yes** | — |
| `server_port` | no | `"8080"` |
| `jwt_secret` | no | `"change-me-in-production"` |
| `bancochile_user` / `bancochile_password` | no | sync skipped if empty |
| `santander_user` / `santander_password` | no | sync skipped if empty |

---

## API Reference

### Public endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate and get a JWT |

### Protected endpoints (Bearer JWT required)

#### Accounts
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/accounts` | List all accounts for the user |
| `POST` | `/api/accounts` | Create a new account |
| `PUT` | `/api/accounts/:id` | Update account name/type/bank_id |
| `DELETE` | `/api/accounts/:id` | Delete an account |

#### Transactions
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/transactions` | List transactions (filterable) |
| `POST` | `/api/transactions` | Create a transaction manually |
| `PUT` | `/api/transactions/:id` | Partial update of a transaction |
| `DELETE` | `/api/transactions/:id` | Delete a transaction |

**Transaction filters** (query params): `year`, `month`, `category`, `flow`, `account_id`, `tags` (repeatable, AND-logic), `limit`.

#### Reports
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports/monthly` | Income/expenses/investments for one month |
| `GET` | `/api/reports/kpis` | Year-to-date KPIs (net worth, savings rate, etc.) |
| `GET` | `/api/reports/trend` | Monthly trend for a full year |
| `GET` | `/api/reports/budget-vs-actual` | Budget vs actual spending by category |
| `GET` | `/api/reports/annual` | Full annual report with projections |
| `GET` | `/api/categories/summary` | Category spending breakdown |

#### Budgets & Tags
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/budgets` | List monthly budgets |
| `PUT` | `/api/budgets` | Upsert a category budget |
| `PUT` | `/api/budgets/base` | Upsert annual base budgets (batch) |
| `GET` | `/api/tags` | List all available tags |
| `GET` | `/api/tags/used` | Top tags by usage frequency |
| `GET` | `/api/tags/spending` | Per-tag expense totals for a period |
| `GET` | `/api/tags/personal` | User's personal tags (with icons) |
| `POST` | `/api/tags/personal` | Save a personal tag |
| `PUT` | `/api/tags/personal/:tag/icon` | Set or clear a tag's icon |
| `GET` | `/api/tag-budgets` | List per-tag spending limits |
| `PUT` | `/api/tag-budgets` | Upsert a tag spending limit |

#### Sync, Import & Inference
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sync` | Scrape and import bank movements |
| `POST` | `/api/import/pdf` | Import transactions from a bank PDF |
| `POST` | `/api/tags/infer` | Infer tags for a transaction description |
| `PUT` | `/api/users/settings` | Update user inference settings |
| `GET` | `/api/insights` | Get financial insights |

---

## Data Flow

### Bank sync (`POST /api/sync`)

```
Client ──POST /api/sync──► SyncController
                                │
                                ▼
                          SyncService.Sync()
                                │
                  ┌─────────────┴──────────────┐
                  ▼                             ▼
         Banco de Chile                    Santander
         (if credentials set)             (if credentials set)
                  │                             │
                  ▼                             ▼
         fintself scrape cl_banco_chile   fintself scrape cl_santander
         (writes JSON to tmp file)        (writes JSON to tmp file)
                  │                             │
                  └─────────────┬──────────────┘
                                │ []MovimientoRecord
                                ▼
                          importer.Run()
                          ├── filter by date (MAX(date) from DB)
                          ├── auto-tag via TagInferenceService
                          ├── bulk insert transactions (ON CONFLICT DO NOTHING)
                          └── bulk insert CC statements & items
                                │
                                ▼
                        { imported, duplicates, cc_statements }
```

- A 5-minute timeout is applied per bank scrape.
- Duplicate detection uses the `bank_raw_id` unique constraint — re-syncing is always safe.
- Historical orphan transactions (imported before the account existed) are retroactively linked.

### PDF import (`POST /api/import/pdf`)

```
Client ──POST /api/import/pdf (multipart)──► ImportController
                                                    │
                                                    ▼
                                            ImportService
                                            ├── detect bank from filename/content
                                            ├── pdfparser.BancoChile.Parse() or
                                            │   pdfparser.Santander.Parse()
                                            │   (extracts rows by X/Y coordinates)
                                            ├── auto-tag via TagInferenceService
                                            └── CreateBatch() → DB
```

The PDF parser works by grouping positioned text elements by Y coordinate (visual rows), then by X coordinate (columns), and uses column header positions to classify amounts as INCOME or EXPENSE.

---

## Database & Migrations

Migrations are managed by [goose](https://github.com/pressly/goose) and run automatically on every server start. Files live in `migrations/` and are applied in lexicographic order.

```
migrations/
├── 001_init.sql             # transactions, budgets tables
├── 002_credit_card.sql      # cc_statements, cc_items
├── 003_hashtags_title_case.sql
├── ...
└── 018_clean_bdc_descriptions.sql
```

To add a migration, create `migrations/019_description.sql` with goose annotations:

```sql
-- +goose Up
ALTER TABLE ...;

-- +goose Down
ALTER TABLE ...;
```

### Core schema

```
transactions
├── id, date, description, category, flow (INCOME|EXPENSE|INVEST|OPENING)
├── subtype (FIJO|VARIABLE|DISCRECIONAL), asset, quantity
├── amount (always positive, CLP integer pesos)
├── source (manual|bank_json|pdf), bank_raw_id (unique — dedup key)
├── account_id, user_id, currency
└── tags TEXT[]

accounts
└── id, user_id, bank_id, name, type, currency

budgets
└── id, user_id, category, year, month (0 = annual base), amount

tag_budgets
└── id, user_id, tag, year, month, amount

users
└── id, email, password_hash, settings (JSONB)

cc_statements + cc_items
└── credit card billing cycles and line items
```

---

## Authentication

All `/api/*` routes except `POST /api/auth/login` require a `Bearer` JWT.

**Login request:**
```json
POST /api/auth/login
{ "email": "user@example.com", "password": "secret" }
```

**Login response:**
```json
{ "token": "<jwt>" }
```

The JWT is signed with HMAC-SHA256 using `jwt_secret` from config. It contains a `user_id` claim that is validated and injected into the Gin context on every protected request.

**Error responses:**
- `401 Unauthorized` — missing/invalid/expired token
- `401 Unauthorized` — wrong signing algorithm

---

## Tag Inference

Tags (e.g. `#streaming`, `#supermercado`) are automatically suggested when creating or importing transactions. The system has two levels:

```
Description: "Netflix Chile"
        │
        ▼
normalizeDescription()  →  "netflix chile"
        │
        ├── 1. Personal rules (UserTagHistory)
        │      Exact key match → tags from past manual assignments
        │      Source: "personal"
        │
        └── 2. App rules (AppTagRule)
               Pattern substring match → global rules
               Source: "app"
        │
        ▼
[ { tag: "#streaming", source: "personal" }, ... ]
```

### User settings (JSONB on `users.settings`)

| Setting | Default | Effect |
|---|---|---|
| `inference_enabled` | `true` | Master toggle. If false, no suggestions. |
| `personal_enabled` | `true` | Include personal history matches. |
| `app_enabled` | `true` | Include global app-level rules. |

### Learning

When a user manually assigns tags (`source = "manual"`), `RecordTagAssignment` upserts a `UserTagHistory` entry for that normalized description key, incrementing its `use_count`.

### Batch auto-tagging

During sync and PDF import, `AutoTagBatch` applies app-level rules to all transactions with no existing tags. Personal learning is never applied in batch mode.

---

## PDF Import

Two bank parsers are implemented:

| Bank | Parser | Format |
|---|---|---|
| Banco de Chile | `pdfparser.BancoChile` | Cartola (DD/MM with header-based year inference) |
| Santander | `pdfparser.Santander` | Cartola (DD/MM/YYYY format) |

The PDF is parsed using [`rsc.io/pdf`](https://pkg.go.dev/rsc.io/pdf). Text elements are grouped by Y position (±3 pts tolerance) into visual rows, then by X position into column tokens. The INCOME/EXPENSE classification is determined by which money column the amount's X coordinate is closest to.

---

## Middleware

### CORS

Allows requests from `http://localhost:5173` (frontend) and `http://localhost:8080`. `OPTIONS` preflight requests are handled with `204 No Content`.

### Request Logger

Structured logging via `log/slog` with colored output (`lmittmann/tint`). Log level is set by HTTP status:

| Status range | Level |
|---|---|
| `2xx`, `3xx` | `INFO` |
| `4xx` | `WARN` |
| `5xx` | `ERROR` |

Each log line includes: `method`, `path`, `status`, `latency`.

---

## Project Structure

```
backend/
├── cmd/
│   └── server/
│       ├── main.go        # entry point, wiring
│       ├── server.go      # route registration
│       └── db.go          # DB connection + goose migrations
│
├── internal/
│   ├── config/            # YAML config loader + validation
│   ├── domain/
│   │   ├── models.go      # all domain structs (User, Account, Transaction, ...)
│   │   ├── ports.go       # repository interfaces
│   │   └── bank.go        # bank ID constants
│   ├── controller/        # HTTP handlers (one file per resource)
│   ├── service/           # business logic
│   │   ├── auth_service.go
│   │   ├── account_service.go
│   │   ├── transaction_service.go
│   │   ├── tag_service.go
│   │   ├── report_service.go
│   │   ├── insight_service.go
│   │   ├── sync_service.go       # fintself orchestration
│   │   ├── import_service.go     # PDF import orchestration
│   │   └── tag_inference_service.go
│   ├── repository/        # SQL implementations of domain ports
│   ├── middleware/        # JWT auth middleware
│   ├── pdfparser/         # Banco de Chile + Santander PDF parsers
│   ├── importer/          # shared bulk-insert logic
│   └── logger/            # slog setup with tint
│
├── migrations/            # goose SQL migrations (001 → 018)
├── docs/                  # auto-generated Swagger docs (swag)
├── go.mod
└── config.example.yml
```

### Key dependencies

| Package | Purpose |
|---|---|
| `github.com/gin-gonic/gin` | HTTP framework |
| `github.com/golang-jwt/jwt/v5` | JWT signing & validation |
| `github.com/pressly/goose/v3` | Database migrations |
| `github.com/lib/pq` | PostgreSQL driver |
| `github.com/swaggo/gin-swagger` | Swagger UI |
| `github.com/lmittmann/tint` | Colored structured logging |
| `github.com/xuri/excelize/v2` | Excel import |
| `rsc.io/pdf` | PDF text extraction |
| `gopkg.in/yaml.v3` | Config file parsing |
