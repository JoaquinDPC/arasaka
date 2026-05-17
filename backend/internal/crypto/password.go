// Package crypto provides AES-256-GCM encryption helpers for storing sensitive
// per-account fields (e.g. PDF passwords) in the database.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
)

// MasterKeyFromHex decodes a 64-character hex string into a 32-byte AES key.
func MasterKeyFromHex(h string) ([]byte, error) {
	k, err := hex.DecodeString(h)
	if err != nil || len(k) != 32 {
		return nil, fmt.Errorf("master_key must be a 64-character hex string (32 bytes); generate with: openssl rand -hex 32")
	}
	return k, nil
}

// Encrypt encrypts plaintext with AES-256-GCM using key and returns
// base64(nonce + ciphertext). key must be 32 bytes.
func Encrypt(plaintext string, key []byte) (string, error) {
	if len(key) != 32 {
		return "", fmt.Errorf("master_key not configured; set master_key in config.yml")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ct := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ct), nil
}

// Decrypt decodes base64(nonce + ciphertext) and decrypts with AES-256-GCM.
// key must be 32 bytes.
func Decrypt(cipherB64 string, key []byte) (string, error) {
	if len(key) != 32 {
		return "", fmt.Errorf("master_key not configured")
	}
	data, err := base64.StdEncoding.DecodeString(cipherB64)
	if err != nil {
		return "", fmt.Errorf("decode ciphertext: %w", err)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	n := gcm.NonceSize()
	if len(data) < n {
		return "", fmt.Errorf("ciphertext too short")
	}
	plain, err := gcm.Open(nil, data[:n], data[n:], nil)
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}
	return string(plain), nil
}
