  FROM golang:1.26-alpine AS builder
  WORKDIR /build
  COPY backend/go.mod backend/go.sum ./
  RUN go mod download
  COPY backend/ .
  RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o arasaka-server ./cmd/server

  FROM debian:bookworm-slim
  RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates tzdata python3 python3-pip xvfb \
      && pip3 install fintself --break-system-packages \
      && python3 -m playwright install chromium --with-deps \
      && rm -rf /var/lib/apt/lists/*
  WORKDIR /app
  COPY --from=builder /build/arasaka-server .
  COPY --from=builder /build/migrations ./migrations
  RUN printf '%s\n' \
      '#!/bin/sh' \
      'set -e' \
      'cat > /app/config.yml <<CONF' \
      'database_url: "$DATABASE_URL"' \
      'server_port: "${SERVER_PORT:-8080}"' \
      'jwt_secret: "$JWT_SECRET"' \
      'master_key: "${MASTER_KEY:-}"' \
      'bancochile_user: "${BANCOCHILE_USER:-}"' \
      'bancochile_password: "${BANCOCHILE_PASSWORD:-}"' \
      'santander_user: "${SANTANDER_USER:-}"' \
      'santander_password: "${SANTANDER_PASSWORD:-}"' \
      'CONF' \
      'Xvfb :99 -screen 0 1280x720x24 -ac &' \
      'export DISPLAY=:99' \
      'exec ./arasaka-server -config=/app/config.yml' \
      > /app/entrypoint.sh && chmod +x /app/entrypoint.sh
  EXPOSE 8080
  CMD ["/app/entrypoint.sh"]