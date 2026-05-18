# ── Frontend build ────────────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# ── Backend build ─────────────────────────────────────────────────────────
FROM golang:1.26-alpine AS backend-builder
WORKDIR /build
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o arasaka-server ./cmd/server

# ── Runtime ───────────────────────────────────────────────────────────────
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates tzdata nginx python3 python3-pip xvfb \
    && pip3 install fintself --break-system-packages \
    && python3 -m playwright install chromium --with-deps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=backend-builder /build/arasaka-server .
COPY --from=backend-builder /build/migrations ./migrations
COPY --from=frontend-builder /app/dist /var/www/html

# nginx: serve frontend + proxy /api/ to Go backend on localhost:8080
RUN rm -f /etc/nginx/sites-enabled/default && \
    printf '%s\n' \
    'server {' \
    '    listen 80;' \
    '    root /var/www/html;' \
    '    index index.html;' \
    '    location /api/ {' \
    '        proxy_pass http://127.0.0.1:8080;' \
    '        proxy_set_header Host $host;' \
    '        proxy_set_header X-Real-IP $remote_addr;' \
    '    }' \
    '    location / {' \
    '        try_files $uri $uri/ /index.html;' \
    '    }' \
    '}' \
    > /etc/nginx/conf.d/default.conf

RUN printf '%s\n' \
    '#!/bin/sh' \
    'set -e' \
    'cat > /app/config.yml <<CONF' \
    'database_url: "$DATABASE_URL"' \
    'server_port: "8080"' \
    'jwt_secret: "$JWT_SECRET"' \
    'master_key: "${MASTER_KEY:-}"' \
    'bancochile_user: "${BANCOCHILE_USER:-}"' \
    'bancochile_password: "${BANCOCHILE_PASSWORD:-}"' \
    'santander_user: "${SANTANDER_USER:-}"' \
    'santander_password: "${SANTANDER_PASSWORD:-}"' \
    'CONF' \
    'Xvfb :99 -screen 0 1280x720x24 -ac &' \
    'export DISPLAY=:99' \
    './arasaka-server -config=/app/config.yml &' \
    'exec nginx -g "daemon off;"' \
    > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

EXPOSE 80
CMD ["/app/entrypoint.sh"]
