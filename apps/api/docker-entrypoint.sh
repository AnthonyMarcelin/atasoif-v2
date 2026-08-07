#!/bin/sh
set -e

echo "[entrypoint] Running Lucid migrations…"
node ace migration:run --force

echo "[entrypoint] Starting Adonis server…"
exec node bin/server.js
