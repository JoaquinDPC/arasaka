-- +goose Up
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'CLP';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cc_statement_id BIGINT;

CREATE TABLE IF NOT EXISTS credit_card_statements (
    id           BIGSERIAL    PRIMARY KEY,
    account_id   TEXT         NOT NULL,
    period_from  DATE         NOT NULL,
    period_to    DATE         NOT NULL,
    currency     TEXT         NOT NULL DEFAULT 'CLP',
    total_amount BIGINT       NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT cc_statements_dedup UNIQUE (account_id, period_from, period_to)
);

CREATE TABLE IF NOT EXISTS credit_card_items (
    id                  BIGSERIAL    PRIMARY KEY,
    statement_id        BIGINT       NOT NULL REFERENCES credit_card_statements(id),
    date                DATE         NOT NULL,
    description         TEXT         NOT NULL,
    amount              BIGINT       NOT NULL CHECK (amount >= 0),
    currency            TEXT         NOT NULL DEFAULT 'CLP',
    installment_current INTEGER,
    installment_total   INTEGER,
    item_type           TEXT         NOT NULL,
    bank_raw_id         TEXT         UNIQUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE transactions
    ADD CONSTRAINT fk_transactions_cc_statement
    FOREIGN KEY (cc_statement_id) REFERENCES credit_card_statements(id);

-- +goose Down
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_transactions_cc_statement;
ALTER TABLE transactions DROP COLUMN IF EXISTS cc_statement_id;
ALTER TABLE transactions DROP COLUMN IF EXISTS currency;
DROP TABLE IF EXISTS credit_card_items;
DROP TABLE IF EXISTS credit_card_statements;
