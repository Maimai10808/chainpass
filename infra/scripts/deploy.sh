#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${CHAINPASS_COMPOSE_FILE:-${INFRA_DIR}/docker-compose.prod.yml}"
ENV_FILE="${CHAINPASS_ENV_FILE:-${INFRA_DIR}/.env.production}"
PROJECT_NAME="${CHAINPASS_COMPOSE_PROJECT:-chainpass-prod}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Production environment file not found: ${ENV_FILE}" >&2
  echo "Copy infra/.env.production.example and provide runtime secrets first." >&2
  exit 1
fi

compose() {
  docker compose -p "${PROJECT_NAME}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

public_url="$(sed -n 's/^PUBLIC_URL=//p' "${ENV_FILE}" | tail -n 1)"
if [[ -z "${public_url}" ]]; then
  echo "PUBLIC_URL is required in ${ENV_FILE}" >&2
  exit 1
fi
smoke_url="${CHAINPASS_SMOKE_URL:-${public_url}}"

compose config --quiet
# Images must be built on Mac/CI and loaded before deployment. In particular,
# Compose run has no --no-build flag, so reject missing migration images here.
required_images="$(compose config --images)"
while IFS= read -r image; do
  if ! docker image inspect "${image}" >/dev/null 2>&1; then
    echo "Required image is not loaded: ${image}. Run docker load before deploying." >&2
    exit 1
  fi
done <<< "${required_images}"

compose up -d --no-build --wait postgres
compose run --rm --no-deps --pull never migrate
compose up -d --no-build --no-deps --wait api
compose up -d --no-build --no-deps --wait web
# Recreate Nginx after application images so its upstream DNS is resolved to
# the current Web/API containers even when those containers were replaced.
compose up -d --no-build --no-deps --force-recreate --wait nginx

curl --fail --silent --show-error "${smoke_url%/}/api/health" >/dev/null
curl --fail --silent --show-error "${smoke_url%/}/" >/dev/null

echo "ChainPass health checks passed at ${smoke_url%/}"
echo "Configured public origin: ${public_url%/}"
