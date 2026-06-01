-- +goose Up
-- Snapshot pdf rows that will be deleted into a backup table for rollback.
CREATE TABLE transactions_pdf_dedup_backup AS
SELECT p.*
FROM transactions p
WHERE p.source = 'pdf'
  AND EXISTS (
    SELECT 1
    FROM transactions bj
    WHERE bj.account_id = p.account_id
      AND bj.date       = p.date
      AND bj.amount     = p.amount
      AND bj.flow       = p.flow
      AND bj.source     = 'bank_json'
  );

-- Remove the duplicates.
DELETE FROM transactions AS p
WHERE p.source = 'pdf'
  AND EXISTS (
    SELECT 1
    FROM transactions bj
    WHERE bj.account_id = p.account_id
      AND bj.date       = p.date
      AND bj.amount     = p.amount
      AND bj.flow       = p.flow
      AND bj.source     = 'bank_json'
  );

-- +goose Down
-- Restore deleted rows from backup.
INSERT INTO transactions (
    id, date, description, flow, custom_description,
    amount, notes, source, bank_raw_id, currency,
    cc_statement_id, account_id, tags, user_id, created_at, updated_at
)
SELECT
    id, date, description, flow, custom_description,
    amount, notes, source, bank_raw_id, currency,
    cc_statement_id, account_id, tags, user_id, created_at, updated_at
FROM transactions_pdf_dedup_backup
ON CONFLICT DO NOTHING;

DROP TABLE transactions_pdf_dedup_backup;
