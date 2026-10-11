#!/usr/bin/env bash
# Deploy a SHA to Dokploy Applications, wait, smoke, roll back failed services only.
# Images only — never Ace migrations, SQL, or wipe.
# Never prints Dokploy env or the API token.
set -euo pipefail
set +x

: "${DOKPLOY_URL:?Set DOKPLOY_URL}"
: "${DOKPLOY_API_TOKEN:?Set DOKPLOY_API_TOKEN}"
: "${IMAGE_TAG:?Set IMAGE_TAG to the git SHA}"
: "${IMAGE_PREFIX:?Set IMAGE_PREFIX}"

deploy_api_wanted="${DEPLOY_API:-false}"
deploy_site_wanted="${DEPLOY_SITE:-false}"
deploy_ops_wanted="${DEPLOY_OPS:-false}"

root="$(cd "$(dirname "$0")/../.." && pwd)"
scripts="${root}/.github/scripts"
new_sha="$IMAGE_TAG"

since_stamp() {
  date -u -d '-30 seconds' +%Y-%m-%dT%H:%M:%SZ
}

want_api() {
  [[ "$deploy_api_wanted" == true && -n "${DOKPLOY_API_APPLICATION_ID:-}" ]]
}

want_site() {
  [[ "$deploy_site_wanted" == true && -n "${DOKPLOY_SITE_APPLICATION_ID:-}" ]]
}

want_ops() {
  [[ "$deploy_ops_wanted" == true && -n "${DOKPLOY_OPS_APPLICATION_ID:-}" ]]
}

deploy_app() {
  local application_id="$1"
  local image="$2"
  local since
  since="$(since_stamp)"
  DOKPLOY_APPLICATION_ID="$application_id" DOCKER_IMAGE="$image" \
    bash "${scripts}/dokploy-deploy-application-image.sh"
  WAIT_AFTER="$since" bash "${scripts}/dokploy-wait-deploy.sh" application "$application_id"
}

smoke_service() {
  local service="$1"
  case "$service" in
    api)
      DEPLOY_API=true DEPLOY_SITE=false DEPLOY_OPS=false bash "${scripts}/prod-smoke.sh"
      ;;
    site)
      DEPLOY_API=false DEPLOY_SITE=true DEPLOY_OPS=false bash "${scripts}/prod-smoke.sh"
      ;;
    ops)
      DEPLOY_API=false DEPLOY_SITE=false DEPLOY_OPS=true bash "${scripts}/prod-smoke.sh"
      ;;
    *)
      echo "Unknown smoke service: ${service}" >&2
      return 1
      ;;
  esac
}

release_one() {
  local name="$1"
  local application_id="$2"
  local new_image="$3"
  local prev_image="$4"
  local failed=0

  echo "Deploying ${name} → ${new_image}"
  if ! deploy_app "$application_id" "$new_image"; then
    failed=1
  elif ! smoke_service "$name"; then
    failed=1
  fi

  if ((failed == 0)); then
    echo "${name} deploy + smoke OK"
    return 0
  fi

  if [[ -z "$prev_image" || "$prev_image" == "$new_image" ]]; then
    echo "${name} failed and there is no previous image to restore." >&2
    return 1
  fi

  echo "${name} failed; restoring ${prev_image}"
  if deploy_app "$application_id" "$prev_image" && smoke_service "$name"; then
    echo "${name} rolled back; GitHub job stays red"
    return 1
  fi

  echo "${name} rollback also failed; production may be unhealthy" >&2
  return 1
}

PREV_API_IMAGE=
PREV_SITE_IMAGE=
PREV_OPS_IMAGE=
while IFS= read -r line; do
  case "$line" in
    API_IMAGE=*) PREV_API_IMAGE="${line#API_IMAGE=}" ;;
    SITE_IMAGE=*) PREV_SITE_IMAGE="${line#SITE_IMAGE=}" ;;
    OPS_IMAGE=*) PREV_OPS_IMAGE="${line#OPS_IMAGE=}" ;;
  esac
done < <(bash "${scripts}/dokploy-current-release.sh")

echo "Previous api image: ${PREV_API_IMAGE:-none}"
echo "Previous site image: ${PREV_SITE_IMAGE:-none}"
echo "Previous ops image: ${PREV_OPS_IMAGE:-none}"
echo "Deploying SHA ${new_sha} (api=${deploy_api_wanted} site=${deploy_site_wanted} ops=${deploy_ops_wanted})"

if ! want_api && ! want_site && ! want_ops; then
  echo "No Dokploy target for this push (missing application IDs for changed services)."
  exit 0
fi

overall_failed=0

if want_api; then
  release_one api "$DOKPLOY_API_APPLICATION_ID" \
    "${IMAGE_PREFIX}/atasoif-api:${new_sha}" \
    "${PREV_API_IMAGE}" || overall_failed=1
fi

if want_site; then
  release_one site "$DOKPLOY_SITE_APPLICATION_ID" \
    "${IMAGE_PREFIX}/atasoif-site:${new_sha}" \
    "${PREV_SITE_IMAGE}" || overall_failed=1
fi

if want_ops; then
  release_one ops "$DOKPLOY_OPS_APPLICATION_ID" \
    "${IMAGE_PREFIX}/atasoif-ops:${new_sha}" \
    "${PREV_OPS_IMAGE}" || overall_failed=1
fi

if ((overall_failed == 0)); then
  echo "Deployed ${new_sha} (api=${deploy_api_wanted} site=${deploy_site_wanted} ops=${deploy_ops_wanted})"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    echo "Deployed \`${new_sha}\` (api=${deploy_api_wanted} site=${deploy_site_wanted} ops=${deploy_ops_wanted})." >>"$GITHUB_STEP_SUMMARY"
  fi
  exit 0
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo "Deploy of \`${new_sha}\` failed for at least one service; per-service rollback attempted." >>"$GITHUB_STEP_SUMMARY"
fi
exit 1
