#!/bin/sh
set -e

# Lucid schema only — do not run migrate:v1 here (one-shot ops after first boot).
echo "[entrypoint] Running Lucid migrations…"
node ace migration:run --force

echo "[entrypoint] Starting Adonis server…"
exec node bin/server.js
