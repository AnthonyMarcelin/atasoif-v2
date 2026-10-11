#!/usr/bin/env bash
# Poll Dokploy until the newest deployment created after WAIT_AFTER is terminal.
# Usage: dokploy-wait-deploy.sh application <id>
# Never prints logs (they can contain env).
set -euo pipefail
set +x

: "${DOKPLOY_URL:?Set DOKPLOY_URL}"
: "${DOKPLOY_API_TOKEN:?Set DOKPLOY_API_TOKEN}"
: "${WAIT_AFTER:?Set WAIT_AFTER to an ISO-8601 UTC timestamp}"

type="${1:?application}"
id="${2:?service id}"
timeout_s="${DOKPLOY_WAIT_TIMEOUT:-600}"
url="${DOKPLOY_URL%/}"
body="$(mktemp)"
trap 'rm -f "$body"' EXIT

case "$type" in
  application) query="id=${id}&type=application" ;;
  *)
    echo "Unknown Dokploy wait type: ${type}" >&2
    exit 1
    ;;
esac

deadline=$((SECONDS + timeout_s))
echo "Waiting for ${type} deploy (timeout ${timeout_s}s)"

while ((SECONDS < deadline)); do
  code="$(curl -sS -o "$body" -w '%{http_code}' \
    -H 'accept: application/json' \
    -H "x-api-key: ${DOKPLOY_API_TOKEN}" \
    "${url}/api/deployment.allByType?${query}")"
  if [[ "$code" != "200" ]]; then
    echo "Dokploy deployment.allByType failed with HTTP ${code}" >&2
    exit 1
  fi

  status="$(
    python3 - "$body" "$WAIT_AFTER" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle)
since = sys.argv[2]
if isinstance(payload, list):
    rows = payload
elif isinstance(payload, dict):
    rows = []
    for key in ("data", "deployments", "result"):
        value = payload.get(key)
        if isinstance(value, list):
            rows = value
            break
else:
    rows = []

candidates = []
for row in rows:
    if not isinstance(row, dict):
        continue
    stamp = row.get("createdAt") or row.get("startedAt") or ""
    if stamp >= since:
        candidates.append(row)
if not candidates:
    print("pending")
    raise SystemExit(0)
candidates.sort(key=lambda row: row.get("createdAt") or "", reverse=True)
print(candidates[0].get("status") or "unknown")
PY
  )"

  case "$status" in
    done)
      echo "Dokploy ${type} deploy done"
      exit 0
      ;;
    error | cancelled)
      echo "Dokploy ${type} deploy ended with status ${status}" >&2
      exit 1
      ;;
    running | pending | unknown)
      sleep 8
      ;;
    *)
      echo "Dokploy ${type} deploy status ${status}" >&2
      sleep 8
      ;;
  esac
done

echo "Timed out waiting for Dokploy ${type} deploy" >&2
exit 1
