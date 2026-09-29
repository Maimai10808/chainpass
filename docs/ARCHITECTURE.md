# ChainPass Engineering Architecture

本文描述当前仓库的真实工程结构、稳定边界与近期目标。它不把空包、规划中的业务模块或尚未部署的合约写成已完成功能。

产品定义见 [PRODUCT_BRIEF.md](../PRODUCT_BRIEF.md)，身份体系见 [AUTH_ARCHITECTURE.md](./AUTH_ARCHITECTURE.md)，接口协作见 [API_CONTRACT.md](./API_CONTRACT.md)，MVP 优先级见 [DEVELOPMENT_SCOPE.md](./DEVELOPMENT_SCOPE.md)。

## 1. 当前成熟度

截至当前仓库状态：

- Monorepo、Next.js、NestJS、Expo、Foundry、PostgreSQL 与四个共享包的目录已经建立。
- Better Auth 已接入 API、Web 与 Mobile；Prisma 在现有 Auth 模型上增加了关联 Better Auth `User` 的 MVP `Event` 模型。
- API 已实现 `POST /events` Vertical Slice，并在 `/docs` 与 `/docs/openapi.json` 暴露最小 Swagger/OpenAPI Contract；TicketType、Pass、CheckIn 业务模块尚未实现。
- Web 已实现 `/merchant/events/new` 创建页；其余票务主流程和 Mobile 业务 UI 尚未实现。
- `@chainpass/api-client` 与 `@chainpass/schemas` 已承载 Create Event Contract 并由 Web/API 消费；`@chainpass/web3` 入口仍为空。
- Solidity 合约已有早期 ERC-721 `ChainPass`，支持创建链上 Event、钱包自助 Claim/Mint 和 Organizer Check-in；尚无测试、部署脚本、部署地址、ABI 发布或应用集成。
- `infra/docker-compose.yml` 当前只启动本地 PostgreSQL；Nginx、Web/API 容器与生产部署尚未实现。

以上状态是后续实现的起点，不是目标能力已经交付的声明。

## 2. Monorepo 结构

```text
apps/
  web/          Next.js Web 应用
  api/          NestJS API、Better Auth、Prisma
  mobile/       Expo / React Native 应用

packages/
  api-client/   Web 与 Mobile 的统一业务 API Client
  schemas/      真正跨边界共享的 Zod Schema / Type
  web3/         ABI、地址、链配置和公共 Web3 类型
  config/       共享 TypeScript 等工程配置

contracts/      Solidity / Foundry 合约工程
infra/          本地基础设施与后续部署入口
docs/           跨应用工程约束
```

根目录使用 pnpm workspace 与 Turborepo。Workspace 当前只包含 `apps/*` 和 `packages/*`；`contracts` 是独立 Foundry 工程，不是 pnpm package。

## 3. Apps 职责

### `apps/web`

当前技术栈为 Next.js 16、React 19 与 Tailwind CSS 4。现有代码包含 Better Auth React Client 和 Auth 测试页面。

目标职责：

- 商家与平台管理界面；
- Event、Ticket、领取与核销数据的 Web 视图；
- 用户侧必要的 Web 能力；
- Web3 交互 UI；
- 消费 `@chainpass/api-client` 与 `@chainpass/web3`。

Web 通过 API/Client 访问业务，不直接访问 Prisma、PostgreSQL 或导入 `apps/api` 实现。修改 Web 前同时遵守 `apps/web/AGENTS.md`。

### `apps/api`

当前技术栈为 NestJS 12、Prisma 7、PostgreSQL、Better Auth 1.7 与 `@thallesp/nestjs-better-auth`。Better Auth Server、角色权限定义与 Prisma Adapter 已位于此应用。

目标职责：

- ChainPass 核心业务规则与授权；
- Event、TicketType、Pass、CheckIn 等业务数据；
- PostgreSQL/Prisma 数据一致性；
- Blockchain integration、交易记录与必要的链上状态协调；
- OpenAPI/Swagger 的业务 API 事实来源。

API 不依赖 Web 或 Mobile，不接受客户端自报的可信用户标识。

### `apps/mobile`

当前技术栈为 Expo SDK 57、React Native 0.86、Expo Router 与 React 19。现有代码包含 Better Auth Expo Client、SecureStore 和 Auth 测试页。

目标职责：

- 用户浏览活动与领取 Pass；
- My Passes、Pass Detail 与 QR；
- 必要的现场 Scanner 体验；
- Better Auth Expo Client 与 Web3 用户交互；
- 消费与 Web 相同的业务 API Contract。

Mobile 不实现服务端业务规则，不导入 NestJS/Prisma 实现。修改 Mobile 前同时遵守 `apps/mobile/AGENTS.md`。

## 4. Packages 职责

这些包仍按需逐步实现。下面定义允许进入各包的边界，而非完整能力清单。

### `@chainpass/api-client`

- 承载由 NestJS OpenAPI 生成或以同一 Contract 集中维护的 API Client；
- 统一处理 base URL、Session/Cookie 传递、序列化、错误类型与响应类型；
- 由 Web 和 Mobile 共同消费；
- 不包含 UI、Prisma Model 或服务端业务实现。

### `@chainpass/schemas`

- 使用 Zod 保存真正跨进程或跨应用复用的输入/输出 Schema；
- 只导出稳定的边界类型，不镜像全部 Backend Domain Model；
- 不作为第二套 API Contract，也不承载仅服务端使用的内部实体。

### `@chainpass/web3`

- 发布经合约构建/部署流程确认的 ABI；
- 保存按网络区分的 Contract Address 与 Chain Config；
- 提供 Web、Mobile、API 都能安全消费的公共 Web3 类型和纯配置；
- 不保存私钥、服务端 signer 或业务数据库访问代码。

### `@chainpass/config`

- 维护多个 workspace package 确实共用的 TypeScript 等工程配置；
- 不承载运行时业务配置或密钥。

共享逻辑进入 `packages/*` 的条件是至少两个真实消费者和稳定边界。Web 与 Mobile 的组件、导航和平台交互默认各自维护。

## 5. 数据与服务流

主要业务数据流：

```text
Web / Mobile
    ↓
@chainpass/api-client
    ↓
NestJS Controller / Service
    ↓
Prisma
    ↓
PostgreSQL
```

Create Event 已按该路径落地；后续 Vertical Slice 继续扩展同一 Client 和 Schema 边界，避免在两个客户端各自形成临时 Contract。

链上数据流目标：

```text
NestJS Blockchain Integration / authorized Web3 UI
    ↓
@chainpass/web3 configuration
    ↓
ChainPass Smart Contract
    ↓
Target EVM Network
```

Base Sepolia 是本阶段预期目标网络，但仓库当前没有 chain ID、RPC、部署脚本、合约地址或部署记录。相关信息写入 `@chainpass/web3` 并经过部署验证前，不得声称已部署到 Base Sepolia。

## 6. 数据职责边界

PostgreSQL/NestJS 是完整业务数据的 Source of Truth，负责用户关联、活动内容、票种、库存业务语义、领取记录、Pass 状态、核销详情和统计。

Blockchain 是可信资产层，负责 Pass 的链上 Token Identity、钱包 Ownership 与选择性的 Verification 记录。链上事件不是用户资料、运营字段或完整工作流状态的替代品。

当前合约同时保存链上 Event、mint 数量与 check-in 标记，这是早期合约实现。接入业务前必须明确数据库与链上的字段映射、写入顺序、失败补偿和状态对账；在决策完成前，不把两个来源都描述为同一字段的权威来源。

## 7. Authentication 数据流

Authentication 不在本文重新定义。唯一规范是 [AUTH_ARCHITECTURE.md](./AUTH_ARCHITECTURE.md)：

```text
Web / Mobile
    ↓
Better Auth Client
    ↓
NestJS-hosted Better Auth
    ↓
Prisma
    ↓
PostgreSQL
```

Better Auth `User` 是业务身份主体；Wallet 是可关联的身份/账户，不是第二套 User。业务接口从已验证 Session 派生用户 ID，再执行 Role、Permission、Resource Ownership 和 Business Rule 检查。

## 8. Contracts 与 Infra

`contracts` 使用 Solidity 0.8.28、Foundry 和 OpenZeppelin。当前 `ChainPass.sol` 是 ERC-721 合约原型，应用层尚未集成。合约不依赖 `apps/*`；经确认的 ABI 和地址由构建/部署流程同步到 `@chainpass/web3`，不在各应用复制。

`infra` 当前只定义 PostgreSQL 17 的本地 Docker Compose 服务。Web、API、Nginx 或集群部署属于后续增量；三天 MVP 阶段以可重复的单体 API + PostgreSQL + 客户端部署为目标，不预先设计集群、服务网格或消息基础设施。

## 9. Dependency Rules

允许的依赖方向：

```text
apps/web ─────┐
apps/mobile ──┼──> packages/*
apps/api ─────┘

apps/api ──> Prisma / PostgreSQL
apps/* ────> @chainpass/web3 ──> deployed contract interface
```

强制规则：

- `apps/web`、`apps/mobile` 不导入 Prisma Client、数据库 Schema 或 `apps/api/src/*`。
- `apps/api` 不导入 Web/Mobile 页面、组件或平台代码。
- `packages/*` 不反向依赖 `apps/*`。
- `contracts` 不依赖应用代码；应用只通过 ABI、地址和链配置依赖已部署合约。
- `@chainpass/schemas` 与 `@chainpass/api-client` 不复制同一 DTO 的两套定义；生成链路或维护规则必须指定唯一来源。
- UI 不因“共享”进入通用包；只有无平台依赖、被多个消费者使用且边界稳定的逻辑才抽取。

## 10. 尚待决策的集成问题

进入 Mint/Verify/Check-in Vertical Slice 前需要明确：

1. 交易由用户钱包签名、商家钱包签名，还是 API relayer/signer 提交；私钥与 gas 责任随该决策确定。
2. 数据库 Event/TicketType/Pass ID 如何映射到当前合约的 `eventId`/`tokenId`，尤其是当前合约没有 TicketType 概念。
3. DB 写入与链上交易的状态机、失败重试、幂等键、交易确认数和对账策略。
4. Check-in 以数据库状态为准还是要求同步上链，以及当前合约仅允许 organizer 地址调用如何对应 Better Auth merchant。
5. Base Sepolia 的部署流程、地址发布与环境配置所有权。

这些问题需要在实现对应 Vertical Slice 时做最小明确决策；不要先引入通用事件总线或复杂分布式架构。
