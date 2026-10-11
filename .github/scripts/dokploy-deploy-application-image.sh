#!/usr/bin/env bash
# Point a Dokploy Docker Application at an image and deploy.
# Never print the API token.
set -euo pipefail
set +x

: "${DOKPLOY_URL:?Set DOKPLOY_URL}"
: "${DOKPLOY_API_TOKEN:?Set DOKPLOY_API_TOKEN}"
: "${DOKPLOY_APPLICATION_ID:?Set DOKPLOY_APPLICATION_ID}"
: "${DOCKER_IMAGE:?Set DOCKER_IMAGE to ghcr.io/.../<name>:<sha>}"

url="${DOKPLOY_URL%/}"
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

printf '{"applicationId":"%s","dockerImage":"%s"}\n' \
  "$DOKPLOY_APPLICATION_ID" "$DOCKER_IMAGE" >"$body_file"

code="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H "x-api-key: ${DOKPLOY_API_TOKEN}" \
  --data-binary "@${body_file}" \
  "${url}/api/application.update")"

if [[ "$code" != "200" ]]; then
  echo "Dokploy application.update failed with HTTP ${code}" >&2
  exit 1
fi

printf '{"applicationId":"%s"}\n' "$DOKPLOY_APPLICATION_ID" >"$body_file"

code="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H "x-api-key: ${DOKPLOY_API_TOKEN}" \
  --data-binary "@${body_file}" \
  "${url}/api/application.deploy")"

if [[ "$code" != "200" ]]; then
  echo "Dokploy application.deploy failed with HTTP ${code}" >&2
  exit 1
fi

echo "Dokploy application deploy requested"
