-- +goose Up
CREATE TABLE user_tags (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag        TEXT NOT NULL,
    UNIQUE (user_id, tag)
);

CREATE INDEX idx_user_tags_user_id ON user_tags(user_id);

-- Seed personal finance tags for the initial user
INSERT INTO user_tags (user_id, tag)
SELECT u.id, t.tag
FROM users u
CROSS JOIN (VALUES
    ('sueldo'),
    ('freelance'),
    ('bono'),
    ('dividendos'),
    ('devolucion'),
    ('arriendo'),
    ('luz'),
    ('agua'),
    ('gas'),
    ('internet'),
    ('condominio'),
    ('supermercado'),
    ('restaurante'),
    ('delivery'),
    ('cafe'),
    ('feria'),
    ('bencina'),
    ('uber'),
    ('taxi'),
    ('estacionamiento'),
    ('peaje'),
    ('netflix'),
    ('spotify'),
    ('amazon'),
    ('youtube'),
    ('icloud'),
    ('farmacia'),
    ('medico'),
    ('dentista'),
    ('gym'),
    ('optica'),
    ('ropa'),
    ('calzado'),
    ('peluqueria'),
    ('veterinario'),
    ('comidaMascota'),
    ('cine'),
    ('bar'),
    ('concierto'),
    ('vuelo'),
    ('hotel'),
    ('airbnb'),
    ('inversion'),
    ('ahorro'),
    ('transferencia')
) AS t(tag)
WHERE u.email = 'jdelprado@gmail.com';

-- +goose Down
DROP INDEX IF EXISTS idx_user_tags_user_id;
DROP TABLE IF EXISTS user_tags;
