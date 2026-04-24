FROM golang:1.26-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
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
EXPOSE 8080
# Start Xvfb on :99 before the server so fintself can run in headed mode
# (Auth0 blocks headless Chrome).
CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x720x24 -ac & DISPLAY=:99 ./arasaka-server -config=/app/config.yml"]
