-- +goose Up
ALTER TABLE users
    ADD COLUMN settings JSONB NOT NULL DEFAULT '{"inference_enabled": true, "personal_enabled": true, "app_enabled": true}';

CREATE TABLE app_tag_rules (
    id         BIGSERIAL PRIMARY KEY,
    pattern    TEXT NOT NULL UNIQUE,
    tags       TEXT[] NOT NULL,
    match_type TEXT NOT NULL DEFAULT 'contains'
);

CREATE INDEX idx_app_tag_rules_pattern ON app_tag_rules(pattern);

CREATE TABLE user_tag_history (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description_key TEXT NOT NULL,
    tags            TEXT[] NOT NULL,
    use_count       INTEGER NOT NULL DEFAULT 1,
    last_used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, description_key)
);

CREATE INDEX idx_user_tag_history_user_key ON user_tag_history(user_id, description_key);

INSERT INTO app_tag_rules (pattern, tags) VALUES
    ('mcdonald',     ARRAY['Comida-rapida']),
    ('burger king',  ARRAY['Comida-rapida']),
    ('kfc',          ARRAY['Comida-rapida']),
    ('uber eats',    ARRAY['Delivery']),
    ('rappi',        ARRAY['Delivery']),
    ('pedidosya',    ARRAY['Delivery']),
    ('netflix',      ARRAY['Suscripciones']),
    ('spotify',      ARRAY['Suscripciones']),
    ('amazon',       ARRAY['Suscripciones']),
    ('apple',        ARRAY['Suscripciones']),
    ('copec',        ARRAY['Bencina']),
    ('shell',        ARRAY['Bencina']),
    ('enex',         ARRAY['Bencina']),
    ('jumbo',        ARRAY['Supermercado']),
    ('lider',        ARRAY['Supermercado']),
    ('unimarc',      ARRAY['Supermercado']),
    ('santa isabel', ARRAY['Supermercado']),
    ('tottus',       ARRAY['Supermercado'])
ON CONFLICT DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS user_tag_history;
DROP TABLE IF EXISTS app_tag_rules;
ALTER TABLE users DROP COLUMN IF EXISTS settings;
