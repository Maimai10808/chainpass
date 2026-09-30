#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${INFRA_DIR}/docker-compose.prod.yml"
ENV_FILE="${CHAINPASS_ENV_FILE:-${INFRA_DIR}/.env.production}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Production environment file not found: ${ENV_FILE}" >&2
  echo "Copy infra/.env.production.example and provide runtime secrets first." >&2
  exit 1
fi

compose() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

public_url="$(sed -n 's/^PUBLIC_URL=//p' "${ENV_FILE}" | tail -n 1)"
if [[ -z "${public_url}" ]]; then
  echo "PUBLIC_URL is required in ${ENV_FILE}" >&2
  exit 1
fi

compose config --quiet
compose build api migrate web nginx
compose up -d --wait postgres
# The API dependency graph runs the one-shot migration service and waits for a
# successful exit before starting the application containers.
compose up -d --wait api web
# Recreate Nginx after application images so its upstream DNS is resolved to
# the current Web/API containers even when those containers were replaced.
compose up -d --no-deps --force-recreate --wait nginx

curl --fail --silent --show-error "${public_url%/}/api/health" >/dev/null
curl --fail --silent --show-error "${public_url%/}/" >/dev/null

echo "ChainPass is healthy at ${public_url%/}"
