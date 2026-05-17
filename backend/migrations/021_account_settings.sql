-- +goose Up
ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL
    DEFAULT '{"inference_enabled": true, "pdf_password": ""}'::jsonb;

-- +goose Down
ALTER TABLE accounts DROP COLUMN IF EXISTS settings;
