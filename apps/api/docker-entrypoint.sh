#!/bin/sh
set -e

# Lucid schema only — never run migrate:v1 here (one-shot ops after first boot).
# Opt-in migrations protect live prod data (v1 cohort). Set RUN_MIGRATIONS=1 to apply.
case "${RUN_MIGRATIONS:-0}" in
  1|true|TRUE|yes|YES)
    echo "[entrypoint] Running Lucid migrations (RUN_MIGRATIONS enabled)…"
    node ace migration:run --force
    ;;
  *)
    echo "[entrypoint] Skipping Lucid migrations (set RUN_MIGRATIONS=1 to apply pending schema)."
    ;;
esac

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

echo "[entrypoint] Starting Adonis server…"
exec node bin/server.js
