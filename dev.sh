#!/usr/bin/env bash
set -e

cleanup() {
    kill "$BE_PID" "$FE_PID" 2>/dev/null
    wait "$BE_PID" "$FE_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "[backend] starting..."
(cd backend && make run) &
BE_PID=$!

echo "[frontend] starting..."
(cd frontend && npm run dev) &
FE_PID=$!

wait
