-- +goose Up

-- Initial user: jdelprado@gmail.com / 1234  (bcrypt cost=10)
INSERT INTO users (email, password_hash)
VALUES ('jdelprado@gmail.com', '$2a$10$0Q/ZxYmuNGTKbZM7XIcNiezEP705W0NYyS2tCQjro/xnRT/61NS0y');

-- Associate all existing accounts to this user
UPDATE accounts
SET user_id = (SELECT id FROM users WHERE email = 'jdelprado@gmail.com');

-- Now that all rows are filled, enforce NOT NULL
ALTER TABLE accounts ALTER COLUMN user_id SET NOT NULL;

-- +goose Down

ALTER TABLE accounts ALTER COLUMN user_id DROP NOT NULL;
UPDATE accounts SET user_id = NULL;
DELETE FROM users WHERE email = 'jdelprado@gmail.com';
