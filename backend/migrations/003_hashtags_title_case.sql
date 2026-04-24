-- +goose Up

-- Add hashtags/tags support to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- Convert existing categories to title case (e.g. CASA → Casa)
UPDATE transactions SET category = INITCAP(LOWER(category));
UPDATE budgets SET category = INITCAP(LOWER(category));

-- +goose Down
ALTER TABLE transactions DROP COLUMN IF EXISTS tags;
UPDATE transactions SET category = UPPER(category);
UPDATE budgets SET category = UPPER(category);
