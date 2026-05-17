-- +goose Up

-- Add color override column to user_tags
ALTER TABLE user_tags ADD COLUMN IF NOT EXISTS color TEXT;

-- Populate user_tags from existing transactions
-- (batch imports bypass upsertTags, so historical tags may be missing)
INSERT INTO user_tags (user_id, tag)
SELECT DISTINCT t.user_id, unnest(t.tags) AS tag
FROM transactions t
WHERE t.user_id IS NOT NULL
ON CONFLICT (user_id, tag) DO NOTHING;

-- Remove seeded tags that were never used in any transaction and have no customizations
DELETE FROM user_tags ut
WHERE ut.icon IS NULL
  AND ut.color IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.user_id = ut.user_id
      AND ut.tag = ANY(t.tags)
  );

-- +goose Down
ALTER TABLE user_tags DROP COLUMN IF EXISTS color;
