# ChainPass Single-Server Deployment

This guide deploys ChainPass on one Linux server with Docker Compose. Nginx is
the only public entrypoint; Web, API, and PostgreSQL remain on private Compose
networks.

```text
Internet
   |
   v
Nginx :80/:443
   |-- /        -> Next.js Web :3000
   `-- /api/*   -> NestJS API :3001
                         |
                         v
                  PostgreSQL :5432
```

Mobile is not deployed by this stack. It consumes the same public origin after
the server and TLS endpoint are ready.

## Prerequisites

- Linux host with Docker Engine and Docker Compose v2
- 2 GB RAM minimum; 4 GB or swap is recommended for the Next.js build
- enough disk for images and the PostgreSQL volume
- ports 80/443 available at the firewall
- a domain with DNS pointed to the host before enabling HTTPS
- an Ethereum Sepolia RPC and funded issuer key for application Mint

Clone the repository into the server's normal application directory, such as
`/opt/chainpass`. Do not copy a developer `.env` or Foundry keystore to the
repository.

## Environment variables

Create the ignored production environment file:

```bash
cp infra/.env.production.example infra/.env.production
chmod 600 infra/.env.production
```

Set every placeholder in `infra/.env.production`. The required groups are:

- public origin: `PUBLIC_URL`, `HTTP_PORT`
- PostgreSQL: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`
- auth and QR: `BETTER_AUTH_SECRET`, `QR_VERIFICATION_SECRET`
- Ethereum Sepolia: `CHAIN_ID`, `CHAIN_RPC_URL`, `CHAINPASS_CONTRACT_ADDRESS`
- API-only signer: `DEPLOYER_PRIVATE_KEY`
- browser wallet configuration: `NEXT_PUBLIC_REOWN_PROJECT_ID`

`DATABASE_URL` uses `postgres` as its hostname because that is the Compose
service name. `PUBLIC_URL` must be the browser-visible origin. For final HTTPS
deployment it should look like `https://your-domain.example`, without `/api`.

`NEXT_PUBLIC_*` values are embedded during the Web image build. Rebuild the Web
image after changing them. Server secrets are injected only into the API at
runtime and must never be passed as Docker build arguments.

## Validate configuration

```bash
docker compose \
  --env-file infra/.env.production \
  -f infra/docker-compose.prod.yml \
  config --quiet
```

The production Compose file publishes only Nginx. PostgreSQL, API, and Web use
`expose` and cannot be reached directly through host ports.

## Build and start

The deployment helper validates the Compose model, builds Nginx, Web and API, waits
for PostgreSQL, applies Prisma migrations, starts the applications, then checks
the public health endpoints:

```bash
CHAINPASS_ENV_FILE=infra/.env.production infra/scripts/deploy.sh
```

The same sequence can be run manually:

```bash
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml build api migrate web nginx
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml up -d --wait postgres
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml up -d --wait api web
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml up -d --no-deps --force-recreate --wait nginx
```

Production uses `prisma migrate deploy`; never run `prisma migrate dev` on the
server.

## Health and smoke checks

```bash
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml ps
curl --fail "$PUBLIC_URL/api/health"
curl --fail "$PUBLIC_URL/"
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
For example, public `/api/events` reaches internal `/events`.

The API trusts one reverse-proxy hop and uses `X-Forwarded-Proto` for secure
origin handling. Keep these values aligned:

```text
PUBLIC_URL=https://your-domain.example
BETTER_AUTH_URL=$PUBLIC_URL
WEB_ORIGIN=$PUBLIC_URL
NEXT_PUBLIC_AUTH_URL=$PUBLIC_URL
NEXT_PUBLIC_API_URL=$PUBLIC_URL/api
```

Do not disable Better Auth origin or CSRF checks. Camera access for the Web QR
scanner requires HTTPS on normal browsers.

## Domain and HTTPS

The tracked Nginx configuration is an HTTP baseline with `server_name _`. It
does not claim a domain or certificate that the repository cannot verify.

After DNS resolves to the server, terminate TLS either in this Nginx service or
in an existing trusted edge proxy. If Certbot modifies a live configuration,
retain a reviewed, reproducible copy and mount certificates read-only. Set
`PUBLIC_URL` to the final `https://` origin and rebuild the Web image.

## Logs and lifecycle

```bash
# Follow application logs
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml logs -f nginx web api

# Restart one service
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml restart api

# Stop containers without deleting the database volume
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml down
```

Never add `-v` to the shutdown command during a normal deployment.

## PostgreSQL backup

A Docker volume is persistence, not a backup. Create an external dump before
schema changes or important demos:

```bash
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "chainpass-$(date +%Y%m%d-%H%M%S).dump"
```

Store backups outside the Docker host and test restoration in an isolated
database. Do not commit dumps because they contain user and authentication
data.

## Rollback

For this manual single-server deployment:

1. retain the previously deployed Git commit or image tag;
2. back up PostgreSQL before applying a forward-only migration;
3. check out the known-good commit;
4. rebuild the `web` and `api` images with the previous tag;
5. start the stack and repeat health checks.

Application rollback does not automatically reverse Prisma migrations. Use a
forward repair migration unless a reviewed database restore is explicitly
required.

## Security checklist

- only Nginx publishes a host port;
- PostgreSQL and API are not public;
- `.env.production` is mode `600` and untracked;
- issuer private key, Better Auth secret, QR secret, database password, and RPC
  credentials exist only in server runtime configuration;
- no secret is passed as a Docker build argument or stored in an image layer;
- Web, API, and migration images run their application process as non-root users;
- HTTPS is enabled before camera-based QR verification is accepted as ready.
