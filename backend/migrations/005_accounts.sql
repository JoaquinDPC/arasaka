-- +goose Up
CREATE TABLE accounts (
    id         BIGSERIAL PRIMARY KEY,
    bank_name  TEXT NOT NULL,
    name       TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'corriente',
    currency   TEXT NOT NULL DEFAULT 'CLP',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transactions ADD COLUMN account_id BIGINT REFERENCES accounts(id);

-- +goose Down
ALTER TABLE transactions DROP COLUMN IF EXISTS account_id;
DROP TABLE IF EXISTS accounts;
