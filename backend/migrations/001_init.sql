-- +goose Up
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id          BIGSERIAL PRIMARY KEY,
    date        DATE        NOT NULL,
    description TEXT        NOT NULL,
    category    TEXT        NOT NULL,
    flow        TEXT        NOT NULL CHECK (flow IN ('INCOME','EXPENSE','INVEST','OPENING')),
    subtype     TEXT        CHECK (subtype IN ('FIJO','VARIABLE','DISCRECIONAL')),
    asset       TEXT,
    quantity    NUMERIC(20,8),
    amount      BIGINT      NOT NULL CHECK (amount >= 0),
    notes       TEXT,
    source      TEXT        NOT NULL DEFAULT 'manual',
    bank_raw_id TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT transactions_dedup UNIQUE (bank_raw_id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_date     ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_flow     ON transactions(flow);

CREATE TABLE IF NOT EXISTS budgets (
    id       BIGSERIAL PRIMARY KEY,
    category TEXT    NOT NULL,
    year     INTEGER NOT NULL,
    month    INTEGER NOT NULL DEFAULT 0,
    amount   BIGINT  NOT NULL,

    CONSTRAINT budgets_unique UNIQUE (category, year, month)
);

-- Base budgets for 2026 (month=0 means annual baseline)
INSERT INTO budgets (category, year, month, amount) VALUES
    ('Casa',          2026, 0, 2000000),
    ('Personal',      2026, 0, 500000),
    ('Salud',         2026, 0, 200000),
    ('Transporte',    2026, 0, 200000),
    ('Suscripciones', 2026, 0, 0),
    ('Gustos',        2026, 0, 0),
    ('Otros',         2026, 0, 0),
    ('Mascota',       2026, 0, 0),
    ('Seguros',       2026, 0, 0),
    ('Regalo',        2026, 0, 0),
    ('Vacaciones',    2026, 0, 0)
ON CONFLICT ON CONSTRAINT budgets_unique DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS budgets;
DROP INDEX IF EXISTS idx_transactions_flow;
DROP INDEX IF EXISTS idx_transactions_category;
DROP INDEX IF EXISTS idx_transactions_date;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS schema_migrations;
