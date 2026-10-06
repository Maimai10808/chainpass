# ChainPass Single-Server Deployment

This guide records the Huawei Cloud teaching-server deployment verified on
2026-10-06. Images are built on Mac/CI for `linux/amd64`, verified locally,
transferred with SHA256 checksums, and loaded on the server. The server only
runs prebuilt images: **never run `docker build` or `docker compose build` there.**

```text
Internet :80
   |
   v
System Nginx
   |
   v
127.0.0.1:18081 -> ChainPass Docker Nginx
                    |-- /        -> Next.js Web :3000
                    `-- /api/*   -> NestJS API :3001
                                          |
                                          v
                                   PostgreSQL :5432
```

Web, API, and PostgreSQL have no host-port mappings. Mobile is not deployed
by this stack; it consumes the public API. The current public origin is
`http://124.71.227.47`; domain and HTTPS setup are a separate task.

## Prerequisites

- Mac/CI with Docker Buildx and enough resources to build and test `linux/amd64`
  images; the Mac uses emulation when testing these images on Apple Silicon
- Linux `amd64` runtime host with Docker Engine and Compose supporting
  `--wait`, health dependencies, and one-shot migrations
- enough disk on both hosts for images, the transfer archive, and PostgreSQL
- SSH access and public TCP `80`; no other application or database port is public
- an Ethereum Sepolia RPC reachable from the server and a funded issuer key
- a domain with DNS pointed to the host before the later HTTPS step

Run the command examples in Bash and replace the quoted placeholders first.

The teaching host is Huawei Cloud ECS, Ubuntu 24.04, `124.71.227.47`. Its
Compose project is `chainpass`. Do not alter `pawlice-report` (`:8080`),
`flow-lab` (`:10010`), existing Swarm services, or `/home/fwb`.

## Release layout

The server does not need a source checkout or build toolchain:

```text
/home/chainpass/
├── .env.production                 # runtime secrets, mode 600, never in Git
└── releases/
    └── <IMAGE_TAG>/
        ├── docker-compose.prod.yml
        ├── teaching-server.conf
        ├── deploy.sh               # optional deployment helper, no build steps
        ├── SHA256SUMS
        └── chainpass-images-<IMAGE_TAG>.tar.gz
```

The verified release is `/home/chainpass/releases/20261006-f07ef28`. Keep old
release files and image tags for rollback; do not replace another project's files.

## Environment variables

Use `infra/.env.production.example` as a template for the ignored local
`infra/.env.production.local` and server `/home/chainpass/.env.production`.
Preserve existing environment files instead of overwriting them. Configure them
privately and set file permissions to `600`; do not print, commit, or include
them in the image archive. Replace every secret placeholder. Required groups:

- release and origin: `IMAGE_TAG`, `PUBLIC_URL`, `HTTP_PORT` (or
  `CHAINPASS_HTTP_PORT`), `CHAINPASS_BIND_ADDRESS`
- PostgreSQL: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`
- auth and QR: `BETTER_AUTH_SECRET`, `QR_VERIFICATION_SECRET`
- Ethereum Sepolia: `CHAIN_ID`, `CHAIN_RPC_URL`, `CHAINPASS_CONTRACT_ADDRESS`
- API-only signer: `DEPLOYER_PRIVATE_KEY`
- browser wallet configuration: `NEXT_PUBLIC_REOWN_PROJECT_ID`

For the teaching server, use these public, non-secret values:

```text
IMAGE_TAG=20261006-f07ef28
PUBLIC_URL=http://124.71.227.47
CHAINPASS_BIND_ADDRESS=127.0.0.1
CHAINPASS_HTTP_PORT=18081
CHAIN_ID=11155111
CHAINPASS_CONTRACT_ADDRESS=0xbA3e9bCbe448E928c5e71f4bE6415E7e0e3E5ABb
```

`DATABASE_URL` uses `postgres` as its hostname. API `BETTER_AUTH_URL` and
`WEB_ORIGIN` are set from `PUBLIC_URL` by Compose. Local verification keeps the
same final public origin for build/runtime configuration, but overrides the
Docker listener to `127.0.0.1:8080` and the smoke-test URL to that local listener.

`NEXT_PUBLIC_*` values are embedded during the Web image build. Changing only
the server environment cannot change them: rebuild the Web image on Mac/CI
with a new tag. Issuer, auth, and QR secrets are API runtime-only; database
credentials are limited to the services that need them. No server secret is
ever a build argument.

## Production image build — Mac/CI only

Run from the local repository root, never from the teaching server. Pick a
unique release tag for each new build; do not overwrite the verified release's
images. Build all four application images for `linux/amd64` and include the
same-architecture PostgreSQL image in the transfer. Only public values go to
the Web builder:

```bash
set -euo pipefail
export IMAGE_TAG="<new-release-tag>"
export PUBLIC_URL=http://124.71.227.47
export CHAIN_ID=11155111
export CHAINPASS_CONTRACT_ADDRESS=0xbA3e9bCbe448E928c5e71f4bE6415E7e0e3E5ABb
export NEXT_PUBLIC_REOWN_PROJECT_ID="<your-public-project-id>"

docker buildx build --platform linux/amd64 --load \
  -f apps/api/Dockerfile --target runner -t "chainpass-api:${IMAGE_TAG}" .
docker buildx build --platform linux/amd64 --load \
  -f apps/api/Dockerfile --target migrate -t "chainpass-api-migrate:${IMAGE_TAG}" .
docker buildx build --platform linux/amd64 --load \
  -f apps/web/Dockerfile --target runner -t "chainpass-web:${IMAGE_TAG}" \
  --build-arg NEXT_PUBLIC_API_URL="${PUBLIC_URL}/api" \
  --build-arg NEXT_PUBLIC_AUTH_URL="${PUBLIC_URL}" \
  --build-arg NEXT_PUBLIC_APP_URL="${PUBLIC_URL}" \
  --build-arg NEXT_PUBLIC_CHAIN_ID="${CHAIN_ID}" \
  --build-arg NEXT_PUBLIC_CHAINPASS_CONTRACT_ADDRESS="${CHAINPASS_CONTRACT_ADDRESS}" \
  --build-arg NEXT_PUBLIC_REOWN_PROJECT_ID="${NEXT_PUBLIC_REOWN_PROJECT_ID}" .
docker buildx build --platform linux/amd64 --load \
  -f infra/nginx/Dockerfile -t "chainpass-nginx:${IMAGE_TAG}" infra/nginx
docker pull --platform linux/amd64 postgres:17-alpine

docker image inspect --format '{{.RepoTags}} {{.Os}}/{{.Architecture}}' \
  "chainpass-api:${IMAGE_TAG}" "chainpass-api-migrate:${IMAGE_TAG}" \
  "chainpass-web:${IMAGE_TAG}" "chainpass-nginx:${IMAGE_TAG}" postgres:17-alpine
```

Confirm each image is `linux/amd64`. Build definitions in Compose remain for
local/CI use only; the server must not invoke them.

## Local verification before transfer

Use the existing safe local environment file without printing its contents.
The helper checks that all images are already loaded, then starts PostgreSQL,
runs the one-shot migration, and waits for API, Web, and Docker Nginx in order:

```bash
docker compose -p chainpass-local \
  --env-file infra/.env.production.local \
  -f infra/docker-compose.prod.yml config --quiet

DOCKER_DEFAULT_PLATFORM=linux/amd64 \
CHAINPASS_COMPOSE_PROJECT=chainpass-local \
CHAINPASS_ENV_FILE="$PWD/infra/.env.production.local" \
CHAINPASS_BIND_ADDRESS=127.0.0.1 CHAINPASS_HTTP_PORT=8080 \
CHAINPASS_SMOKE_URL=http://127.0.0.1:8080 \
  bash infra/scripts/deploy.sh

docker compose -p chainpass-local --env-file infra/.env.production.local \
  -f infra/docker-compose.prod.yml ps
curl --fail http://127.0.0.1:8080/healthz
curl --fail http://127.0.0.1:8080/api/health
curl --fail --silent --output /dev/null --write-out '%{http_code}\n' \
  http://127.0.0.1:8080/
```

Expected: PostgreSQL, API, Web, and Nginx healthy; migration exited successfully;
`/api/health` reports `{"status":"ok","database":"connected"}` and `/` returns
HTTP `200`. Every `up` uses `--no-build`; `migrate` is a removed one-shot job,
not a permanently running container. Stop this local test without deleting
its volume:

```bash
CHAINPASS_BIND_ADDRESS=127.0.0.1 CHAINPASS_HTTP_PORT=8080 \
  docker compose -p chainpass-local --env-file infra/.env.production.local \
  -f infra/docker-compose.prod.yml down
```

## Image transfer — standard deployment path

This is the teaching server's default release procedure, not a Docker Hub
fallback. Run the following on Mac/CI after local verification. The archive
contains images only; release configuration files contain no runtime secrets.

```bash
set -euo pipefail
release_dir="$(mktemp -d)"
archive="chainpass-images-${IMAGE_TAG}.tar.gz"
docker save "chainpass-api:${IMAGE_TAG}" "chainpass-api-migrate:${IMAGE_TAG}" \
  "chainpass-web:${IMAGE_TAG}" "chainpass-nginx:${IMAGE_TAG}" postgres:17-alpine \
  | gzip > "${release_dir}/${archive}"
cp infra/docker-compose.prod.yml infra/nginx/teaching-server.conf \
  infra/scripts/deploy.sh "${release_dir}/"
(cd "${release_dir}" && shasum -a 256 "${archive}" docker-compose.prod.yml \
  teaching-server.conf deploy.sh > SHA256SUMS)

ssh root@124.71.227.47 "mkdir -p /home/chainpass/releases/${IMAGE_TAG}"
scp "${release_dir}/${archive}" "${release_dir}/SHA256SUMS" \
  "${release_dir}/docker-compose.prod.yml" "${release_dir}/teaching-server.conf" \
  "${release_dir}/deploy.sh" \
  "root@124.71.227.47:/home/chainpass/releases/${IMAGE_TAG}/"
```

On the server, replace the tag with the transferred release tag and verify
**before** loading. Do not continue on a checksum failure:

```bash
set -euo pipefail
export IMAGE_TAG="<new-release-tag>"
cd "/home/chainpass/releases/${IMAGE_TAG}"
sha256sum --check SHA256SUMS
gzip -dc "chainpass-images-${IMAGE_TAG}.tar.gz" | docker load
```

Keep `IMAGE_TAG` in `/home/chainpass/.env.production` aligned with the loaded
release (or use the exported tag consistently). Transfer runtime secrets
separately over SSH, with mode `600`; never add the environment file or a
Foundry keystore to the release or checksum manifest.

## Server deploy — no builds

First confirm the existing teaching services are healthy, the ChainPass port
is available or already belongs to this stack, and server secrets are present.
Do not stop another project or change host swap, Docker, or Swarm settings.

From `/home/chainpass/releases/<IMAGE_TAG>`, use the copied helper:

```bash
CHAINPASS_COMPOSE_PROJECT=chainpass \
CHAINPASS_COMPOSE_FILE="$PWD/docker-compose.prod.yml" \
CHAINPASS_ENV_FILE=/home/chainpass/.env.production \
CHAINPASS_SMOKE_URL=http://127.0.0.1:18081 \
  bash ./deploy.sh
```

Alternatively, run the same ordered sequence manually after `docker load`:

```bash
set -euo pipefail
compose() {
  docker compose -p chainpass --env-file /home/chainpass/.env.production \
    -f "$PWD/docker-compose.prod.yml" "$@"
}
compose config --quiet
compose config --images | while IFS= read -r image; do
  docker image inspect "${image}" >/dev/null
done
compose up -d --no-build --wait postgres
compose run --rm --no-deps --pull never migrate
compose up -d --no-build --no-deps --wait api
compose up -d --no-build --no-deps --wait web
compose up -d --no-build --no-deps --force-recreate --wait nginx
curl --fail --silent --show-error http://127.0.0.1:18081/api/health
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:18081/
```

`deploy.sh` validates configuration and preflights all required local image
tags before starting anything. Every `up` disables builds; Compose `run`
has no `--no-build` option, so the loaded migration image is required and
pulling is disabled. Production migrations use `prisma migrate deploy`, never
`migrate dev`. The helper never installs or changes system Nginx.

## System Nginx and shared-host isolation

The standalone system site is tracked in
`infra/nginx/teaching-server.conf`. Install it only after loopback checks pass:

```bash
set -euo pipefail
curl --fail http://127.0.0.1:18081/healthz
curl --fail http://127.0.0.1:18081/api/health
curl --fail http://127.0.0.1:18081/api/events

# First installation only, from the release directory; do not overwrite a site.
test ! -e /etc/nginx/sites-available/chainpass
test ! -L /etc/nginx/sites-available/chainpass
test ! -e /etc/nginx/sites-enabled/chainpass
test ! -L /etc/nginx/sites-enabled/chainpass
install -m 644 teaching-server.conf /etc/nginx/sites-available/chainpass
ln -s /etc/nginx/sites-available/chainpass /etc/nginx/sites-enabled/chainpass
nginx -t && systemctl reload nginx
```

For an already installed ChainPass site, review any change separately rather
than rerunning the first-install commands. Never edit another project's site.
Keep `/etc/nginx/sites-enabled/flow-lab`, `pawlice-report`, all existing Swarm
services and `/home/fwb` unchanged. Compare `:8080` and `:10010` responses
before and after the reload:

```bash
curl -I http://127.0.0.1:8080
curl -I http://127.0.0.1:10010
curl --fail http://124.71.227.47/api/health
curl --fail --silent --output /dev/null --write-out '%{http_code}\n' \
  http://124.71.227.47/
```

Both proxy layers preserve forwarding headers and allow 180 seconds for
Application Mint receipts. The Docker listener is **loopback-only**.

Only TCP `80` needs to be added to Huawei Cloud's `Sys-WebServer` security
group for this HTTP stage. Do not expose `18081`, `3000`, `3001` or `5432`.
DNS and HTTPS are a separate deployment step; camera-based QR scanning is
pending HTTPS, while verification-token and Check-in APIs can be tested over
the current HTTP origin.

## Health and smoke checks

```bash
compose ps
curl --fail http://127.0.0.1:18081/healthz
curl --fail http://124.71.227.47/api/health
curl --fail http://124.71.227.47/api/events
```

Expected API health response:

```json
{ "status": "ok", "database": "connected" }
```

After infrastructure health passes, verify through the public origin:

1. create or sign in to a Better Auth account;
2. confirm the session cookie persists on the same origin;
3. load the published Event list through `/api/events`;
4. confirm the API can read the deployed Ethereum Sepolia contract;
5. if the environment is approved for a demo Mint, use the normal application
   flow instead of calling the contract directly.

## Routing and Better Auth

Nginx preserves `/api/auth/*` because Better Auth owns that full path. For
business routes, it strips the public `/api/` prefix before proxying to NestJS.
For example, public `/api/events` reaches internal `/events`. Keep both proxy
paths unchanged; changing the trailing slash would change auth routing.

The API trusts one reverse-proxy hop and uses `X-Forwarded-Proto` for secure
origin handling. Keep these values aligned:

```text
PUBLIC_URL=http://124.71.227.47
BETTER_AUTH_URL=$PUBLIC_URL
WEB_ORIGIN=$PUBLIC_URL
NEXT_PUBLIC_AUTH_URL=$PUBLIC_URL
NEXT_PUBLIC_API_URL=$PUBLIC_URL/api
NEXT_PUBLIC_APP_URL=$PUBLIC_URL
```

Do not disable Better Auth origin or CSRF checks. Camera access for the Web QR
scanner requires HTTPS on normal browsers.

## Domain and HTTPS

The Docker site uses `server_name _`; the teaching-server system site listens
on `:80` with `server_name 124.71.227.47`. The verified deployment is HTTP only.
No TLS certificates or HTTPS success are implied by this guide.

After DNS resolves to the server, terminate TLS either in this Nginx service or
in an existing trusted edge proxy. If Certbot modifies a live configuration,
retain a reviewed, reproducible copy and mount certificates read-only. Set
`PUBLIC_URL` to the final `https://` origin, rebuild the Web image on Mac/CI,
and transfer/load a new release. Do not build on the server.

## Logs and lifecycle

```bash
# Run from the chosen release directory, using the compose() function above.
# Follow application logs
compose logs -f nginx web api

# Restart one service
compose restart api

# Stop containers without deleting the database volume
compose down
```

Never add `-v` to the shutdown command during a normal deployment.

## PostgreSQL backup

A Docker volume is persistence, not a backup. Create an external dump before
schema changes or important demos:

```bash
compose exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "chainpass-$(date +%Y%m%d-%H%M%S).dump"
```

Store backups outside the Docker host and test restoration in an isolated
database. Do not commit dumps because they contain user and authentication
data.

## Rollback

For this manual single-server deployment:

1. retain the previous release directory, image tags, and required public-origin
   configuration; do not delete its loaded images;
2. back up PostgreSQL before applying a forward-only migration;
3. select the known-good release directory and matching `IMAGE_TAG` without
   changing the Compose project name (`chainpass`) or database volume;
4. if its images are missing, verify its archive and `docker load` it again;
5. confirm the old application is compatible with the current database schema,
   start its prebuilt images with `--no-build`, and repeat health checks.

Application rollback does not automatically reverse Prisma migrations. Use a
forward repair migration unless a reviewed database restore is explicitly
required.

## Security checklist

- only Nginx publishes a host port;
- on the teaching host, Docker Nginx binds only `127.0.0.1:18081`; system Nginx
  is the sole public `:80` entrypoint;
- PostgreSQL, API, and Web are not public; the database network is internal;
- `/home/chainpass/.env.production` is mode `600` and outside the release;
- the local production environment file is ignored and never transferred in
  the image archive or committed;
- issuer private key, Better Auth secret, QR secret, database password, and RPC
  credentials exist only in server runtime configuration;
- no secret is passed as a Docker build argument or stored in an image layer;
- Web, API, and migration images run their application process as non-root users;
- HTTPS is enabled before camera-based QR verification is accepted as ready.
