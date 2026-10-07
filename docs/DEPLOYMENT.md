# ChainPass Deployment

本文是生产基础设施、CI/CD、镜像交付与数据库迁移的事实来源。日常发布、排障、备份和回滚步骤见 [OPERATIONS.md](./OPERATIONS.md)。当前为单服务器 HTTP 教学 Demo，不是已完成 HTTPS 验收的正式服务。

## 1. 事实来源与已验证状态

检查顺序：生产运行状态 → 当前分支实现 → 成功 Actions run → 历史说明。下面是 **2026-10-06 只读审计快照**，后续操作前按 Operations 重新核对，不能把快照当永久配置。

| 项目 | 审计结果 |
| --- | --- |
| 仓库 | `develop @ d95f2c5`；本地和远端 `main @ 0530d3b` |
| 生产 | Huawei Cloud ECS，Ubuntu 24.04.2，`linux/amd64`，`http://124.71.227.47` |
| 实际运行 release | `20261006-0530d3b`；API、Web、Nginx 镜像 tag 一致 |
| 容器 | `chainpass-postgres-1`、`chainpass-api-1`、`chainpass-web-1`、`chainpass-nginx-1` 均 healthy |
| 公网检查 | `/api/health` 返回 `{"status":"ok","database":"connected"}`；`/` HTTP 200 |
| 数据库 | PostgreSQL 17；现有 6 个 migrations 完成，查询正常 |
| 链上只读检查 | API 容器的 RPC 返回 chain ID `11155111`，合约 bytecode 存在，`owner()` 为预期 issuer |
| 其他项目 | `:8080`、`:10010` 均 HTTP 200；现有 Swarm active，未修改 |

可追溯证据：

- [develop CI / d95f2c5](https://github.com/Maimai10808/chainpass/actions/runs/37464753147)：Quality Gate、API E2E 成功；E2E **8 files passed / 1 skipped，74 tests passed / 1 skipped**。
- [main CI / 0530d3b](https://github.com/Maimai10808/chainpass/actions/runs/37453003479)：两个 jobs 成功。
- [Production Deploy / 0530d3b](https://github.com/Maimai10808/chainpass/actions/runs/37453088818)：人工触发并成功，实际 release 为 `20261006-0530d3b`。

**本次发现的差异，尚未修复：**

1. 服务器 `/home/chainpass/.env.production` 的 `IMAGE_TAG` 仍是 `20261006-f07ef28`，与运行容器不同。查询日志时从容器读取实际 tag；在明确授权修复前，不根据这个旧值重启或发布。
2. 严格 main CI 查询已在 `develop / b328347`，独立 `Persist active release tag` step 已在 `develop / d95f2c5`，**尚未进入 main**。已成功的生产 run 使用旧版 workflow；不能据此宣称两个加固 step 已在生产验证。
3. main 有 GitHub ruleset 保护，但有效 `required_status_checks` 列表目前为空。它不等于合并前已强制执行两个 CI jobs；发布仍须人工确认 main CI。
4. 仓库层面尚无 `PROD_REOWN_PROJECT_ID` Variable；当前 workflow 允许空值。本次未验证浏览器 Wallet 连接、登录、Claim、Mint 或 QR Camera 全链路。
5. HTTP 无 TLS，Camera secure-context 验收待域名/HTTPS。磁盘当前约 9.1 GiB 可用；镜像、release 和备份无自动保留策略。备份可列出 TOC，但尚未做恢复演练或验证异机备份。

下一次发布前，先把两个 workflow 加固提交通过正常 PR 合入 main，并等待对应 main push CI 成功；tag 漂移单独核对处理。本次文档审计不修改服务器或 workflow。

## 2. 生产架构与隔离

```text
Internet :80
    ↓
System Nginx
    ↓
127.0.0.1:18081 → ChainPass Docker Nginx
                    ├── /          → Next.js Web :3000
                    └── /api/*     → NestJS API :3001
                                          ├── PostgreSQL :5432
                                          └── Ethereum Sepolia RPC
```

- Compose project 固定为 `chainpass`。Compose 文件/helper 的默认值是 `chainpass-prod`，服务器调用必须显式覆盖，避免创建另一套资源。
- 只有 Docker Nginx 映射 host port；生产绑定 `127.0.0.1:18081`。Web/API/PostgreSQL 没有 host-port 映射。
- `chainpass_edge` 连接 Nginx/Web/API；`chainpass_backend` 为 internal network，连接 API/migrate/PostgreSQL。
- 数据卷为 `chainpass_postgres_data`，挂载到 `/var/lib/postgresql/data`。正常更新保持 project/volume，不清空数据库。
- API/Web 是 production runtime，非开发模式；API/Web Dockerfile 为 monorepo multi-stage build，Web 使用 Next.js standalone。migration 是独立 one-shot image，不是长期服务。
- Mobile 不部署在这套 Compose 中；合约部署也不属于普通应用 CD。

相关实现：

- [Production Compose](../infra/docker-compose.prod.yml)、[部署 helper](../infra/scripts/deploy.sh)
- [API Dockerfile](../apps/api/Dockerfile)、[Web Dockerfile](../apps/web/Dockerfile)、[Nginx Dockerfile](../infra/nginx/Dockerfile)

### 服务器目录

```text
/home/chainpass/                         # 当前 mode 700
├── .env.production                     # mode 600，runtime secrets，不在 Git
├── backups/
│   └── pre-<IMAGE_TAG>.dump             # PostgreSQL custom-format dump
└── releases/
    └── <IMAGE_TAG>/
        ├── chainpass-images-<IMAGE_TAG>.tar.gz
        ├── SHA256SUMS
        ├── docker-compose.prod.yml
        ├── teaching-server.conf
        └── deploy.sh
```

当前 release 目录为 `/home/chainpass/releases/20261006-0530d3b`，归档约 809 MiB；旧 `20261006-f07ef28` 目录也保留。服务器无需源码 checkout、pnpm 或构建工具链。

### Nginx / Better Auth

[Docker 配置](../infra/nginx/default.conf) 保留 `/api/auth/*` 完整 prefix；普通 `/api/*` 去掉 `/api/` 后转发 NestJS。例如公网 `/api/events` → API `/events`。保持这些 `proxy_pass` 的 trailing slash 语义。

[系统配置模板](../infra/nginx/teaching-server.conf) 已安装到：

```text
/etc/nginx/sites-available/chainpass.conf
/etc/nginx/sites-enabled/chainpass.conf → 上述文件
```

两层代理均保留 Host/forwarding headers，`proxy_read_timeout 180s` 用于等待 Mint receipt。系统 site 由人工管理，普通 CD **不安装、修改或 reload 系统 Nginx**。

API 的 `BETTER_AUTH_URL` / `WEB_ORIGIN` 由 Compose 的 `PUBLIC_URL` 派生；当前均为 `http://124.71.227.47`。Web 使用同源 `/api`，Better Auth Origin/CSRF 检查保持开启。健康响应不代表真实浏览器 Cookie/Session 或 Wallet 交互已验收。

## 3. GitHub CI

实现以 [.github/workflows/ci.yml](../.github/workflows/ci.yml) 为准。

- 触发：push `develop` / `main`、目标为这两条分支的 PR，以及人工 `workflow_dispatch`。
- Node.js 24、pnpm 12.6.0；同一 ref 的旧 CI 可被新运行取消。
- `Quality Gate` 与 `API E2E` 为两个 jobs，均有 30 分钟 timeout。

| Job | 实际检查 |
| --- | --- |
| Quality Gate | frozen-lockfile install → Prisma generate → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` |
| API E2E | 隔离 PostgreSQL 17 service healthy → install → Prisma generate → `prisma migrate deploy --config prisma7.config.ts` → `pnpm --filter api test:e2e` |

Quality Gate 使用 CI build-only public URL 与测试用 DATABASE_URL，不是生产配置。API E2E 使用隔离数据库和测试 Auth/QR 配置，**不使用生产 signer 或公网 Sepolia**。

`test/blockchain.service.integration.e2e-spec.ts` 仅在 `BLOCKCHAIN_INTEGRATION=true` 时启用；普通 CI 显式设为 false，因此跳过其 1 个测试。其他 Mint E2E 使用替换的 BlockchainService，不会发真实交易。本地需要链集成时单独配置 Anvil；不要向普通 CI 注入 Sepolia 私钥。

当前 CI 未运行 Foundry `forge build/test`，也不跑真实浏览器 Wallet、Mobile 真机或生产 Mint。Solidity 修改需独立执行 [contracts 文档](../contracts/README.md) 的测试和部署流程。

## 4. Production Deploy

默认路径是 [.github/workflows/deploy-production.yml](../.github/workflows/deploy-production.yml)，不是手工 SSH 构建。日常操作见 [标准发布 Runbook](./OPERATIONS.md#1-标准发布)。

### 发布门槛

- 仅 `workflow_dispatch`；push develop/main **不会自动部署**。
- job 仅接受 `refs/heads/main` 且确认输入精确为 `DEPLOY`。
- concurrency `chainpass-production`，`cancel-in-progress: false`；生产任务串行，不中途取消上一轮。
- 当前 develop 的 CI gate 查询：`branch=main&head_sha=$GITHUB_SHA&event=push&status=success`。禁止用 develop 上相同 SHA 的 CI 替代 main CI。
- **main @ 0530d3b 的旧 gate 只筛 head_sha/status**；使用新版 gate 前必须先合入上述修复。
- job timeout 60 分钟。主分支保护不能替代 workflow 自己的发布门槛。

### 当前 develop workflow 的顺序

1. checkout → 确认该 main commit 的 push CI 成功。
2. tag = UTC `YYYYMMDD-<7位commit SHA>`。
3. 在 GitHub Runner 依次构建 API、migration、Web、Docker Nginx `linux/amd64` 镜像；拉取同架构 PostgreSQL 17 镜像。
4. 检查全部 image architecture；`docker save | gzip`；把 Compose、系统 Nginx 模板、helper 一起放入 release；生成 `SHA256SUMS`。
5. 配置 SSH，校验连接，SCP 到 `/home/chainpass/releases/<IMAGE_TAG>`。
6. 服务器校验 SHA256 → `docker load` → 检查已有 env 文件及 mode 600。
7. 若已有正在运行的 ChainPass PostgreSQL，生成 `backups/pre-<IMAGE_TAG>.dump` 并检查非空；没有运行的 PostgreSQL时会跳过备份。已有生产数据却没有成功备份时应停止并人工核对，不能把该分支当恢复保证。
8. 复制 env 到临时 mode-600 文件，仅替换公开 IMAGE_TAG，退出时删除临时文件；真实 secrets 不进入 release 包。
9. helper：config 校验/loaded-image preflight → PostgreSQL healthy → one-shot `prisma migrate deploy` → API healthy → Web healthy → force-recreate Docker Nginx healthy。
10. helper 检查 loopback API/Web；远端检查公网 API/Web。
11. **独立 `Persist active release tag` step** 更新原 env 的 IMAGE_TAG、保持 600、读回并核对；该 step 当前只在 develop。
12. GitHub Runner 再检查公网 `/api/health`、`/`。

全部常驻服务启动使用 `--no-build`。migration 使用已加载镜像、`--pull never`，成功后删除 one-shot 容器。helper **不负责备份、永久 tag 记录、系统 Nginx、回滚或清理**；这些职责不能与 workflow 混淆。

**当前自动化边界：** CD 没有在 Runner 启动完整 Production Compose 做本地 smoke；它检查镜像构建/架构，随后验证远端健康。发布失败不会自动 rollback。SCP 默认没有细粒度进度日志；已成功的 809 MiB 包传输约 21 分钟，几分钟静默不等于失活，先查 Actions step 与只读服务器状态。

同一天重跑同一 commit 会得到同一 tag，可能复用/覆盖该 release 和 `pre-<tag>.dump`。重跑前保留需要的备份，不能把 tag 当每次运行唯一的不可变编号。

## 5. 配置、Secret 与 SSH

模板见 [infra/.env.production.example](../infra/.env.production.example)。当前服务器 env 使用 `HTTP_PORT=18081` 与 `CHAINPASS_BIND_ADDRESS=127.0.0.1`；`CHAINPASS_HTTP_PORT` 若设置则优先于 HTTP_PORT。模板默认不是教学服务器的实际值。

| 配置 | 来源 / 责任 |
| --- | --- |
| `IMAGE_TAG` | CD 成功后持久化；查询时与运行镜像交叉检查 |
| `PUBLIC_URL` | 服务器 runtime 与 workflow 的 Web build origin 必须一致 |
| `POSTGRES_USER` / `POSTGRES_DB` / `POSTGRES_PASSWORD` / `DATABASE_URL` | server env；数据库 host 使用 `postgres`，不公开密码 |
| `BETTER_AUTH_SECRET` / `QR_VERIFICATION_SECRET` | server env，API runtime-only，分别生成 |
| `CHAIN_ID` / `CHAINPASS_CONTRACT_ADDRESS` | Sepolia `11155111` / 当前公开合约地址 |
| `CHAIN_RPC_URL` / `DEPLOYER_PRIVATE_KEY` | server env，API runtime-only，不打印、不作为 build ARG |
| `PROD_SSH_PRIVATE_KEY` / `PROD_SSH_KNOWN_HOSTS` | GitHub Actions repository Secrets，用于严格 host-key 校验的 SSH |
| `PROD_REOWN_PROJECT_ID` | GitHub Actions repository Variable，Web 构建时映射为 `NEXT_PUBLIC_REOWN_PROJECT_ID`；目前未配置 |

GitHub Secrets 名称已确认存在，不读取其值。重新配置通过 GitHub Repository Settings → Secrets and variables → Actions，使用独立部署 key；known_hosts 指纹先通过可信渠道核对，不关闭 host-key 校验。

个人 Mac 日常连接使用 `ssh chainpass`：

```sshconfig
Host chainpass
    HostName 124.71.227.47
    User root
    IdentityFile ~/.ssh/chainpass_server
```

个人 `chainpass_server` 与 GitHub `chainpass_github_actions` key 保持独立；workflow 在 Runner 把 Actions key 写入临时环境的 `~/.ssh/chainpass_production`。服务器 runtime Secret 不由普通 CD 创建或轮换，首次配置/轮换仍为经授权的人工操作。

Web 的 `NEXT_PUBLIC_*` 是 **build-time** 值。CD 构建时注入最终 API/Auth/App origin、chain/contract 与 Reown Project ID。仅修改服务器 env 或重启旧 Web 容器不会更新 bundle；公开 URL、Reown 值改变也需要新镜像发布。

## 6. 数据库、备份与回滚边界

Prisma schema 变化在开发机生成 migration，提交并进入 main 后，由 migration image 执行 `prisma migrate deploy`。正常发布不创建 migration、不 reset 数据、不更换 volume。

已有 `pre-20261006-0530d3b.dump` 约 28 KiB，custom-format header/TOC 可读取。当前 CD 只检查 dump 命令成功和文件非空，不做恢复演练、异机备份或定期备份；这些仍需人工管理。Docker volume 与同机备份都不能抵御整机丢失。

Application rollback **不等于 database rollback**。切旧镜像不会反向执行 Prisma migration。优先 forward repair；仅在明确审核停机/数据丢失影响后恢复数据库。回滚步骤见 [Operations](./OPERATIONS.md#5-回滚仅在明确授权后执行)。

## 7. Ethereum 与仍需人工的工作

- 当前合约：`0xbA3e9bCbe448E928c5e71f4bE6415E7e0e3E5ABb`，Ethereum Sepolia `11155111`。
- issuer：`0xECd97d9A3fee1a726B48fd6E2635949E40C097aC`。API 使用 runtime RPC/key Mint；合约公开证据见 [sepolia.json](../contracts/deployments/sepolia.json)。
- 前端/后端/Prisma migration 可走应用 CD；Solidity 修改需要独立测试、部署、ABI 同步和地址配置，不由此 workflow 重部署。
- 仍为人工：点击 DEPLOY、Secrets/SSH key 管理、系统 Nginx 修改、Domain/HTTPS、异机备份与恢复演练、回滚、磁盘/历史 release 保留，以及 Mobile 发布与真实业务验收。
- 将来启用 HTTPS 时需同时审核两层 forwarded-proto、Better Auth origin、证书和最终 Web build URL，不能只改公网地址并宣称 TLS 已完成。

## 8. Emergency fallback — Mac/CI 构建，服务器只运行

仅在默认 GitHub CD 不可用且获得明确发布授权时使用。**服务器不构建镜像。** 从开发机仓库根目录，选择新 tag 和最终公开配置：

```bash
set -euo pipefail
export IMAGE_TAG="<new-release-tag>"
export PUBLIC_URL=http://124.71.227.47
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

确认全部是 linux/amd64。使用既有 ignored local env，不打印或覆盖它；先完整验证隔离的本地生产栈：

```bash
DOCKER_DEFAULT_PLATFORM=linux/amd64 \
CHAINPASS_COMPOSE_PROJECT=chainpass-local IMAGE_TAG="${IMAGE_TAG}" \
CHAINPASS_ENV_FILE="$PWD/infra/.env.production.local" \
CHAINPASS_BIND_ADDRESS=127.0.0.1 CHAINPASS_HTTP_PORT=8080 \
CHAINPASS_SMOKE_URL=http://127.0.0.1:8080 \
  bash infra/scripts/deploy.sh
```

完成标准：PostgreSQL/API/Web/Nginx healthy、migration 成功、API health 为 database connected、Web HTTP 200。本地检查不证明最终公网 origin 的浏览器 Auth 成功，生产仍需验收。

验证后在开发机打包与传输；不要将 env/keystore/数据库放入包：

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
ssh chainpass "mkdir -p /home/chainpass/releases/${IMAGE_TAG}"
scp "${release_dir}/${archive}" "${release_dir}/SHA256SUMS" \
  "${release_dir}/docker-compose.prod.yml" "${release_dir}/teaching-server.conf" \
  "${release_dir}/deploy.sh" "chainpass:/home/chainpass/releases/${IMAGE_TAG}/"
```

服务器选择相同 tag，`sha256sum --check SHA256SUMS` 成功后再 `gzip -dc ... | docker load`。按 Operations 先备份，设置明确 IMAGE_TAG，再使用 release helper；健康通过后人工核对/持久化 env tag。只加载镜像不表示部署完成。

共享服务器禁区与故障停止条件统一见 [Operations](./OPERATIONS.md#7-danger--do-not)；任何紧急路径都不允许停其他项目、清理全局 Docker 或切回服务器 build。
