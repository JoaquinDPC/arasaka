-- +goose Up
ALTER TABLE credit_card_statements RENAME TO credit_card_bills;
ALTER TABLE credit_card_bills RENAME CONSTRAINT cc_statements_dedup TO cc_bills_dedup;
ALTER TABLE credit_card_items RENAME COLUMN statement_id TO bill_id;
ALTER TABLE transactions RENAME COLUMN cc_statement_id TO cc_bill_id;
ALTER TABLE transactions RENAME CONSTRAINT fk_transactions_cc_statement TO fk_transactions_cc_bill;

-- +goose Down
ALTER TABLE transactions RENAME CONSTRAINT fk_transactions_cc_bill TO fk_transactions_cc_statement;
ALTER TABLE transactions RENAME COLUMN cc_bill_id TO cc_statement_id;
ALTER TABLE credit_card_items RENAME COLUMN bill_id TO statement_id;
ALTER TABLE credit_card_bills RENAME CONSTRAINT cc_bills_dedup TO cc_statements_dedup;
ALTER TABLE credit_card_bills RENAME TO credit_card_statements;
