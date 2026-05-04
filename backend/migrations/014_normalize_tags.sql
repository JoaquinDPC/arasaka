-- +goose Up

-- Normalize transaction tags: split camelCase with "-", first-letter uppercase, rest lowercase.
-- e.g. "comidaMascota" → "Comida-mascota", "INVERSION" → "Inversion"
UPDATE transactions
SET tags = ARRAY(
    SELECT DISTINCT
        upper(left(lower(regexp_replace(t, '([a-z])([A-Z])', '\1-\2', 'g')), 1)) ||
        substring(lower(regexp_replace(t, '([a-z])([A-Z])', '\1-\2', 'g')) from 2)
    FROM unnest(tags) AS t
    WHERE t <> ''
)
WHERE array_length(tags, 1) > 0;

-- Normalize user_tags: delete rows that would become duplicates after normalization, then update.
WITH normalized AS (
    SELECT id, user_id,
        upper(left(lower(regexp_replace(tag, '([a-z])([A-Z])', '\1-\2', 'g')), 1)) ||
        substring(lower(regexp_replace(tag, '([a-z])([A-Z])', '\1-\2', 'g')) from 2) AS new_tag
    FROM user_tags
),
keep_ids AS (
    SELECT MIN(id) AS id FROM normalized GROUP BY user_id, new_tag
)
DELETE FROM user_tags WHERE id NOT IN (SELECT id FROM keep_ids);

UPDATE user_tags
SET tag =
    upper(left(lower(regexp_replace(tag, '([a-z])([A-Z])', '\1-\2', 'g')), 1)) ||
    substring(lower(regexp_replace(tag, '([a-z])([A-Z])', '\1-\2', 'g')) from 2);

-- +goose Down
-- Lossy transformation; cannot reverse.
