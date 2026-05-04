-- +goose Up

-- transactions: add user_id (nullable; populated from linked account)
ALTER TABLE transactions ADD COLUMN user_id BIGINT REFERENCES users(id);
UPDATE transactions t
    SET user_id = a.user_id
    FROM accounts a
    WHERE t.account_id = a.id;

-- budgets: add user_id (NOT NULL after backfill) and account_id (nullable)
ALTER TABLE budgets ADD COLUMN user_id  BIGINT REFERENCES users(id);
ALTER TABLE budgets ADD COLUMN account_id BIGINT REFERENCES accounts(id);
UPDATE budgets SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1);
ALTER TABLE budgets ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE budgets DROP CONSTRAINT budgets_unique;
ALTER TABLE budgets ADD CONSTRAINT budgets_unique UNIQUE (user_id, category, year, month);

-- credit_card_statements: rename TEXT account_id → external_account_id, add FK fields
ALTER TABLE credit_card_statements DROP CONSTRAINT cc_statements_dedup;
ALTER TABLE credit_card_statements RENAME COLUMN account_id TO external_account_id;
ALTER TABLE credit_card_statements ADD CONSTRAINT cc_statements_dedup UNIQUE (external_account_id, period_from, period_to);
ALTER TABLE credit_card_statements ADD COLUMN account_id BIGINT REFERENCES accounts(id);
ALTER TABLE credit_card_statements ADD COLUMN user_id    BIGINT REFERENCES users(id);

-- credit_card_items: add user_id and account_id (populated from parent statement)
ALTER TABLE credit_card_items ADD COLUMN user_id    BIGINT REFERENCES users(id);
ALTER TABLE credit_card_items ADD COLUMN account_id BIGINT REFERENCES accounts(id);
UPDATE credit_card_items ci
    SET user_id    = s.user_id,
        account_id = s.account_id
    FROM credit_card_statements s
    WHERE ci.statement_id = s.id;

-- +goose Down

ALTER TABLE credit_card_items DROP COLUMN account_id;
ALTER TABLE credit_card_items DROP COLUMN user_id;

ALTER TABLE credit_card_statements DROP COLUMN user_id;
ALTER TABLE credit_card_statements DROP COLUMN account_id;
ALTER TABLE credit_card_statements DROP CONSTRAINT cc_statements_dedup;
ALTER TABLE credit_card_statements RENAME COLUMN external_account_id TO account_id;
ALTER TABLE credit_card_statements ADD CONSTRAINT cc_statements_dedup UNIQUE (account_id, period_from, period_to);

ALTER TABLE budgets DROP CONSTRAINT budgets_unique;
ALTER TABLE budgets ADD CONSTRAINT budgets_unique UNIQUE (category, year, month);
ALTER TABLE budgets DROP COLUMN account_id;
ALTER TABLE budgets DROP COLUMN user_id;

ALTER TABLE transactions DROP COLUMN user_id;
