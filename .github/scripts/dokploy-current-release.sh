#!/usr/bin/env bash
# Print the images currently configured on Dokploy (not secrets).
# Output: API_IMAGE / SITE_IMAGE / OPS_IMAGE as KEY=value lines.
set -euo pipefail
set +x

: "${DOKPLOY_URL:?Set DOKPLOY_URL}"
: "${DOKPLOY_API_TOKEN:?Set DOKPLOY_API_TOKEN}"

url="${DOKPLOY_URL%/}"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

extract_docker_image() {
  python3 - "$1" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)
print((data.get("dockerImage") or "").strip(), end="")
PY
}

fetch_application_image() {
  local application_id="$1"
  local label="$2"
  local code
  code="$(curl -sS -o "$tmp" -w '%{http_code}' \
    -H 'accept: application/json' \
    -H "x-api-key: ${DOKPLOY_API_TOKEN}" \
    "${url}/api/application.one?applicationId=${application_id}")"
  if [[ "$code" == "200" ]]; then
    extract_docker_image "$tmp"
  else
    echo "Dokploy application.one (${label}) failed with HTTP ${code}" >&2
    exit 1
  fi
}

api_image=
site_image=
ops_image=

if [[ -n "${DOKPLOY_API_APPLICATION_ID:-}" ]]; then
  api_image="$(fetch_application_image "$DOKPLOY_API_APPLICATION_ID" api)"
fi

if [[ -n "${DOKPLOY_SITE_APPLICATION_ID:-}" ]]; then
  site_image="$(fetch_application_image "$DOKPLOY_SITE_APPLICATION_ID" site)"
fi

if [[ -n "${DOKPLOY_OPS_APPLICATION_ID:-}" ]]; then
  ops_image="$(fetch_application_image "$DOKPLOY_OPS_APPLICATION_ID" ops)"
fi

printf 'API_IMAGE=%s\n' "$api_image"
printf 'SITE_IMAGE=%s\n' "$site_image"
printf 'OPS_IMAGE=%s\n' "$ops_image"
