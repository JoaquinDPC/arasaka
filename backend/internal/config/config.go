package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	DatabaseURL        string `yaml:"database_url"`
	ServerPort         string `yaml:"server_port"`
	JWTSecret          string `yaml:"jwt_secret"`
	MasterKey          string `yaml:"master_key"`
	DevBypassAuth      bool   `yaml:"dev_bypass_auth"`
}

// Load parses the YAML file at path and returns the validated config.
// Returns an error if the file is missing, malformed, or missing required fields.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("config: cannot read %q: %w", path, err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("config: malformed YAML in %q: %w", path, err)
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("config: database_url is required")
	}
	if cfg.ServerPort == "" {
		cfg.ServerPort = "8080"
	}
	if cfg.JWTSecret == "" {
		cfg.JWTSecret = "change-me-in-production"
	}

	return &cfg, nil
}
