-- +goose Up
ALTER TABLE user_tags ADD COLUMN usage_count BIGINT NOT NULL DEFAULT 0;

UPDATE user_tags ut
SET usage_count = sub.cnt
FROM (
    SELECT user_id, unnest(tags) AS tag, COUNT(*) AS cnt
    FROM transactions
    GROUP BY user_id, tag
) sub
WHERE ut.user_id = sub.user_id AND ut.tag = sub.tag;

CREATE INDEX idx_user_tags_usage ON user_tags (user_id, usage_count DESC);

-- +goose Down
DROP INDEX IF EXISTS idx_user_tags_usage;
ALTER TABLE user_tags DROP COLUMN IF EXISTS usage_count;
