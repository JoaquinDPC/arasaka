-- +goose Up
ALTER TABLE user_tag_history RENAME TO user_tag_rules;
ALTER INDEX idx_user_tag_history_user_key RENAME TO idx_user_tag_rules_user_key;

-- +goose Down
ALTER INDEX idx_user_tag_rules_user_key RENAME TO idx_user_tag_history_user_key;
ALTER TABLE user_tag_rules RENAME TO user_tag_history;
