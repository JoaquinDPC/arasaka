-- +goose Up
ALTER TABLE credit_card_statements
    ADD COLUMN IF NOT EXISTS due_date    DATE,
    ADD COLUMN IF NOT EXISTS min_payment BIGINT NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE credit_card_statements
    DROP COLUMN IF EXISTS due_date,
    DROP COLUMN IF EXISTS min_payment;
