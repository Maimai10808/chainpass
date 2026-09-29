# ChainPass Repository Guide

本文件适用于整个 ChainPass Monorepo。进入子目录后，同时遵守距离目标文件最近的 `AGENTS.md`；子目录规则只补充具体框架约束，不能覆盖本文定义的产品、身份、架构和 Scope 边界。

## 开始前

任何实现前，按任务范围阅读以下事实来源：

- 产品、业务模型或链上职责：[PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md)
- Authentication、Session、Role、Wallet Identity：[docs/AUTH_ARCHITECTURE.md](./docs/AUTH_ARCHITECTURE.md)
- 跨应用结构、依赖方向、数据库与合约边界：[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- API、DTO、OpenAPI 或 Client：[docs/API_CONTRACT.md](./docs/API_CONTRACT.md)
- 功能优先级、Definition of Done、非目标：[docs/DEVELOPMENT_SCOPE.md](./docs/DEVELOPMENT_SCOPE.md)

文档描述与代码不一致时，以当前代码为事实，并在同一变更中修正文档或明确记录差异。不要根据框架惯例猜测本仓库状态。

## 主业务链

ChainPass 是链上数字票务与核销平台。当前唯一最高优先级是：

```text
Create Event → Issue Ticket → Claim Pass → Mint → My Pass → Verify → Check-in
```

围绕可演示的端到端 Vertical Slice 工作。新增能力必须直接服务该主链；超出范围的想法先记录并请求确认。

## 强制边界

- Better Auth 是唯一 Authentication、User、Session 和基础 Role 体系。Web、Mobile、API 与未来 Wallet Login 均扩展现有身份，不创建平行 User/Auth/Session。
- 可信身份来自 Better Auth Session。`ownerId`、`organizerId`、`verifiedById` 等身份字段由 `session.user.id` 派生，不信任客户端自报。
- PostgreSQL、Prisma 与 NestJS 承载完整业务事实；Blockchain 只承载 Pass Identity、Ownership 和必要 Verification 记录，不作为完整业务数据库。
- NestJS API Contract 是服务端接口事实来源。维护 DTO 与 OpenAPI，再由 `packages/api-client` 向 Web/Mobile 提供统一 Client；调用方不各自复制 DTO。
- `apps/web` 和 `apps/mobile` 不直接访问数据库或导入后端实现；`apps/api` 不依赖任一 UI 应用；`packages/*` 不反向依赖 `apps/*`；`contracts` 不依赖应用代码。
- ABI、Contract Address、Chain Config 和共享 Web3 类型通过 `@chainpass/web3` 暴露。部署事实未写入该包前，不假定网络或地址已经可用。
- 仅在至少两个消费者存在且边界稳定时抽取到 `packages/*`。共享 Contract/Schema 可以跨端，Web 与 Mobile UI 各自维护。
- 保持现有 pnpm/Turborepo 结构。按主链做最小改动，不为三天 Hackathon 引入微服务、CQRS、Event Bus、Kafka、RabbitMQ、Kubernetes、复杂 Repository/Domain Layer，或无明确证据的 Redis。
- 不擅自扩大产品 Scope，不用“架构完整度”替代可运行的主流程。

## 修改流程

1. 读取相关专题文档、最近的 `AGENTS.md`、目标代码与配置，确认当前实现和缺口。
2. 选择主链中的一个 Vertical Slice：`DB → API → Contract/Client → Web/Mobile → 最小测试`。
3. 接口变化同步更新 DTO、OpenAPI、`packages/api-client`、调用方和必要测试；身份变化同步核对三端 Better Auth 配置。
4. 仅触碰当前任务需要的文件。保留用户的无关改动，不手改生成产物来掩盖源 Contract 漂移。
5. 执行与改动范围相称的 lint、typecheck、test/build；明确区分已验证事实和未验证假设。

完成标准与当前优先级以 [docs/DEVELOPMENT_SCOPE.md](./docs/DEVELOPMENT_SCOPE.md) 为准。
