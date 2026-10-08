# ChainPass 部署指南 / Deployment Guide

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

本文件是部署配置与应急交付手册；整体流水线、历史生产证据与限制见[架构与部署](./ARCHITECTURE_AND_DEPLOYMENT.md#zh)，正常发布与回滚见[运维](./OPERATIONS.md#zh)。它不声明本轮已重新部署或复核生产。

### 默认路径

GitHub **Deploy Production** 是正常发布入口：main、精确 SHA 的 main push CI 成功、人工输入 DEPLOY。Runner 构建/校验 amd64、save/gzip/SHA256、SCP、load、备份、迁移、按序启动、健康、独立持久化 tag。

**服务器永远不执行项目 docker build/compose build**。Mac/CI 手工交付是经授权的应急路径，不是平时每次更新必做的工作。Production Compose 已有 build 定义仅供开发机/CI 使用。

### 配置与首次准备

模板为[infra/.env.production.example](../infra/.env.production.example)。实际服务器文件为 `/home/chainpass/.env.production`，权限为 `600`，放在 release 目录之外。不要提交、打印、归档真实 env。

| 名称                                                        | 用途                                        |
| ----------------------------------------------------------- | ------------------------------------------- |
| PUBLIC_URL                                                  | 最终公网页面/Auth origin，与 Web build 一致 |
| IMAGE_TAG                                                   | 已验收 release，与运行镜像对应              |
| POSTGRES_USER、POSTGRES_DB、POSTGRES_PASSWORD、DATABASE_URL | DB 配置，内部 host 为 postgres              |
| BETTER_AUTH_SECRET、QR_VERIFICATION_SECRET                  | API 运行时独立密钥                          |
| CHAIN_ID、CHAINPASS_CONTRACT_ADDRESS                        | Sepolia，chain ID 11155111、公开部署合约    |
| CHAIN_RPC_URL、DEPLOYER_PRIVATE_KEY                         | 仅 API 运行时使用的 RPC / issuer 密钥       |
| NEXT_PUBLIC_REOWN_PROJECT_ID                                | 公共钱包配置，build-time                    |
| CHAINPASS_BIND_ADDRESS、CHAINPASS_HTTP_PORT / HTTP_PORT     | 宿主机监听地址与端口；专用端口优先          |
| PROD_SSH_PRIVATE_KEY、PROD_SSH_KNOWN_HOSTS                  | GitHub Actions Secrets，可信 host-key 校验  |
| PROD_REOWN_PROJECT_ID                                       | GitHub Variable 映射 Web build 参数         |

教学服务器显式使用 Compose project `chainpass`，仅绑定 `127.0.0.1:18081`。模板的 `0.0.0.0` / `80` 是通用示例，不是教学服务器配置，示例域名也不表示 HTTPS 已配置。API / Web / DB 不映射宿主机端口；backend 网络为 internal，数据卷 `chainpass_postgres_data` 持久化。

已有操作者可用 `ssh chainpass` 日常访问。新操作者应单独获取授权和个人 SSH key，不复制 Actions 私钥。先核验可信 host fingerprint，不禁用 host-key 检查。生产 Secret 和 SSH 的首次配置、轮换仍是人工步骤。

### Web build-time

`NEXT_PUBLIC_API_URL=<origin>/api`；`NEXT_PUBLIC_AUTH_URL` / `NEXT_PUBLIC_APP_URL` 为 `<origin>`；`NEXT_PUBLIC_CHAIN_ID=11155111`；`NEXT_PUBLIC_CHAINPASS_CONTRACT_ADDRESS` 取 `sepolia.json` 的公开部署地址；`NEXT_PUBLIC_REOWN_PROJECT_ID` 可为空。只改服务器 env 或重启旧 Web，不能更新已编译的公共变量。

### 应急构建（只在 Mac/CI）

在仓库根目录替换公开占位符。issuer / Auth / QR 密钥不能作为 build ARG；全部镜像必须是 `linux/amd64`：

```bash
set -euo pipefail
export IMAGE_TAG="<release-tag>"
export PUBLIC_URL="<actual-public-origin>"
export CHAIN_ID=11155111
export CHAINPASS_CONTRACT_ADDRESS=0xbA3e9bCbe448E928c5e71f4bE6415E7e0e3E5ABb
export NEXT_PUBLIC_REOWN_PROJECT_ID="<public-project-id-or-empty>"

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

### 应急本地验收

使用已有、被 Git 忽略的本地 env，不打印或覆盖它。选择隔离的 project 和端口，避免操作开发数据库。若 Web 构建使用生产 origin，本地健康检查通过仍不证明生产 Cookie 正常：

```bash
DOCKER_DEFAULT_PLATFORM=linux/amd64 \
  CHAINPASS_COMPOSE_PROJECT=chainpass-local \
  IMAGE_TAG="${IMAGE_TAG}" \
  CHAINPASS_ENV_FILE="$PWD/infra/.env.production.local" \
  CHAINPASS_BIND_ADDRESS=127.0.0.1 \
  CHAINPASS_HTTP_PORT=8080 \
  CHAINPASS_SMOKE_URL=http://127.0.0.1:8080 \
  bash infra/scripts/deploy.sh
```

要求四个容器 healthy、迁移成功、`/api/health` 返回 `database:connected`、`/` 返回 200。本地停栈只使用明确的 project / Compose / env 执行 `down`，**不加 `-v`**。

### 打包与传输（Mac/CI）

只打包五张镜像和三个配套文件，不打包 env/DB/key。确认 IMAGE_TAG 为经过验证的安全 tag：

```bash
set -euo pipefail
[[ "${IMAGE_TAG}" =~ ^[0-9]{8}-[0-9a-f]{7}$ ]]
release_dir="$(mktemp -d)"
archive="chainpass-images-${IMAGE_TAG}.tar.gz"
docker save "chainpass-api:${IMAGE_TAG}" "chainpass-api-migrate:${IMAGE_TAG}" \
  "chainpass-web:${IMAGE_TAG}" "chainpass-nginx:${IMAGE_TAG}" postgres:17-alpine \
  | gzip > "${release_dir}/${archive}"
cp infra/docker-compose.prod.yml infra/nginx/teaching-server.conf \
  infra/scripts/deploy.sh "${release_dir}/"
(cd "${release_dir}" && shasum -a 256 "${archive}" docker-compose.prod.yml \
  teaching-server.conf deploy.sh > SHA256SUMS)
ssh chainpass "mkdir -p /home/chainpass/releases/${IMAGE_TAG}"
scp "${release_dir}/${archive}" "${release_dir}/SHA256SUMS" \
  "${release_dir}/docker-compose.prod.yml" "${release_dir}/teaching-server.conf" \
  "${release_dir}/deploy.sh" "chainpass:/home/chainpass/releases/${IMAGE_TAG}/"
```

在服务器对应 release 目录先执行 `sha256sum --check SHA256SUMS`，成功后再用 `gzip -dc <archive> | docker load` 加载。SCP 缓慢时先检查文件增长与进程，不能另开冲突传输或直接从头重跑。

### 服务器启动与系统入口

启动前按[运维](./OPERATIONS.md#zh)备份。显式指定 project `chainpass`、release Compose、env 和 loopback smoke URL。部署脚本只运行已加载的镜像，使用 `--no-build`；顺序是 PostgreSQL healthy → migration → API → Web → Docker Nginx，随后核对公网健康和 tag。

系统 Nginx site 独立管理，不由部署脚本或 CD 安装、reload。经授权首次安装前，检查 loopback `/healthz` 和 `/api/health`；只添加 ChainPass site，通过 `nginx -t` 后 reload，保留其他 site。保留 180 秒 timeout、Auth 完整 `/api/auth` 路径和普通业务 `/api` 去前缀的语义。

HTTP 是已记录的教学配置。TLS 需另行授权，并检查代理协议、Origin、Cookie、Web 构建 URL 与相机。共享服务器不碰 pawlice-report `:8080`、flow-lab `:10010`、Swarm 或其他目录；不向公网开放 18081/3000/3001/5432。

### 完成标准

CI 与正确发布证据、镜像平台、checksum、迁移前备份、migration、四容器 health、loopback/公网响应、实际 image/tag/env 一致、对应业务验收、其他服务未受影响。取消的 Actions run 即使后续手工完成，也不能说成 CD 全自动成功。

---

<a id="en"></a>

## English

This is the configuration/emergency-delivery guide. [Architecture & Deployment](./ARCHITECTURE_AND_DEPLOYMENT.md#en) owns the pipeline/evidence; [Operations](./OPERATIONS.md#en) owns release/rollback. No production recheck/deploy is claimed here.

### Default and configuration

Normal updates use manual Deploy Production on main after exact main push CI, with DEPLOY. Runner builds/inspects amd64, archives/checksums/transfers, host loads/backups/migrates/starts/checks/persists tag. Never build project images on the shared host. Compose build definitions are for Mac/CI; manual archive delivery is authorized emergency fallback.

Use infra/.env.production.example; real `/home/chainpass/.env.production` has mode `600` and lives outside releases. PUBLIC_URL must match public Web build; IMAGE_TAG must match running images. POSTGRES_USER, POSTGRES_DB, POSTGRES_PASSWORD and DATABASE_URL use internal postgres. Auth/QR secrets are separate API-runtime secrets. CHAIN_RPC_URL/DEPLOYER_PRIVATE_KEY are API-only. Public chain/contract/Reown and bind/port are not private keys. CHAINPASS_HTTP_PORT overrides HTTP_PORT.

Teaching deployment explicitly uses project chainpass and `127.0.0.1:18081`. The template's 0.0.0.0/80 and example domain is generic, not installed TLS. DB/API/Web have no host ports; the backend network is internal and chainpass_postgres_data persist.

Actions uses PROD_SSH_PRIVATE_KEY/PROD_SSH_KNOWN_HOSTS Secrets and PROD_REOWN_PROJECT_ID Variable. Trusted host fingerprints and separate personal SSH authorization are manual; never copy/decode private keys into docs. Existing operators use ssh chainpass.

`NEXT_PUBLIC_API_URL=<origin>/api`; `NEXT_PUBLIC_AUTH_URL` / `NEXT_PUBLIC_APP_URL` use `<origin>`. `NEXT_PUBLIC_CHAIN_ID=11155111`, `NEXT_PUBLIC_CHAINPASS_CONTRACT_ADDRESS` from deployment metadata and `NEXT_PUBLIC_REOWN_PROJECT_ID` are build-time configuration. Restart/env-only cannot change an old Web bundle.

### Emergency Mac/CI build

Replace public placeholders; never pass runtime secrets as build ARG. All images must be linux/amd64:

```bash
set -euo pipefail
export IMAGE_TAG="<release-tag>"
export PUBLIC_URL="<actual-public-origin>"
export CHAIN_ID=11155111
export CHAINPASS_CONTRACT_ADDRESS=0xbA3e9bCbe448E928c5e71f4bE6415E7e0e3E5ABb
export NEXT_PUBLIC_REOWN_PROJECT_ID="<public-project-id-or-empty>"

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

### Local acceptance

Use existing ignored local env, an isolated project/port, and do not touch the development DB. Health with production-origin browser bundles does not prove production cookies:

```bash
DOCKER_DEFAULT_PLATFORM=linux/amd64 \
  CHAINPASS_COMPOSE_PROJECT=chainpass-local \
  IMAGE_TAG="${IMAGE_TAG}" \
  CHAINPASS_ENV_FILE="$PWD/infra/.env.production.local" \
  CHAINPASS_BIND_ADDRESS=127.0.0.1 \
  CHAINPASS_HTTP_PORT=8080 \
  CHAINPASS_SMOKE_URL=http://127.0.0.1:8080 \
  bash infra/scripts/deploy.sh
```

Four containers healthy, migration success, API DB-connected and Web HTTP 200 are required. Shutdown only the identified project without -v.

### Packaging and transfer

Package images/configs, never env/DB/keys. Validate a safe IMAGE_TAG:

```bash
set -euo pipefail
[[ "${IMAGE_TAG}" =~ ^[0-9]{8}-[0-9a-f]{7}$ ]]
release_dir="$(mktemp -d)"
archive="chainpass-images-${IMAGE_TAG}.tar.gz"
docker save "chainpass-api:${IMAGE_TAG}" "chainpass-api-migrate:${IMAGE_TAG}" \
  "chainpass-web:${IMAGE_TAG}" "chainpass-nginx:${IMAGE_TAG}" postgres:17-alpine \
  | gzip > "${release_dir}/${archive}"
cp infra/docker-compose.prod.yml infra/nginx/teaching-server.conf \
  infra/scripts/deploy.sh "${release_dir}/"
(cd "${release_dir}" && shasum -a 256 "${archive}" docker-compose.prod.yml \
  teaching-server.conf deploy.sh > SHA256SUMS)
ssh chainpass "mkdir -p /home/chainpass/releases/${IMAGE_TAG}"
scp "${release_dir}/${archive}" "${release_dir}/SHA256SUMS" \
  "${release_dir}/docker-compose.prod.yml" "${release_dir}/teaching-server.conf" \
  "${release_dir}/deploy.sh" "chainpass:/home/chainpass/releases/${IMAGE_TAG}/"
```

Host verifies SHA256 before gzip/docker load. Inspect progress/processes before restarting a quiet SCP step.

### Startup and host gateway

Back up according to Operations; explicitly set chainpass/release Compose/env/loopback smoke. Helper uses loaded/no-build images: Postgres→migration→API→Web→Nginx, then public/tag validation.

System Nginx is manual and separate from CD/helper. Before authorized initial install test loopback healthz/API; add only ChainPass site, nginx -t then reload. Preserve 180-second timeout, Auth prefix and business-prefix stripping.

HTTP is the recorded teaching architecture; TLS requires separate proxy/cookie/origin/build/camera review. Preserve other projects on :8080/:10010/Swarm/directories; never publish 18081/3000/3001/5432.

Acceptance requires correct CI/release/platform/checksums, backup/migration, health/routes, matching running images/tag/env, relevant business checks and unaffected shared services. A cancelled Actions run remains cancelled even if emergency delivery completes.
