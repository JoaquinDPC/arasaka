-- +goose Up
ALTER TABLE tag_budgets ADD COLUMN user_tag_id BIGINT;

UPDATE tag_budgets tb
SET user_tag_id = ut.id
FROM user_tags ut
WHERE ut.user_id = tb.user_id AND ut.tag = tb.tag;

DELETE FROM tag_budgets WHERE user_tag_id IS NULL;

ALTER TABLE tag_budgets ALTER COLUMN user_tag_id SET NOT NULL;
ALTER TABLE tag_budgets
    ADD CONSTRAINT fk_tag_budgets_user_tag
    FOREIGN KEY (user_tag_id) REFERENCES user_tags(id) ON DELETE CASCADE;

ALTER TABLE tag_budgets DROP CONSTRAINT tag_budgets_unique;
ALTER TABLE tag_budgets ADD CONSTRAINT tag_budgets_unique UNIQUE (user_tag_id, year, month);

ALTER TABLE tag_budgets DROP COLUMN tag;

-- +goose Down
ALTER TABLE tag_budgets ADD COLUMN tag TEXT;

UPDATE tag_budgets tb
SET tag = ut.tag
FROM user_tags ut
WHERE ut.id = tb.user_tag_id;

ALTER TABLE tag_budgets ALTER COLUMN tag SET NOT NULL;

ALTER TABLE tag_budgets DROP CONSTRAINT tag_budgets_unique;
ALTER TABLE tag_budgets ADD CONSTRAINT tag_budgets_unique UNIQUE (user_id, tag, year, month);

ALTER TABLE tag_budgets DROP CONSTRAINT fk_tag_budgets_user_tag;
ALTER TABLE tag_budgets DROP COLUMN user_tag_id;
