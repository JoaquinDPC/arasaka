# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this does

Arasaka backend — scrapes movements from Banco de Chile via the `fintself` CLI and inserts them into PostgreSQL. Exposes a Gin HTTP API consumed by the Arasaka frontend.

## Project structure

```
/home/joaquindpc/arasaka/
  backend/    ← this directory (Go + Gin API, port 8080)
  frontend/   ← React + Vite + Tailwind (port 5173)
```

## Commands

```bash
# Build
go build ./...

# Run backend (from backend/)
go run .

# Run frontend (from frontend/)
npm run dev

# Start the database
docker compose up -d

# Wipe the database (resets migrations too)
docker compose down -v && docker compose up -d
```

## Environment

Copy `.env.example` to `.env` and fill in:
```
BDC_RUT=12345678-9
BDC_PASSWORD=your_password
DATABASE_URL=postgres://bancochile:bancochile@localhost:5432/bancochile?sslmode=disable
```

`fintself` must be installed: `pip3 install fintself --break-system-packages`

## Architecture

**Flow:** `main.go` → `fetchMovements()` → `insertMovements()`

- `fintself.go` — runs `fintself scrape cl_banco_chile --output-file <tmp.json>`, passes credentials as env vars (`CL_BANCO_CHILE_USER`, `CL_BANCO_CHILE_PASSWORD`), reads the JSON output into `[]Movement`.
- `db.go` — connects to Postgres, runs SQL migrations from `migrations/*.sql` in order (tracked in `schema_migrations` table), then bulk-inserts movements. Duplicates are silently ignored via `ON CONFLICT ON CONSTRAINT movements_dedup DO NOTHING`.
- `config.go` — reads `.env` then falls back to real env vars. `.env` never overrides an already-set env var.

## fintself patch

`/home/joaquindpc/.local/lib/python3.12/site-packages/fintself/scrapers/cl/banco_chile.py` was patched to handle the single-account case: when the "select account" modal doesn't appear, it now attempts direct table extraction instead of returning empty. Without this patch, debit/checking account movements are skipped.

## Migrations

Files in `migrations/` are named `NNN_description.sql`. The runner applies them in lexicographic order and records each version in `schema_migrations`. To add a migration, create `002_description.sql` — it will be picked up automatically on next run.

## Language

All code, comments, variable names, commit messages, and documentation must be written in English. No Spanish anywhere in the codebase.
