-- +goose Up
-- Normalize budget categories and transaction categories from Title Case to camelCase.
-- All current categories are single-word, so camelCase = lowercase.
UPDATE budgets SET category = LOWER(category);
UPDATE transactions SET category = LOWER(category);

-- +goose Down
UPDATE budgets SET category = INITCAP(LOWER(category));
UPDATE transactions SET category = INITCAP(LOWER(category));
