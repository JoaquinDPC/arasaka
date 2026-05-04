package service

import (
	"context"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"arasaka/internal/domain"
)

type AuthService struct {
	users     domain.UserRepository
	jwtSecret []byte
}

func NewAuthService(users domain.UserRepository, jwtSecret string) *AuthService {
	return &AuthService{users: users, jwtSecret: []byte(jwtSecret)}
}

type LoginResult struct {
	Token string      `json:"token"`
	User  domain.User `json:"user"`
}

func (s *AuthService) Login(ctx context.Context, email, password string) (LoginResult, error) {
	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		return LoginResult{}, fmt.Errorf("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return LoginResult{}, fmt.Errorf("invalid credentials")
	}

	claims := jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return LoginResult{}, fmt.Errorf("could not generate token: %w", err)
	}

	user.PasswordHash = ""
	return LoginResult{Token: signed, User: user}, nil
}
