-- +goose Up
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS key_user TEXT;

-- +goose Down
ALTER TABLE transactions DROP COLUMN IF EXISTS key_user;
