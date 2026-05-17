-- +goose Up
UPDATE accounts
SET settings = jsonb_build_object(
    'app_tag_inference',      COALESCE((settings->>'app_enabled')::boolean, true),
    'personal_tag_inference', COALESCE((settings->>'personal_enabled')::boolean, true),
    'monthly_salary',         COALESCE((settings->>'monthly_salary')::bigint, 0),
    'pdf_password',           COALESCE(settings->>'pdf_password', '')
);

-- +goose Down
-- no-op: old key names are gone, can't reliably reverse
