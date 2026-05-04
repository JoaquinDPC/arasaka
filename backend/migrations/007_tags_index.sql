-- +goose Up
CREATE INDEX IF NOT EXISTS idx_transactions_tags ON transactions USING GIN(tags);

-- +goose Down
DROP INDEX IF EXISTS idx_transactions_tags;
