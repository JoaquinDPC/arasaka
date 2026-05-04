-- +goose Up
CREATE TABLE tag_budgets (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag        TEXT    NOT NULL,
    year       INTEGER NOT NULL,
    month      INTEGER NOT NULL DEFAULT 0,
    amount     BIGINT  NOT NULL CHECK (amount >= 0),
    CONSTRAINT tag_budgets_unique UNIQUE (user_id, tag, year, month)
);

CREATE INDEX idx_tag_budgets_user_tag ON tag_budgets(user_id, tag);

-- +goose Down
DROP INDEX IF EXISTS idx_tag_budgets_user_tag;
DROP TABLE IF EXISTS tag_budgets;
