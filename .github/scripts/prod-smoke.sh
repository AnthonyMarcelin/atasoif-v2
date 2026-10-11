#!/usr/bin/env bash
# Public HTTP smoke after a production deploy.
# Exact HTTP 200 required (3xx/4xx/5xx fail). No redirect follow.
# Only checks targets this release touched (DEPLOY_API / DEPLOY_SITE / DEPLOY_OPS).
set -euo pipefail
set +x

retries="${PROD_SMOKE_RETRIES:-18}"
delay_s="${PROD_SMOKE_DELAY:-5}"

deploy_api="${DEPLOY_API:-false}"
deploy_site="${DEPLOY_SITE:-false}"
deploy_ops="${DEPLOY_OPS:-false}"

if [[ "$deploy_api" != true && "$deploy_site" != true && "$deploy_ops" != true ]]; then
  deploy_api=true
  deploy_site=true
  deploy_ops=true
fi

root="$(cd "$(dirname "$0")/../.." && pwd)"
routes_dir="${root}/.github/smoke-routes"

check_url() {
  local name="$1"
  local target="$2"
  local code
  # --max-redirs 0: a 3xx is a failure (exact 200 required).
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 --max-redirs 0 "$target" || echo 000)"
  if [[ "$code" == "200" ]]; then
    echo "Smoke ${name} ${code}"
    return 0
  fi
  echo "Smoke ${name} ${code} (want 200 exact) ${target}" >&2
  return 1
}

smoke_routes_file() {
  local name="$1"
  local base_url="$2"
  local file="$3"
  local path
  local ok=0

  if [[ ! -f "$file" ]]; then
    echo "Missing smoke routes file: ${file}" >&2
    return 1
  fi

  while IFS= read -r path || [[ -n "$path" ]]; do
    [[ -z "$path" || "$path" =~ ^# ]] && continue
    if [[ "$path" =~ ^https?:// ]]; then
      check_url "${name}" "$path" || ok=1
    else
      check_url "${name}" "${base_url%/}${path}" || ok=1
    fi
  done <"$file"

  return "$ok"
}

smoke_once() {
  local ok=0
  if [[ "$deploy_api" == true ]]; then
    smoke_routes_file api "${PROD_API_URL:-https://api.atasoif.fr}" "${routes_dir}/api.txt" || ok=1
  fi
  if [[ "$deploy_site" == true ]]; then
    smoke_routes_file site "${PROD_SITE_URL:-https://atasoif.fr}" "${routes_dir}/site.txt" || ok=1
  fi
  if [[ "$deploy_ops" == true ]]; then
    smoke_routes_file ops "${PROD_OPS_URL:-https://ops.atasoif.fr}" "${routes_dir}/ops.txt" || ok=1
  fi
  return "$ok"
}

echo "Smoke targets api=${deploy_api} site=${deploy_site} ops=${deploy_ops}"

attempt=1
while ((attempt <= retries)); do
  if smoke_once; then
    echo "Production smoke passed"
    exit 0
  fi
  echo "Smoke attempt ${attempt}/${retries} failed; retrying in ${delay_s}s"
  sleep "$delay_s"
  attempt=$((attempt + 1))
done

echo "Production smoke failed" >&2
exit 1
