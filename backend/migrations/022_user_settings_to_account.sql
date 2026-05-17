-- +goose Up
-- Migrate inference settings from users.settings to accounts.settings,
-- add personal_enabled, app_enabled, monthly_salary to all existing accounts.

UPDATE accounts
SET settings = settings || jsonb_build_object(
    'personal_enabled', COALESCE((settings->>'personal_enabled')::boolean, true),
    'app_enabled',      COALESCE((settings->>'app_enabled')::boolean, true),
    'monthly_salary',   COALESCE((settings->>'monthly_salary')::bigint, 0)
)
WHERE NOT (settings ? 'personal_enabled' AND settings ? 'app_enabled');

ALTER TABLE accounts
    ALTER COLUMN settings SET DEFAULT
        '{"inference_enabled": true, "personal_enabled": true, "app_enabled": true, "monthly_salary": 0}';

ALTER TABLE users DROP COLUMN IF EXISTS settings;
