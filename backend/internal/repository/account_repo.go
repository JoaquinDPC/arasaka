package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"arasaka/internal/domain"
)

type accountRepo struct {
	db *sql.DB
}

// NewAccountRepository returns a postgres-backed AccountRepository.
func NewAccountRepository(db *sql.DB) domain.AccountRepository {
	return &accountRepo{db: db}
}

func (r *accountRepo) List(ctx context.Context, userID int64) ([]domain.Account, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			a.id, a.user_id, a.bank_id, a.name, a.type, a.currency, a.created_at, a.updated_at,
			COALESCE(SUM(
				CASE
					WHEN t.flow IN ('INCOME', 'OPENING') THEN  t.amount
					WHEN t.flow = 'EXPENSE'             THEN -t.amount
					ELSE 0
				END
			), 0) AS balance,
			COUNT(t.id)::int AS movement_count,
			MAX(t.date) AS last_movement
		FROM accounts a
		LEFT JOIN transactions t ON t.account_id = a.id
		WHERE a.user_id = $1
		GROUP BY a.id, a.user_id, a.bank_id, a.name, a.type, a.currency, a.created_at, a.updated_at
		ORDER BY a.created_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []domain.Account
	for rows.Next() {
		var a domain.Account
		if err := rows.Scan(
			&a.ID, &a.UserID, &a.BankID, &a.Name, &a.Type, &a.Currency,
			&a.CreatedAt, &a.UpdatedAt,
			&a.Balance, &a.MovementCount, &a.LastMovement,
		); err != nil {
			return nil, err
		}
		accounts = append(accounts, a)
	}
	if accounts == nil {
		accounts = []domain.Account{}
	}
	return accounts, nil
}

func (r *accountRepo) Create(ctx context.Context, p domain.CreateAccountParams) (domain.Account, error) {
	if p.Currency == "" {
		p.Currency = "CLP"
	}
	if p.Type == "" {
		p.Type = "corriente"
	}
	var a domain.Account
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO accounts (user_id, bank_id, name, type, currency)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, user_id, bank_id, name, type, currency, created_at, updated_at
	`, p.UserID, p.BankID, p.Name, p.Type, p.Currency).Scan(
		&a.ID, &a.UserID, &a.BankID, &a.Name, &a.Type, &a.Currency, &a.CreatedAt, &a.UpdatedAt,
	)
	return a, err
}

func (r *accountRepo) Update(ctx context.Context, id int64, p domain.UpdateAccountParams) (domain.Account, error) {
	set := ""
	var args []any
	n := 1
	add := func(col string, val any) {
		if set != "" {
			set += ", "
		}
		set += fmt.Sprintf("%s = $%d", col, n)
		args = append(args, val)
		n++
	}

	if p.BankID != nil {
		add("bank_id", *p.BankID)
	}
	if p.Name != nil {
		add("name", *p.Name)
	}
	if p.Type != nil {
		add("type", *p.Type)
	}
	if set == "" {
		return domain.Account{}, fmt.Errorf("no fields to update")
	}

	set += fmt.Sprintf(", updated_at = $%d", n)
	args = append(args, time.Now())
	n++
	args = append(args, id)

	query := fmt.Sprintf(`
		UPDATE accounts SET %s WHERE id = $%d
		RETURNING id, bank_id, name, type, currency, created_at, updated_at
	`, set, n)

	var a domain.Account
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&a.ID, &a.BankID, &a.Name, &a.Type, &a.Currency, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return domain.Account{}, fmt.Errorf("not found")
	}
	return a, err
}

func (r *accountRepo) Delete(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, "DELETE FROM accounts WHERE id = $1", id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("not found")
	}
	return nil
}
