#!/usr/bin/env bash
# Decide which GHCR images / Dokploy Applications this push should touch.
# apps/web is Capacitor (stores) — never a prod GHCR target.
# Prints api= / site= / ops= into GITHUB_OUTPUT (or stdout).
set -euo pipefail

base="${1:-}"
head="${2:-HEAD}"

write_targets() {
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    {
      echo "api=$1"
      echo "site=$2"
      echo "ops=$3"
    } >>"$GITHUB_OUTPUT"
  else
    echo "api=$1"
    echo "site=$2"
    echo "ops=$3"
  fi
}

if [[ -z "$base" || "$base" =~ ^0+$ ]]; then
  echo "No base SHA; publishing api, site, and ops." >&2
  write_targets true true true
  exit 0
fi

if ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  echo "Base SHA not in this clone; publishing api, site, and ops." >&2
  write_targets true true true
  exit 0
fi

api=false
site=false
ops=false
force_all=false

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  case "$file" in
    bun.lock | package.json)
      force_all=true
      ;;
    Dockerfile | docker-compose.yml | docker-compose.prod.yml | docker-compose.dev.yml | .dockerignore)
      api=true
      ;;
    apps/api/* | packages/shared/*)
      api=true
      ;;
    apps/site/*)
      site=true
      ;;
    apps/ops/*)
      ops=true
      ;;
  esac
done < <(git diff --name-only "$base" "$head")

if [[ "$force_all" == true ]]; then
  echo "Shared monorepo files changed; publishing api, site, and ops." >&2
  write_targets true true true
  exit 0
fi

echo "Targets api=${api} site=${site} ops=${ops}" >&2
write_targets "$api" "$site" "$ops"
