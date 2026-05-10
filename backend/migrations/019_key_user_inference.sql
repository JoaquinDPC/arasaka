-- +goose Up
ALTER TABLE user_tag_history
    ADD COLUMN IF NOT EXISTS key_user TEXT;

-- +goose Down
ALTER TABLE user_tag_history
    DROP COLUMN IF EXISTS key_user;
