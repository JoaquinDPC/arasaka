-- +goose Up
ALTER TABLE transactions
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS subtype,
  DROP COLUMN IF EXISTS asset,
  DROP COLUMN IF EXISTS quantity;

ALTER TABLE transactions RENAME COLUMN key_user TO custom_description;

ALTER TABLE user_tag_history RENAME COLUMN key_user TO custom_description;

DROP TABLE IF EXISTS budgets;

-- +goose Down
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category   text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS subtype    text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS asset      text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS quantity   float;
ALTER TABLE transactions RENAME COLUMN custom_description TO key_user;
ALTER TABLE user_tag_history RENAME COLUMN custom_description TO key_user;

