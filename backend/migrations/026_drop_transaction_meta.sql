-- +goose Up
ALTER TABLE transactions DROP COLUMN IF EXISTS meta;

-- +goose Down
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;
