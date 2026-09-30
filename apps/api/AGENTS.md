# ChainPass API Development Guide

本文件适用于 `apps/api/**`，补充仓库根目录的 `AGENTS.md`。产品范围、身份架构、API Contract 和开发优先级仍分别以根目录及 `docs/` 下的专题文档为准；本文件只定义 NestJS API 的落位和修改方式。

## 开始前

1. 先读取仓库根目录 `AGENTS.md`。
2. 涉及身份、Session、Role 或 Ownership 时读取 `../../docs/AUTH_ARCHITECTURE.md`。
3. 涉及路由、DTO、错误或调用方时读取 `../../docs/API_CONTRACT.md`。
4. 涉及 Prisma、Blockchain 或跨应用依赖时读取 `../../docs/ARCHITECTURE.md`。
5. 检查 `git status --short`、目标 Feature、`src/app.module.ts`、相关 E2E 和共享包后再修改；当前代码优先于历史说明。

完成本步骤的标准：现有路由、operationId、Session 身份来源、Ownership 规则、数据约束和调用方均已找到，未确认的行为明确标记为未知。

## Feature-first 落位

业务能力按 Feature 聚合，不按技术类型建立全局 `controllers/` 或 `services/`：

```text
src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  <feature>.service.ts
  dto/
```

- Controller、Service、仅该 Feature 使用的 DTO、Pipe 和映射逻辑放在同一 Feature 内。
- 新 Feature 通过自己的 Nest Module 注册 Controller/Provider，再由 `AppModule` 组合；`AppModule` 不承载业务实现。
- 跨 Feature 调用优先依赖对方 Module 导出的明确能力。先检查依赖方向，保持单向关系；不要用 `forwardRef()` 掩盖可避免的循环依赖。
- `auth/` 保存 Better Auth 配置和统一权限；`database/` 保存 Prisma/PostgreSQL 基础设施；`blockchain/` 保存链交互；`generated/` 只保存 Prisma 生成代码。
- 只有至少两个 Feature 已经使用且语义稳定的能力才进入 `common/`。单 Feature helper 留在 Feature 内，不创建空目录或通用杂物文件。
- 命名遵循现有复数目录和 kebab-case，例如 `ticket-types/`、`passes/`、`wallets/`；REST path 不因内部重命名而改变。

新增 Verify 或 Check-in 时，先从最小结构开始，例如：

```text
src/check-ins/
  dto/
  check-ins.controller.ts
  check-ins.module.ts
  check-ins.service.ts
```

只有真实实现需要时才增加其他文件。

## 稳定接口

- Better Auth `User`、Session 和 `admin` / `merchant` / `user` 是唯一身份体系。可信用户 ID 来自 `session.user.id`，客户端不能提交 `ownerId`、`organizerId`、`verifiedById`、`checkedInById` 或可信 Role。
- 授权顺序保持为 `Session → Permission → Ownership → Business Rule`。角色能力复用 `src/auth/permissions.ts`，资源归属在业务 Feature 内校验。
- Controller 保持现有 URL、HTTP status、错误结构和显式 operationId。移动或重命名 Controller 时检查 `/docs/openapi.json`；Nest 自动生成的 operationId 也必须保持兼容。
- Request/Response DTO 与 Swagger metadata 同步。Prisma Model 不直接作为外部响应，不把内部字段整体暴露给客户端。
- 跨 Web/API 边界的稳定 Schema 复用 `@chainpass/schemas`；业务调用集中在 `@chainpass/api-client`。接口变更必须在同一变更中更新 Contract、Client、调用方和测试。
- 当前 API 使用 ESM、NodeNext 和 `"type": "module"`。所有本地 TypeScript import 保留运行时 `.js` suffix。

## Prisma 与 Blockchain

- Prisma Client 从 `src/database/prisma.ts` 导入。不要在 Feature 中创建第二个 Client，也不要手改 `src/generated/prisma/**`。
- 纯目录、命名或 import 重构不修改 `prisma/schema.prisma`，也不创建 migration。
- 业务数据变化需要 Prisma migration 时，先核对现有约束和 Better Auth 模型，再依次执行 validate、migration、generate；禁止创建第二套 User。
- Blockchain Service 的 signer、RPC、receipt、recovery 和环境变量语义保持集中在 `src/blockchain/`。数据库 Claim 与链上 Mint 仍是两个独立步骤。
- ABI、chain config、address normalization 和 Pass hash 规则复用 `@chainpass/web3`，不在 API 内复制 ABI 或硬编码密钥。

## 修改流程

1. 记录基线：运行目标测试、API build 和 lint，区分既有失败与本次回归。
2. 沿现有调用链修改：`Controller → Service → Prisma/Blockchain → DTO/OpenAPI → shared client → caller`。
3. 将改动留在所属 Feature；只有观察到真实复用才抽取共享能力。
4. 测试保持业务语义不变。结构调整只修 import 和测试落位，不弱化权限、库存、幂等或错误断言。
5. 检查路由表和 OpenAPI operationId，确认 Auth endpoints 与全部既有业务路径仍存在。
6. 审查 `git diff --stat`、`git diff` 和 `git diff --check`。结构任务的大多数变更应是 move、rename、module registration 和 import。

## 验证门禁

按改动范围至少运行：

```bash
pnpm --filter api test
pnpm --filter api build
pnpm --filter api lint
pnpm --dir apps/api exec prisma validate
```

数据库或业务流程改动还必须在隔离的 PostgreSQL 上运行相关 `test/*.e2e-spec.ts`。注意：当前默认 `pnpm --filter api test` 只发现普通 `*.spec.ts`，不能据此声称 Events、TicketTypes、Passes、Wallets 或 Mint E2E 已通过；必须确认测试输出中实际列出了目标 E2E 文件和用例数量。

Contract 或跨包改动继续运行：

```bash
pnpm --filter web build
pnpm --filter @chainpass/api-client typecheck
pnpm --filter @chainpass/schemas typecheck
pnpm --filter @chainpass/web3 typecheck
pnpm typecheck
pnpm build
```

涉及合约或 Blockchain integration 时另行运行 Foundry/Anvil 验证；没有 RPC、合约地址或 signer 配置时明确报告未执行项，不伪造链上结果。

完成标准：相关自动化测试真实执行并通过，OpenAPI 与调用方一致，未出现未授权的 API/数据库/鉴权变化，工作区没有 Secret、`.env`、生成垃圾或无关改动。
