# ChainPass 工程架构 / Engineering Architecture

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

本文规定模块职责和依赖边界；业务细节见[技术说明](./TECHNICAL_DETAILS.md#zh)，源码到生产见[架构与部署](./ARCHITECTURE_AND_DEPLOYMENT.md#zh)。以当前代码为准，不把目录存在当作功能验收。

### 仓库组成

```text
apps/
  web/            Next.js 产品
  api/            NestJS 业务、Auth、Prisma、链集成
  mobile/         Expo Native 三角色体验
  telegram-mini/  实验：Mini App
  telegram-bot/   实验：grammY Bot
  extension/      实验：WXT Popup
  discord-bot/    实验：discord.js Bot
  wechat-mini/    实验：Taro WeChat
packages/
  api-client/     集中 API transport/错误/响应校验
  schemas/        共享 Zod 边界
  web3/           公共 ABI、链、地址、hash/Explorer
  config/         工程配置
contracts/        独立 Foundry 工程
infra/            开发数据库、生产容器与脚本
```

pnpm workspace 为 apps/_、packages/_；contracts 不是 pnpm package。默认 root dev/build/lint/typecheck/test 只包括 Web/API/Mobile/packages。实验端 opt-in，见[实验平台](./EXPERIMENTAL_PLATFORMS.md#zh)。

### API Feature-first

`src` 内 auth/database/health 是基础边界；events、ticket-types、invitations、passes、wallets、check-ins、blockchain 按 Feature 组织 Controller/DTO/Service/Module。generated/prisma 是生成代码，不手改。不提前创建通用 Repository、Event Bus 或 common 抽象。

NestJS 决定权限、归属、库存、邀请额度、核销与 Mint 编排。OpenAPI/DTO 描述接口，共享 Zod/Client 同步；当前 Client 集中手工维护，生成流水线未实现。

### 数据流与事实来源

```text
Web / Mobile → api-client → NestJS → Prisma → PostgreSQL
                                 ↘ BlockchainService → Sepolia
```

Better Auth User 是唯一身份；Wallet 只是已签名关联。DB 保存完整业务，链仅存 Pass identity/owner。邀请领取资格和现场 QR 独立；默认邀请制、事务消费 quota/stock、动态 HMAC QR、原子核销均在 API，UI 不复制规则。

链上成功/DB 失败用 Pass hash 映射与事件恢复，不是跨系统原子事务。ON_CHAIN_VERIFIED 列表状态代表持久化数据，不是每次实时 RPC 验签。

### 客户端

Web：Next.js 16/React 19、Base UI shadcn、Tailwind 4、React Query、RHF/Zod/Sonner、Reown/Wagmi。路由门禁是 UX，API 是安全边界。公开/owner/Merchant/Admin 页面分别消费受限接口。

Mobile：Expo 57/React Native 0.86、Expo Router 角色导航、NativeWind 4、React Query、Reown/Ethers。Session 与邀请交接分别使用 SecureStore；钱包连接元数据才在 AsyncStorage。私有 cache 按 identity 隔离，后台停止 QR/相机工作。设备验收不能用 export 代替。

### 依赖规则

- Web/Mobile 不导入 Prisma、API src、数据库内部模型；API 不依赖 UI。
- packages 不反向依赖 apps；contracts 不导入应用。
- 共享纯逻辑需稳定边界与真实消费者；UI 默认各端维护。
- Web3 包无私钥/signer/DB；客户端永远无 issuer/Auth/QR Secret。
- 不复制第二套 User、Session、DTO 或核销规则。遵守各应用 AGENTS.md。

### 基础设施与限制

生产四常驻服务为 Postgres/API/Web/Docker Nginx，migrate one-shot。GitHub Runner 构建 amd64、归档/SCP，服务器只 load/--no-build；Host Nginx80→loopback18081，DB/API/Web 无 hostports。Secrets 只 runtime 注入；合约与 Mobile 分发独立。

尚需审慎处理 issuer key 托管、同步 receipt 占用 DB 连接、RPC 日志恢复限制、TLS、异机备份与物理设备验收。不要为解决未观察需求预建微服务/队列/集群。

---

<a id="en"></a>

## English

This defines module/dependency boundaries. See [internals](./TECHNICAL_DETAILS.md#en) and [delivery](./ARCHITECTURE_AND_DEPLOYMENT.md#en). Directory presence is not acceptance.

### Repository

apps contains core Web/API/Mobile and five experimental Telegram/Discord/Extension/WeChat clients. packages contains api-client/schemas/web3/config. contracts is standalone Foundry; infra owns Docker/Nginx/scripts. pnpm discovers apps/* and packages/*; default root tasks filter core/shared workspaces, experiments are opt-in.

API src has auth/database/health infrastructure and feature-local events/ticket-types/invitations/passes/wallets/check-ins/blockchain controllers/DTOs/services/modules. generated/prisma is generated. No speculative generic repository/event bus/common layer is required.

NestJS owns authorization, resource ownership, stock/quota/admission and mint orchestration. DTO/OpenAPI, shared Zod and the currently handwritten client must stay consistent; automatic client generation is absent.

### Data and identity

```text
Web / Mobile → api-client → NestJS → Prisma → PostgreSQL
                                 ↘ BlockchainService → Sepolia
```

Better Auth User is the only identity; Wallet is a verified association. DB owns full business state; chain owns Pass identity/owner. Invitations and entry QR are separate. Clients reuse invitation claim, HMAC QR and atomic check-in rules.

Mapping/log recovery handles chain-success/DB-failure, not cross-system atomicity. Owner ON_CHAIN_VERIFIED means persisted metadata, not fresh RPC verification per render.

### Clients and rules

Web uses Next.js 16/React 19, Base UI shadcn/Tailwind 4, Query, RHF/Zod/Sonner and Reown/Wagmi. Mobile uses Expo 57/React Native 0.86, role Router, NativeWind 4, Query and Reown/Ethers. Native Session and invitation handoff use separate SecureStore data; AsyncStorage is wallet connection metadata only. Private caches isolate identities; QR/camera stop in background. Exports do not prove devices.

Web/Mobile never import Prisma/API src; API never imports UI; packages never depend on apps; contracts do not import application code. Share stable pure boundaries with real consumers, not mandatory UI. web3 holds no signer/private key/database. Do not duplicate User/Session/DTO/admission rules. Follow application AGENTS.md.

### Infrastructure and limits

Postgres/API/Web/Nginx are long-running; migrate is one-shot. Runner builds amd64 archives/SCP; host only loads/no-build. System80→loopback18081; DB/API/Web have no host ports. Secrets are runtime-only; contract/Mobile release is separate.

Issuer custody, synchronous receipt/DB occupancy, provider log limitations, TLS, off-host restore and physical-device acceptance remain concerns. Do not prebuild microservices/queues/clusters for unobserved needs.
