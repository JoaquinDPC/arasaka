-- +goose NO TRANSACTION
-- +goose Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_unlinked_cc
    ON transactions (user_id, amount)
    WHERE cc_statement_id IS NULL;

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_unlinked_cc;
