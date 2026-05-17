-- +goose Up
CREATE INDEX IF NOT EXISTS idx_transactions_user_flow_date
    ON transactions (user_id, flow, date);

-- +goose Down
DROP INDEX IF EXISTS idx_transactions_user_flow_date;
