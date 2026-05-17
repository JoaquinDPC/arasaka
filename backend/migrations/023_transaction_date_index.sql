-- +goose Up
CREATE INDEX IF NOT EXISTS idx_transactions_account_date
    ON transactions (account_id, date ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_transactions_source_date
    ON transactions (source, date ASC, id ASC);
