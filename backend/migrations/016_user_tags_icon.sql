-- +goose Up
ALTER TABLE user_tags ADD COLUMN IF NOT EXISTS icon TEXT;

-- +goose Down
ALTER TABLE user_tags DROP COLUMN IF EXISTS icon;
