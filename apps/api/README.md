# ChainPass API

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

NestJS 12 + Better Auth 1.7 + Prisma 7 / PostgreSQL 的业务入口。没有第二套 JWT 服务，也未接入原 Nest 模板提及的 Mau / Observe。身份与契约见[认证](../../docs/AUTH_ARCHITECTURE.md#zh)、[API 契约](../../docs/API_CONTRACT.md#zh)。

### 运行

首次配置时从 `apps/api/.env.example` 复制到被 Git 忽略的 `.env`，已有配置不要覆盖。分别配置 Auth / QR 密钥；模板数据库凭证仅供本地，不是生产 Secret，不要输出完整 env。

从仓库根目录执行：

```bash
pnpm install --frozen-lockfile
docker compose -f infra/docker-compose.yml up -d postgres
pnpm --filter api exec prisma validate
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec prisma generate
pnpm --filter api dev
```

API 默认端口 3001。`/health` 执行 `SELECT 1`；Swagger 位于 `/docs` 和 `/docs/openapi.json`。Auth 路径为 `/api/auth/*`；业务直连没有 `/api` 前缀，生产网关对普通业务添加 `/api`。

### 代码边界

`events/ticket-types/invitations/passes/wallets/check-ins/blockchain` 按功能组织；Auth 是唯一身份系统，database 提供 PrismaPg。生成的 Client 位于 `src/generated/prisma`，不手工修改。DTO / OpenAPI / Zod / Client 同步维护，不向 UI 导出 Prisma Model。

organizer、owner、verifier 来自 Session。角色、归属和业务状态由服务器检查，不能只依赖客户端。默认邀请制、原子领取和核销由 API 负责。Mint signer 只在 API 运行时；Off-chain 领票无需先绑定钱包。

### 验证

```bash
pnpm --filter api test
pnpm --filter api lint
pnpm --filter api build
pnpm --filter api test:e2e
```

E2E 必须使用隔离测试 PostgreSQL，先执行 migrate deploy；不能对保留数据的开发库或生产库运行测试清理。普通 E2E 替换 BlockchainService；`BLOCKCHAIN_INTEGRATION=true` 才测试真实链调用，应显式配置隔离 Anvil，不能误用 Sepolia 密钥。

生产入口为 `node dist/main.js`，迁移使用独立镜像；流程见[架构与部署](../../docs/ARCHITECTURE_AND_DEPLOYMENT.md#zh)。本地 Demo 账号和一次性 Admin 初始化边界见 [Web 说明](../web/README.md#zh)，凭证不进入文档。

---

<a id="en"></a>

## English

NestJS 12/Better Auth 1.7/Prisma 7/PostgreSQL own business rules. There is no parallel JWT service or installed Mau/Observe infrastructure. See [Auth](../../docs/AUTH_ARCHITECTURE.md#en)/[API](../../docs/API_CONTRACT.md#en).

Copy the example to ignored apps/api/.env, configure separate Auth/QR secrets, then from root:

```bash
pnpm install --frozen-lockfile
docker compose -f infra/docker-compose.yml up -d postgres
pnpm --filter api exec prisma validate
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec prisma generate
pnpm --filter api dev
```

Default3001; /health executes SELECT1, Swagger /docs(/openapi.json); Auth /api/auth/*, business direct paths lack gateway /api. Features colocate controllers/DTOs/services; generated/prisma is not hand-edited. Session derives organizer/owner/verifier; API enforces role/ownership/state and atomic invitation/stock/admission.

Run api test/lint/build/test:e2e. E2E requires an isolated migrated Postgres; never fixture-clean production/preserved dev data. Ordinary chain service is replaced; BLOCKCHAIN_INTEGRATION=true writes a real chain and requires deliberate isolated Anvil configuration.

Production uses node dist/main.js and separate migration image. See [delivery](../../docs/ARCHITECTURE_AND_DEPLOYMENT.md#en)/[local demo setup](../web/README.md#en). No credentials belong here.
