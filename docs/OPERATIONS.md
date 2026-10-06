# ChainPass Production Operations

这是日常发布与故障处理 Runbook。架构、CI/CD 实现、Secret 责任和 **2026-10-06 的已验证状态/差异**统一见 [DEPLOYMENT.md](./DEPLOYMENT.md)。快照不能替代操作前的实时检查。

先区分权限：审计/查日志是只读；点击 DEPLOY、重启、迁移、回滚、配置修复都是写操作，需要明确授权。本次文档同步没有执行任何生产写操作。

## 1. 标准发布

```text
develop → develop CI → 合入 main → main push CI → 人工 Deploy Production → production
```

1. 在 develop 开发。前后端规则仍遵守 [AGENTS.md](../AGENTS.md)；数据库变化在开发机生成并提交 migration。
2. 本地验证。至少按改动范围检查；完整质量门禁对应：

   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter api exec prisma generate
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

   API E2E 另需可用的隔离测试数据库，先 migrate deploy，再 `pnpm --filter api test:e2e`；不要将测试指向生产数据库。
3. 明确授权后 commit/push develop，等待 GitHub **Quality Gate + API E2E** 全绿。CI 失败先修复，不拿本地通过替代。
4. 准备上线时通过 PR 将 develop 合入 main；保持现有分支保护，不绕过规则。不需要新增永久 release/hotfix/staging 分支。
5. 等待**目标 main SHA 的 push CI**两个 jobs 全绿。develop 同 SHA 的成功或 PR CI 不替代这一条件。
6. GitHub → Actions → **Deploy Production** → Run workflow → Branch **main** → confirm 输入 **DEPLOY**。
7. 观察 build → package → SCP → checksum/load → backup → migration → health → active-tag persistence → public health。完整步骤与尚未合入 main 的加固见 Deployment；第一次使用新版前必须先完成合入。
8. Actions 成功后访问 `http://124.71.227.47` 并执行下一节健康检查，比较运行镜像 tag 和 env tag。
9. 根据变更执行真实业务验收：登录/Session、活动浏览、Claim 等；Mint 只在明确批准测试网交易后验证。绿色 health 不等于完整业务验收。

**普通前端/后端更新不再需要人工 SSH 修改代码、服务器 build、SCP、docker load 或重启服务。** 正常路径只需代码进入 main、对应 main CI 成功、人工点击 Deploy Production；后续由 GitHub Actions 完成。手工发布仅是 [Emergency fallback](./DEPLOYMENT.md#8-emergency-fallback--macci-构建服务器只运行)。

## 2. 只读健康检查与当前 release

在个人 Mac：

```bash
curl --fail --silent --show-error http://124.71.227.47/api/health
curl -I http://124.71.227.47/
ssh chainpass
```

连接服务器后：

```bash
docker ps --filter label=com.docker.compose.project=chainpass
stat -c '%a %n' /home/chainpass/.env.production
grep '^IMAGE_TAG=' /home/chainpass/.env.production
ls -lh /home/chainpass/releases/
ls -lh /home/chainpass/backups/
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

预期：四个 ChainPass 常驻容器 healthy；env mode 600；API 返回 database connected；Web 200；其他两个项目与检查前行为一致；Swarm 保持 active。不要输出完整 env、`docker inspect` 或解析后的 Compose config，它们可能包含 Secret。

### 安全选择 Compose 上下文

**不要直接使用 env 中的 tag 作为当前运行版本。** 它曾发生漂移。以下 Bash 片段只读取运行镜像和公开 tag，并为后续命令选对 release，不修改 env 或容器：

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
    printf '%s\n' 'Mixed release detected; stop and inspect before any write.'
    exit 1
  }
done
env_tag="$(sed -n 's/^IMAGE_TAG=//p' "${ENV_FILE}" | tail -n 1)"
printf 'Running release: %s\nRecorded release: %s\n' "${ACTIVE_TAG}" "${env_tag}"
if [[ "${env_tag}" != "${ACTIVE_TAG}" ]]; then
  printf '%s\n' 'Tag drift: read-only diagnostics allowed; reconcile before writes.'
fi
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

如果容器缺失/混合版本/目录缺失，停止自动选择，按 Actions run 和 `docker ps -a --filter label=com.docker.compose.project=chainpass` 核对实际状态。不要为了查日志运行 up，也不要修复到猜测的 tag。

在同一 Bash 会话、使用上述明确上下文查日志：

```bash
compose logs --tail 100 api web nginx
compose logs --tail 100 postgres
docker inspect chainpass-api-1 --format '{{.State.Health.Status}}'
ss -lntp
nginx -t
```

日志只能私下排障，分享前脱敏 Cookie、Session、RPC credential、个人信息与 stack；不要直接贴完整日志到聊天、Issue 或文档。

### 一次发布的完成标准

- 目标 main push CI 成功，Production Deploy run 成功。
- 运行 API/Web/Nginx 全部为目标 tag；env IMAGE_TAG 相同且仍 mode 600。
- 四个容器 healthy、migration 成功；更新已有数据库前备份已生成。
- loopback 和公网 API/Web 正常；其他服务保持正常。
- 当前发布相关业务验收完成，或把未验收部分明确列出。

若 run 失败但容器已更新，先核对上面各项；不要因为红色 Actions 就盲目再次迁移/发 Mint/重跑整个部署。

## 3. 从哪里开始排障

| 症状 | 第一检查 / 停止条件 |
| --- | --- |
| CI 失败 | 看失败的 job/step；API E2E 查隔离 PostgreSQL/migration，普通 CI 不需要生产 key |
| Deploy job 跳过/CI gate 拒绝 | 确认 branch main、输入 DEPLOY、该 SHA 的 main push CI 成功；不要复用 develop 结果 |
| SCP 数分钟无日志 | 看 Actions 所处 step/timeout 和服务器 release 文件尺寸是否变化；成功案例约 809 MiB、21 分钟传输，不能仅凭静默判死或开启第二次发布 |
| checksum 失败/镜像缺失 | 停止启动；核对完整传输和 SHA256，仅加载正确的已有 archive，禁止服务器 build |
| API/PostgreSQL unhealthy | 查该 project 的日志、migration 结果、数据库连通性；保留 volume，不 reset/prune |
| loopback 正常、公网失败 | 查 system Nginx、host :80 和华为安全组 TCP/80；不要公开 18081/3000/3001/5432 |
| Auth 登录/Session 异常 | 查最终 PUBLIC_URL、API origin、已构建 Web URL、代理路由、Cookie；不要关 Origin/CSRF |
| RPC/Mint 失败 | 在 API 容器内部做脱敏只读 chainId/code/owner 检查，区分连通性/链不匹配/issuer；不要打印 RPC URL/key 或手工链调用冒充应用 Mint |
| env tag 与镜像不一致 | 运行镜像优先；停止依赖旧 env 的写操作，经授权单独修复记录或走已审核发布 |
| 磁盘不足 | 查 releases/backups/ChainPass image 使用；先确认保留与恢复需求，再请求定向处理，绝不全局 prune |
| HTTP 下摄像头不可用 | 当前没有 HTTPS，正常 secure-context 限制；API 核验和 Manual Pass ID 不因此失效 |

不要用健康检查自动发送真实 Mint。数据库健康也不会测试公网 RPC；RPC 查询成功不保证 issuer 余额或浏览器 Wallet 流程成功。

## 4. 备份与人工生命周期

CD 的迁移前备份规则见 Deployment。额外手工备份仅在授权后，使用第二节确认的 `compose()`：

```bash
umask 077
backup="/home/chainpass/backups/manual-$(date -u +%Y%m%d-%H%M%S).dump"
compose exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "${backup}"
test -s "${backup}"
compose exec -T postgres pg_restore --list < "${backup}" >/dev/null
```

TOC 可读不是恢复成功证明。dump 包含业务/Auth 数据，不进 Git、不公开分享；将备份安全保存到异机，并在隔离数据库演练恢复。恢复生产前必须单独评估停机和数据覆盖。

仅在 tag 已对齐并明确批准相应操作后：

```bash
# Restart only the authorized ChainPass service.
compose restart api
# Maintenance shutdown only; never add -v.
compose down
```

普通代码发布不用这些命令。重启不会更新镜像或 Web build-time env；停栈会使 ChainPass 不可用。停止后数据卷保留，再次启动必须走已审核 release 流程。

## 5. 回滚（仅在明确授权后执行）

1. 保存失败 run/实际运行 tag 的公开证据；选一个已知健康的历史 release，保留当前/旧 archive 和 image。
2. 审查已完成 Prisma migrations，确认旧应用能使用当前 schema。**不兼容就停止**，采用 forward repair 或单独审核的数据库恢复；应用回滚不反向 migration。
3. 确认当前 PostgreSQL healthy；按上一节备份；核对旧 Web 编译 origin 与当前 PUBLIC_URL 一致。
4. 检查目标镜像存在；若缺失，在目标 release 中校验 SHA256，再 docker load。禁止重建，禁止改 project/volume，禁止运行旧 helper 来顺便执行 migration。
5. 在服务器 Bash 明确选择旧 tag，只替换应用服务：

   ```bash
   set -euo pipefail
   export IMAGE_TAG="<known-good-tag>"
   [[ "${IMAGE_TAG}" =~ ^[0-9]{8}-[0-9a-f]{7}$ ]]
   ENV_FILE=/home/chainpass/.env.production
   RELEASE_DIR="/home/chainpass/releases/${IMAGE_TAG}"
   test -f "${RELEASE_DIR}/docker-compose.prod.yml"
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
   curl --fail --silent --output /dev/null http://124.71.227.47/
   ```

6. 核对三张运行镜像确实是目标 tag、四容器健康、相关业务与其他项目正常。成功后**只修改 env 的公开 IMAGE_TAG**，保持 secrets 与其他配置不变，并读回确认：

   ```bash
   if grep -q '^IMAGE_TAG=' "${ENV_FILE}"; then
     sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" "${ENV_FILE}"
   else
     printf '\nIMAGE_TAG=%s\n' "${IMAGE_TAG}" >> "${ENV_FILE}"
   fi
   chmod 600 "${ENV_FILE}"
   [[ "$(sed -n 's/^IMAGE_TAG=//p' "${ENV_FILE}" | tail -n 1)" == "${IMAGE_TAG}" ]]
   ```

7. 记录回滚 tag、原因、健康结果，不记录 Secret。当前 CD 没有自动回滚；新一次发布仍以 main workflow 为准。

## 6. 紧急手工发布的补充责任

镜像构建/本地 smoke/打包/传输见 Deployment 的 Emergency fallback。在服务器上必须额外：

1. 核对当前 release/其他服务，解决 tag 漂移，确认授权与数据库备份。
2. 校验新 release 的 SHA256、docker load，显式 export 新 IMAGE_TAG。
3. 运行 helper（已加载镜像，不构建），不要改系统 Nginx：

   ```bash
   export IMAGE_TAG="<new-release-tag>"
   [[ "${IMAGE_TAG}" =~ ^[0-9]{8}-[0-9a-f]{7}$ ]]
   CHAINPASS_COMPOSE_PROJECT=chainpass \
   CHAINPASS_COMPOSE_FILE="/home/chainpass/releases/${IMAGE_TAG}/docker-compose.prod.yml" \
   CHAINPASS_ENV_FILE=/home/chainpass/.env.production \
   CHAINPASS_SMOKE_URL=http://127.0.0.1:18081 \
     bash "/home/chainpass/releases/${IMAGE_TAG}/deploy.sh"
   ```

4. 按第二节完成公网/镜像/业务验收后，按回滚节相同的公开 tag 更新方式持久化 env；helper 本身不会做这一步。

此路径不替代正常 Actions 发布，也不负责初始化 Secret、恢复数据库或安装 system Nginx。

## 7. Danger / Do Not

共享服务器只操作明确属于 Compose project `chainpass` 的资源：

- 不运行 `docker system prune -a`、`docker volume prune`、`docker network prune`；容量问题先审查并申请定向清理。
- 不删除 `chainpass_postgres_data`，不使用 `down -v`、数据库 reset 或生产 `prisma migrate dev`；迁移使用受审核的 migrate deploy。
- 不打印 production env、private key、Cookie 或 Session，不提交 Secret；查询仅输出经过白名单过滤的公开值。
- 不停止/修改 pawlice-report、flow-lab、Swarm、Docker daemon，不动 `/home/fwb` 和其他 Nginx site。
- 不占用 `:8080` / `:10010`，不把 ChainPass 的 `18081` / `3000` / `3001` / `5432` 开到公网。
- 不在服务器 `docker build` / `docker compose build`；只加载 Mac/Actions 产出的 linux/amd64 镜像。
- 不直接删除旧 release/image/backup；先确认回滚和数据恢复需要、得到明确清理授权。
- 不因为文档审计自动触发 Deploy、回滚、reload 或修改 Secret；先报告实际差异。
