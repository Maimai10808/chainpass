# ChainPass Engineering Architecture

本文描述当前仓库的真实工程结构、稳定边界与近期目标。它不把空包、规划中的业务模块或尚未部署的合约写成已完成功能。

产品定义见 [PRODUCT_BRIEF.md](../PRODUCT_BRIEF.md)，身份体系见 [AUTH_ARCHITECTURE.md](./AUTH_ARCHITECTURE.md)，接口协作见 [API_CONTRACT.md](./API_CONTRACT.md)，MVP 优先级见 [DEVELOPMENT_SCOPE.md](./DEVELOPMENT_SCOPE.md)。

## 1. 当前成熟度

截至当前仓库状态：

- Monorepo、Next.js、NestJS、Expo、Foundry、PostgreSQL 与四个共享包的目录已经建立。
- Better Auth 已接入 API、Web 与 Mobile；Prisma 在唯一的 Better Auth `User` 上关联 Event、Pass、一个已验证 Wallet 及短期 Wallet Challenge。
- API 已实现 Create Event、Issue TicketType、Publish/Discovery、Claim/My Passes、Wallet Binding、Blockchain Mint、Merchant Verify/Check-in 与短时动态 QR Credential，并在 `/docs` 与 `/docs/openapi.json` 暴露 Swagger/OpenAPI Contract。
- Web 已实现 Merchant 活动管理、公开活动、Claim、`/my-passes` 的钱包连接/签名绑定与 Mint 状态、用户 Pass 动态 QR，以及 `/merchant/check-in` 的手工/摄像头核验。
- Mobile 已实现 Better Auth 登录注册、公开活动列表/详情、Claim、My Passes、Pass Detail 与服务端签发的动态 QR；Merchant Scanner、Wallet Binding 和 Mint 操作仍只在 Web 提供。
- `@chainpass/api-client` 与 `@chainpass/schemas` 承载业务边界；`@chainpass/web3` 共享实际合约 ABI、Ethereum Sepolia 配置、地址规范化和 Pass Hash 规则。
- Solidity `ChainPass` 是 issuer-only、non-transferable ERC-721，按 database Pass hash 防重复 Mint；当前版本已部署至 Ethereum Sepolia，公开地址与广播记录见 `contracts/deployments/sepolia.json`。
- `infra/docker-compose.yml` 启动本地 PostgreSQL；生产 Compose 已在华为云 ECS 运行，system Nginx `:80` 代理 loopback Docker Nginx `:18081`，Web/API/PostgreSQL 无 host-port 映射。GitHub CI 与人工触发的 Production Deploy 已有成功运行；当前 release、分支差异与运行记录见 [DEPLOYMENT.md](./DEPLOYMENT.md)，日常操作见 [OPERATIONS.md](./OPERATIONS.md)。

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
infra/          本地 PostgreSQL 与单服务器 Docker/Nginx 部署入口
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

API 源码按 Feature 聚合 Controller、Service、DTO 与 Nest Module，应用入口只负责组合模块：

```text
apps/api/src/
  app.module.ts
  main.ts
  auth/          Better Auth 配置与权限
  database/      Prisma Client / PostgreSQL adapter
  health/        根级应用端点
  events/        Event 创建、管理、发布与公开查询
  ticket-types/  TicketType 创建与管理查询
  passes/        Claim、My Passes 与 Mint orchestration
  check-ins/     Pass Verify、Event Ownership 与原子核销
  wallets/       Wallet challenge、验签与绑定
  blockchain/    RPC、issuer signer、receipt 与链上恢复
  generated/     Prisma 生成代码
```

Feature-specific DTO 留在各 Feature 内；只有被多个 Feature 实际复用的能力才进入共享基础设施目录。当前没有为未来需求预建通用 `common/` 抽象。

### `apps/mobile`

当前技术栈为 Expo SDK 57、React Native 0.86、Expo Router、React 19 与 TanStack Query。Better Auth Expo Client 使用 SecureStore 持久化 Session；业务请求统一经过 `@chainpass/api-client`，原生端从同一 Auth Client 读取 Cookie，不在页面维护第二套 Token。

当前职责：

- 用户浏览活动与领取 Pass；
- My Passes、Pass Detail 与短时动态 QR；
- Better Auth Expo Client 身份体验；
- 展示 API 返回的链上状态与共享 Explorer 链接；
- 消费与 Web 相同的业务 API Contract。

Mobile 不实现服务端业务规则，不导入 NestJS/Prisma 实现。修改 Mobile 前同时遵守 `apps/mobile/AGENTS.md`。

Mobile 使用 Expo Router Native Tabs 提供 Discover、My Passes 与 Profile 三个主入口。TanStack Query 的稳定 key 为 `events`、`event/:id`、`my-passes` 与 `pass-verification-token/:id`；Claim 后刷新 Event Detail 与 My Passes，App 回到 foreground 时重新校验列表和动态 QR。QR payload 始终来自 API，Mobile 不持有签名 Secret。

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

动态 QR 只承载由 API 使用 HMAC-SHA256 签名、60 秒有效的临时 Credential。Scanner 验签并解析 `passId` 后回到现有 Verify/Check-in Service；数据库 Pass/CheckIn 始终是核验状态事实来源，二维码本身不修改业务状态，也不需要新增数据表。

Create Event、Issue TicketType、Publish/Discovery、Claim/My Passes、Wallet Binding、Mint、Merchant Verify/Check-in 与 Mobile User Experience 已按该路径落地；后续 Vertical Slice 继续扩展同一 Client 和 Schema 边界，避免在两个客户端各自形成临时 Contract。

当前链上数据流：

```text
NestJS Blockchain Service / platform issuer wallet
    ↓
@chainpass/web3 configuration
    ↓
ChainPass Smart Contract
    ↓
Target EVM Network
```

Ethereum Sepolia（chain ID `11155111`）是目标网络，RPC 由环境配置。当前 `ChainPass` 地址为 `0xbA3e9bCbe448E928c5e71f4bE6415E7e0e3E5ABb`；部署交易、区块、deployer、源码验证与 smoke mint 证据统一记录在 `contracts/deployments/sepolia.json`，应用运行时从各自环境变量读取该地址。

## 6. 数据职责边界

PostgreSQL/NestJS 是完整业务数据的 Source of Truth，负责用户关联、活动内容、票种、库存业务语义、领取记录、Pass 状态、核销详情和统计。

Blockchain 是可信资产层，负责 Pass 的链上 Token Identity、钱包 Ownership 与选择性的 Verification 记录。链上事件不是用户资料、运营字段或完整工作流状态的替代品。

每个 database Pass 通过 `keccak256(Pass.id)` 得到稳定 `passHash`，合约保存 `passHash → tokenId`。API 在 receipt 成功、解析 `PassMinted` 并验证 `ownerOf` 后写入 `chainId`、`contractAddress`、`tokenId` 和 `mintTxHash`；若链成功而数据库写入失败，重试会从合约映射和事件恢复，不会再次 Mint。

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

`contracts` 使用 Solidity 0.8.28、Foundry 和 OpenZeppelin。`ChainPass.sol` 由合约 owner 作为平台 issuer，按 Pass hash 唯一 Mint，并暂时禁止 transfer 以保持链上 owner 与 `Pass.ownerId` 一致。构建后的 ABI 由 `pnpm web3:sync-abi` 同步到 `@chainpass/web3`；private key 只存在 API/Foundry 服务端环境。

`infra` 保留 PostgreSQL 17 的开发 Compose，并提供生产 Compose：system Nginx 是公网入口，loopback Docker Nginx 的 `/` 代理 Next.js、`/api/*` 代理 NestJS，Web/API/PostgreSQL 仅通过 Docker network 通信。GitHub Actions 在 Runner 构建 linux/amd64 镜像，经 checksum/SSH 交付；服务器只 load 与 `--no-build` 启动，不构建。PostgreSQL health 通过后运行 `prisma migrate deploy`，再依次启动 API、Web 与 Docker Nginx；Secret 只通过服务器运行时环境注入。单服务器 Production Deploy 由人工确认触发，不引入集群或消息基础设施；system Nginx、HTTPS、回滚与 Secret 管理仍有人工边界，统一见部署文档。

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

Mint 的 MVP 决策已经落地：API issuer 支付 gas，database Pass ID 生成 `passHash`，receipt 一次确认后写回，合约映射承担最小恢复依据。Ethereum Sepolia 部署已由专用加密 keystore 完成，当前源码在 Sourcify 为 `exact_match`。后续仍需明确：

1. 生产环境 issuer key 的托管、访问审计与轮换责任。
2. 进入长期运行后是否需要独立 pending 状态或事件索引器；三天 MVP 不预先引入。

这些问题需要在实现对应 Vertical Slice 时做最小明确决策；不要先引入通用事件总线或复杂分布式架构。
