# ChainPass 生产运维 / Production Operations

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

日常操作手册。流水线以[架构与部署](./ARCHITECTURE_AND_DEPLOYMENT.md#zh)为准，镜像交付见[部署指南](./DEPLOYMENT.md#zh)。本轮只改文档，不复核/修改生产；所有写操作都需授权。

### 1. 标准发布

```text
develop → 本地验证 → 授权commit/push → develop CI
→ 合入main → 精确main SHA的push CI
→ Actions / Deploy Production / main / DEPLOY → production
```

本地质量对应：

```bash
pnpm install --frozen-lockfile
pnpm --filter api exec prisma generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

E2E 另需隔离测试 DB/migrate 后运行 api test:e2e。普通更新无需 SSH 改代码/build/scp/load/restart。Solidity 和 Mobile 分发不属于应用 CD；Secret、系统 Nginx/TLS、备份恢复与回滚仍人工。

### 2. 只读健康与版本

公网由授权配置设置 PUBLIC_URL，执行：

```bash
curl --fail "${PUBLIC_URL%/}/api/health"
curl -I "${PUBLIC_URL%/}/"
ssh chainpass
```

在服务器：

```bash
docker ps --filter label=com.docker.compose.project=chainpass
stat -c '%a %n' /home/chainpass/.env.production
grep '^IMAGE_TAG=' /home/chainpass/.env.production
ls -lh /home/chainpass/releases/ /home/chainpass/backups/
curl --fail http://127.0.0.1:18081/healthz
curl --fail http://127.0.0.1:18081/api/health
curl --fail http://127.0.0.1:18081/api/events
curl -I http://127.0.0.1:8080
curl -I http://127.0.0.1:10010
docker service ls
docker info --format '{{.Swarm.LocalNodeState}}'
free -h
df -h /
```

四个 ChainPass 容器应 healthy；env 权限为 600；API 返回 `database:connected`；Web 返回 HTTP 200；其他服务与之前行为一致。不要输出完整 env/inspect/config，使用白名单 format 与 config --quiet。

IMAGE_TAG 曾漂移，**实际镜像、env、release 必须交叉核对**。在 Bash 安全选上下文：

```bash
set -euo pipefail
ENV_FILE=/home/chainpass/.env.production
api_image="$(docker inspect chainpass-api-1 --format '{{.Config.Image}}')"
ACTIVE_TAG="${api_image#chainpass-api:}"
[[ "${api_image}" == "chainpass-api:${ACTIVE_TAG}" ]]
[[ "${ACTIVE_TAG}" =~ ^[0-9]{8}-[0-9a-f]{7}$ ]]
for service in web nginx; do
  actual="$(docker inspect "chainpass-${service}-1" --format '{{.Config.Image}}')"
  [[ "${actual}" == "chainpass-${service}:${ACTIVE_TAG}" ]] || {
    printf '%s\n' 'Mixed release; inspect before writes.'
    exit 1
  }
done
env_tag="$(sed -n 's/^IMAGE_TAG=//p' "${ENV_FILE}" | tail -n 1)"
printf 'Running: %s\nRecorded: %s\n' "${ACTIVE_TAG}" "${env_tag}"
RELEASE_DIR="/home/chainpass/releases/${ACTIVE_TAG}"
test -f "${RELEASE_DIR}/docker-compose.prod.yml"
export IMAGE_TAG="${ACTIVE_TAG}"
compose() {
  docker compose -p chainpass --env-file "${ENV_FILE}" \
    -f "${RELEASE_DIR}/docker-compose.prod.yml" "$@"
}
compose config --quiet
compose ps
```

有缺失/混合版本/漂移时先只读诊断，不用旧 env 执行写操作。读取日志不能顺便 up：

```bash
compose logs --tail 100 api web nginx
compose logs --tail 100 postgres
ss -lntp
nginx -t
```

日志可能包含个人数据、Cookie 或服务商凭证，分享前必须脱敏。

### 3. 排障顺序

| 症状                  | 第一步                                                       |
| --------------------- | ------------------------------------------------------------ |
| CI/gate 失败          | 失败 job/step、main/SHA/push/DEPLOY 条件                     |
| SCP 无日志            | live 进程/远端文件增长/timeout；不能直接重跑                 |
| checksum/缺 image     | 停止启动，核对完整 release 并 load；服务器不 build           |
| DB/API unhealthy      | ChainPass 日志/migration/connectivity，保留 volume           |
| loopback 正常公网失败 | 系统 Nginx、监听端口和云安全组 TCP 80，不公开内部端口        |
| 登录/Session 失败     | PUBLIC_URL、Web 构建 URL、代理前缀、Cookie/Origin，不关 CSRF |
| Mint/RPC 失败         | API 内脱敏 chainId/code/owner/余额只读检查                   |
| tag 漂移              | 运行镜像优先；授权后仅修公开字段                             |
| 磁盘不足              | 审核 ChainPass 保留/回滚需求，申请定向处理，不 prune         |
| HTTP 相机失败         | 安全上下文限制；使用手工核验，TLS 另做                       |

### 4. 备份与维护

使用第二节确认的 compose 上下文，经授权备份：

```bash
umask 077
backup="/home/chainpass/backups/manual-$(date -u +%Y%m%dT%H%M%SZ).dump"
compose exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "${backup}"
test -s "${backup}"
chmod 600 "${backup}"
compose exec -T postgres pg_restore --list < "${backup}" >/dev/null
```

可读取备份目录不等于完成恢复演练。Dump 含 Auth 和用户数据，应设置权限 600、私密保存，另做异机副本与隔离恢复测试，不放入 Git 或 release。Workflow 只检查迁移前 dump 非空，没有自动权限、保留或恢复保障。

单服务 restart/compose down 都是写操作，不用于普通发布；down 不带-v。重启不更新镜像/publicbuildenv；停栈会中断服务。

### 5. 人工回滚

无自动 rollback。先识别已知好 release/images，查当前 migration 与旧应用兼容性，不兼容则停止、采用 向前修复迁移，或单独审核数据库恢复。备份并核对旧 Web 构建使用的 origin；缺镜像则校验旧 archive/load，**不运行旧 helper 顺便迁移**。

仅经审核执行应用替换：

```bash
set -euo pipefail
export IMAGE_TAG="<known-good-tag>"
[[ "${IMAGE_TAG}" =~ ^[0-9]{8}-[0-9a-f]{7}$ ]]
ENV_FILE=/home/chainpass/.env.production
RELEASE_DIR="/home/chainpass/releases/${IMAGE_TAG}"
compose() {
  docker compose -p chainpass --env-file "${ENV_FILE}" \
    -f "${RELEASE_DIR}/docker-compose.prod.yml" "$@"
}
compose config --quiet
for image in "chainpass-api:${IMAGE_TAG}" "chainpass-web:${IMAGE_TAG}" \
  "chainpass-nginx:${IMAGE_TAG}"; do
  docker image inspect "${image}" >/dev/null
done
compose up -d --no-build --no-deps --wait api
compose up -d --no-build --no-deps --wait web
compose up -d --no-build --no-deps --force-recreate --wait nginx
curl --fail http://127.0.0.1:18081/api/health
```

之后核对公网/业务/其他服务和实际三张 image，再仅持久化公开 tag：

```bash
if grep -q '^IMAGE_TAG=' "${ENV_FILE}"; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" "${ENV_FILE}"
else
  printf '\nIMAGE_TAG=%s\n' "${IMAGE_TAG}" >> "${ENV_FILE}"
fi
chmod 600 "${ENV_FILE}"
[[ "$(sed -n 's/^IMAGE_TAG=//p' "${ENV_FILE}" | tail -n 1)" == "${IMAGE_TAG}" ]]
```

应用回滚不反向 Prisma；DBrestore 需明确停机/数据覆盖决策。记录原因与结果，不记录 Secret。

### 6. 应急手工发布责任

只在授权后使用[Mac/CI交付](./DEPLOYMENT.md#zh)，verify/load 后显式指定新 tag：

```bash
export IMAGE_TAG="<new-release-tag>"
CHAINPASS_COMPOSE_PROJECT=chainpass \
CHAINPASS_COMPOSE_FILE="/home/chainpass/releases/${IMAGE_TAG}/docker-compose.prod.yml" \
CHAINPASS_ENV_FILE=/home/chainpass/.env.production \
CHAINPASS_SMOKE_URL=http://127.0.0.1:18081 \
  bash "/home/chainpass/releases/${IMAGE_TAG}/deploy.sh"
```

部署脚本不备份、不持久化 tag、不安装系统 Nginx site；应急发布需单独完成这些步骤。只加载不代表发布完成。

### 7. 禁区与完成标准

禁止全局 prune、删除数据库卷、`down -v`、生产 `migrate dev`、打印 Secret 或在服务器构建。不要操作 pawlice-report、flow-lab、Swarm、Docker daemon、`/home/fwb` 或其他 site；不占 8080/10010，不公开 18081/3000/3001/5432。历史 release、镜像与备份不能未经审核直接删除。

完成要求：准确的 main CI / release 证据、镜像/tag 一致、backup/migration 成功、四 health、loopback/公网、相关业务和共享服务回归。失败 run 可能已部分更新，先检查失败层；不要再次 Mint 或重跑部署来修记录。

---

<a id="en"></a>

## English

Operational runbook; [architecture](./ARCHITECTURE_AND_DEPLOYMENT.md#en) owns pipeline facts and [deployment](./DEPLOYMENT.md#en) image delivery. This edit does not inspect/mutate production. Writes require authorization.

### 1. Standard release

develop/local checks/authorized commit-push → develop CI → main merge → exact main push CI → Actions/Deploy Production/main/DEPLOY. Quality commands: frozen install, Prisma generate, root lint/typecheck/test/build; E2E requires isolated DB/migrations.

Ordinary updates need no SSH edits/build/scp/load/restart. Contracts/Mobile distribution are separate; secrets/host Nginx/TLS/restore/rollback remain manual.

### 2. Read-only health and version

Set PUBLIC_URL from authorized configuration; curl its /api/health and /, then ssh chainpass. Host checks:

```bash
docker ps --filter label=com.docker.compose.project=chainpass
stat -c '%a %n' /home/chainpass/.env.production
grep '^IMAGE_TAG=' /home/chainpass/.env.production
ls -lh /home/chainpass/releases/ /home/chainpass/backups/
curl --fail http://127.0.0.1:18081/healthz
curl --fail http://127.0.0.1:18081/api/health
curl --fail http://127.0.0.1:18081/api/events
curl -I http://127.0.0.1:8080
curl -I http://127.0.0.1:10010
docker service ls
docker info --format '{{.Swarm.LocalNodeState}}'
free -h
df -h /
```

Expect four healthy services, env mode 600, API DB-connected and Web HTTP 200 and unchanged shared services. Never print full env/inspect/interpolated config. Select context from actual images, not blindly persisted tag:

```bash
set -euo pipefail
ENV_FILE=/home/chainpass/.env.production
api_image="$(docker inspect chainpass-api-1 --format '{{.Config.Image}}')"
ACTIVE_TAG="${api_image#chainpass-api:}"
[[ "${api_image}" == "chainpass-api:${ACTIVE_TAG}" ]]
[[ "${ACTIVE_TAG}" =~ ^[0-9]{8}-[0-9a-f]{7}$ ]]
for service in web nginx; do
  actual="$(docker inspect "chainpass-${service}-1" --format '{{.Config.Image}}')"
  [[ "${actual}" == "chainpass-${service}:${ACTIVE_TAG}" ]] || {
    printf '%s\n' 'Mixed release; inspect before writes.'
    exit 1
  }
done
env_tag="$(sed -n 's/^IMAGE_TAG=//p' "${ENV_FILE}" | tail -n 1)"
printf 'Running: %s\nRecorded: %s\n' "${ACTIVE_TAG}" "${env_tag}"
RELEASE_DIR="/home/chainpass/releases/${ACTIVE_TAG}"
test -f "${RELEASE_DIR}/docker-compose.prod.yml"
export IMAGE_TAG="${ACTIVE_TAG}"
compose() {
  docker compose -p chainpass --env-file "${ENV_FILE}" \
    -f "${RELEASE_DIR}/docker-compose.prod.yml" "$@"
}
compose config --quiet
compose ps
```

Missing/mixed/drifted state requires inspection before writes. Query scoped compose logs --tail 100, ss and nginx -t; never up just for logs. Redact PII/cookies/provider credentials before sharing.

### 3. Diagnosis

CI/gate: exact job/main/SHA/push/confirmation. Quiet SCP: process/file growth/timeouts, no blind restart. Bad checksum/missing image: stop and verify/load, never host build. DB/API: scoped logs/migrations/connectivity, preserve volume. Loopback-only success: host Nginx/listener/cloud TCP 80, not public internal ports. Auth: origin/buildURL/prefix/cookie, keep CSRF. RPC: redacted API reads for chain/code/owner/balance. Tag drift: verify runtime then authorized metadata repair. Disk: reviewed scoped retention, no prune. HTTP camera: secure-context limitation/manual fallback.

### 4. Backup and maintenance

After authorized context verification:

```bash
umask 077
backup="/home/chainpass/backups/manual-$(date -u +%Y%m%dT%H%M%SZ).dump"
compose exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "${backup}"
test -s "${backup}"
chmod 600 "${backup}"
compose exec -T postgres pg_restore --list < "${backup}" >/dev/null
```

Readable TOC is not a restore drill. Dumps contain Auth/user data; protect with mode 600, an off-host copy and isolated restore testing, never Git/release. Workflow checks pre-migration dump/nonempty, not permissions/retention/restore.

restart and down are authorized mutations, not normal publishing. Never down -v; restart cannot change image/build-time values and shutdown interrupts availability.

### 5. Manual rollback

No automatic rollback. Review known-good images/release and current schema compatibility; incompatible schema requires forward repair or separately reviewed restore. Back up, verify old Web origin, checksum/load missing images. Do not run old migration helper blindly.

Reviewed application-only replacement:

```bash
set -euo pipefail
export IMAGE_TAG="<known-good-tag>"
[[ "${IMAGE_TAG}" =~ ^[0-9]{8}-[0-9a-f]{7}$ ]]
ENV_FILE=/home/chainpass/.env.production
RELEASE_DIR="/home/chainpass/releases/${IMAGE_TAG}"
compose() {
  docker compose -p chainpass --env-file "${ENV_FILE}" \
    -f "${RELEASE_DIR}/docker-compose.prod.yml" "$@"
}
compose config --quiet
for image in "chainpass-api:${IMAGE_TAG}" "chainpass-web:${IMAGE_TAG}" \
  "chainpass-nginx:${IMAGE_TAG}"; do
  docker image inspect "${image}" >/dev/null
done
compose up -d --no-build --no-deps --wait api
compose up -d --no-build --no-deps --wait web
compose up -d --no-build --no-deps --force-recreate --wait nginx
curl --fail http://127.0.0.1:18081/api/health
```

Check public/business/shared services and actual image tags before persisting only the public tag:

```bash
if grep -q '^IMAGE_TAG=' "${ENV_FILE}"; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" "${ENV_FILE}"
else
  printf '\nIMAGE_TAG=%s\n' "${IMAGE_TAG}" >> "${ENV_FILE}"
fi
chmod 600 "${ENV_FILE}"
[[ "$(sed -n 's/^IMAGE_TAG=//p' "${ENV_FILE}" | tail -n 1)" == "${IMAGE_TAG}" ]]
```

Application rollback does not reverse Prisma. Restore needs downtime/data-loss review; record results without secrets.

### 6. Emergency and safety

Authorized Mac/CI fallback uses verified/load images and explicit new IMAGE_TAG, chainpass project, release Compose, /home/chainpass/.env.production and loopback smoke with release deploy.sh. Helper does not back up, persist tag or install system site; complete those responsibilities separately. Loading is not deployment.

Never globally prune/delete DB volume/down-v/production migrate dev/print secrets/build on host. Preserve pawlice-report/flow-lab/Swarm/daemon, /home/fwb and other sites; don't occupy 8080/10010 or expose 18081/3000/3001/5432. Retain old releases/images/backups until authorized review.

Success requires exact CI/release evidence, matching images/env/tag, backup/migration, health/routes, business and shared-service checks. A failed run may have updated services: inspect its layer before repeating deployment or mint.
