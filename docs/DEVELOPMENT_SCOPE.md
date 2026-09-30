# ChainPass Hackathon Development Scope

本文定义三天 Hackathon 的实现顺序、完成标准与明确非目标。产品语义以 [PRODUCT_BRIEF.md](../PRODUCT_BRIEF.md) 为准，工程边界见 [ARCHITECTURE.md](./ARCHITECTURE.md)，身份与接口规则分别见 [AUTH_ARCHITECTURE.md](./AUTH_ARCHITECTURE.md) 和 [API_CONTRACT.md](./API_CONTRACT.md)。

## 1. 唯一 P0

```text
Merchant Login
    ↓
Create Event
    ↓
Create / Issue Ticket
    ↓
User Browse Event
    ↓
Claim Pass
    ↓
Mint On-chain
    ↓
My Pass
    ↓
Verify Pass
    ↓
Check-in
```

目标不是代码量或模块数量最大，而是一条可以真实演示、状态一致、权限可信的完整 ChainPass 流程。不能直接推进该流程的工作默认降级。

## 2. 当前起点

已存在：

- Better Auth Server、Web/Mobile Client、Session、`admin`/`merchant`/`user` 权限定义；
- PostgreSQL Docker Compose 与 Better Auth Prisma 模型；
- Next.js、NestJS、Expo 应用骨架；
- Foundry ERC-721 `ChainPass` 原型；
- `api-client`、`schemas` 的 Create Event Contract，以及 `web3` 共享包骨架；
- Merchant Create Event Vertical Slice：Event 模型、`POST /events`、OpenAPI、共享 Client 与 Web 创建页。
- Merchant Issue TicketType Vertical Slice：TicketType 模型、容量/金额约束、Ownership 授权、创建/列表 API、共享 Client 与 Event 管理页。
- Publish Event + User Browse Event Vertical Slice：发布规则、Draft 公开隔离、公开活动列表/详情、ACTIVE TicketType 与服务端剩余量视图。
- User Claim Pass + My Passes Vertical Slice：Pass 模型、原子库存扣减、重复领取约束、Claim API 与 Web 持票列表。
- Wallet Binding + Blockchain Mint Vertical Slice：签名 challenge、单 Wallet 绑定、issuer-only non-transferable ERC-721、Anvil 集成、链/DB 恢复与 Web Mint 状态。
- Ethereum Sepolia Deployment：`ChainPass` 已部署至 chain ID `11155111`，完成 bytecode/owner/ERC-721 metadata 读取、Sourcify 精确匹配验证与真实 smoke mint；公开证据记录于 `contracts/deployments/sepolia.json`。
- Merchant Verify / Check-in Vertical Slice：Event Ownership 核验、只读 Pass Verify、原子 CheckIn、防并发重复核销与 Merchant Web 操作页。
- Dynamic QR Verification Vertical Slice：短时 HMAC Credential、用户动态 QR、Merchant 摄像头扫描，以及复用既有 Verify/Check-in。
- Mobile User Experience Vertical Slice：Better Auth Expo/SecureStore 登录、公开活动浏览、Claim、My Passes、Pass Detail 与动态 QR 展示。

尚未实现或尚未接通：

- Mobile Merchant Scanner、Wallet Binding 与 Mint 操作；

因此后续任务应以完成 Vertical Slice 为目标，不能把骨架目录视为已交付能力。

## 3. 第一阶段核心模型

当前只优先引入：

- Better Auth `User`：唯一用户身份，已经存在；
- `Event`：活动与 organizer 关系；
- `TicketType`：票种、容量/库存语义；
- `Pass`：领取、持有、Mint 与当前业务状态；
- `Wallet`：Better Auth User 唯一的 canonical、已验证链上地址；
- `CheckIn`：核验/核销记录与防重依据。

必要的 Wallet 关联、交易记录或 outbox-like 状态只有在 Mint/Check-in Slice 的一致性设计明确需要时才加入，并保持最小。未经讨论不扩展大量 Domain Entity，也不创建第二套 User/MerchantUser/WalletUser。

## 4. Vertical Slice

不要按“先做完全部 Backend，再做全部 Web，再做全部 Mobile”的水平分层推进。每个功能按以下闭环完成：

```text
Database
    ↓
API + Authorization
    ↓
OpenAPI + Shared Client
    ↓
Web or Mobile primary flow
    ↓
Minimum tests and verification
    ↓
Done
```

一个 Slice 没有满足 Definition of Done 前，不把相邻页面或基础设施扩建当作进度替代品。

## 5. 推荐实现顺序

1. Merchant Create Event：业务模型、Session organizer、权限、创建页面。**已完成**
2. TicketType / Issue Ticket：最小票种与容量规则，不做座位系统。**已完成**
3. Event List / Detail：发布状态与用户可见范围。**已完成**
4. User Claim Pass：Session owner、库存/重复领取约束和 Pass 记录。**已完成**
5. My Passes：仅返回当前用户可见 Pass。**已完成**
6. Blockchain Mint：明确 signer、网络、ID 映射、交易状态和失败处理后接入。**已完成（本地 Anvil）**
7. Pass On-chain Verification：展示可核对的 chain、contract、token 与 transaction 信息。**已完成**
8. Merchant Verify / Check-in：权限、活动 Ownership、防重复核销和状态更新。**已完成**
9. QR Code：只编码不可伪造或可服务端验证的最小凭证，不承载可信业务状态。**已完成（Web）**
10. Mobile UX：覆盖用户登录、活动浏览、领取、My Pass 与动态二维码。**已完成（用户端）**
11. UI Polish：只优化已跑通的主流程。
12. Server Deployment：主链稳定后完成最小可演示部署。

如果 Demo 风险要求调整次序，应保留同样的端到端闭环和权限约束。

## 6. Definition of Done

一个核心功能至少满足：

- Prisma/数据库模型、约束和迁移与业务语义一致；
- API 可运行，DTO/OpenAPI/Client 与调用方一致；
- 身份来自 Better Auth Session，Role、Permission、Ownership、Business Rule 均正确；
- 主目标端可以完成正常流程，并处理 loading、empty、validation 和基本错误状态；
- 重复请求和关键冲突有服务端规则，不能只靠 UI 防止；
- 存在覆盖核心成功路径与关键拒绝路径的最小测试；
- 相关 lint、typecheck、test/build 通过，或已明确记录外部阻塞；
- 文档没有把计划状态写成已完成功能。

涉及链上操作时还必须满足：

- 网络、合约地址、ABI 和 transaction hash 可追溯；
- DB 与链上 ID 映射明确；
- pending/confirmed/failed 状态和重试/幂等规则明确；
- 不在客户端暴露服务端 secret 或 signer private key。

## 7. Demo 验收路径

最终 Demo 应尽可能在一个环境中完成：

```text
Merchant 登录并创建活动/票种
  → User 浏览并领取 Pass
  → Pass 完成链上 Mint
  → User 在 My Pass 查看链上信息与二维码
  → Merchant 核验并 Check-in
  → 重复 Check-in 被拒绝
  → My Pass 与 Merchant 端状态更新
```

演示数据、手工数据库修改或直接合约调用不能替代产品路径；如果某一步仍为 mock，必须在 Demo 和文档中明确标识。

## 8. 明确非目标

当前阶段不主动实现：

- 微服务、Kubernetes、Service Mesh；
- CQRS、Event Sourcing、通用 Event Bus；
- Kafka、RabbitMQ；
- Redis，除非一个已观察到的主链需求无法用现有栈解决；
- 过度抽象的 Repository、Domain Layer 或跨应用 UI 系统；
- NFT Marketplace、二级票务市场、Token Economy；
- DAO、DeFi、虚拟货币支付；
- 推荐系统、AI、社交、元宇宙、数字孪生；
- 完整支付、复杂退款、复杂座位或黄牛治理；
- 企业级多租户、多级代理商和与 Demo 无关的平台治理；
- 为未来移动端兼容性提前设计复杂 API versioning；
- 与主流程无关的 Nginx/集群/可观测性平台建设。

出现真实、可复现的主链阻塞时，可以提出最小例外方案；例外必须说明问题、最小范围和退出条件，而不是把非目标整体引入。

## 9. Scope 决策规则

开始一个需求前依次判断：

1. 它是否直接推进 P0 主链或修复主链阻塞？
2. 它是否可以作为一个可验收的 Vertical Slice 完成？
3. 它是否保持现有 Better Auth、Monorepo、API Contract 和数据职责边界？
4. 它是否引入了本阶段非目标或尚无消费者的抽象？

前三项不能明确回答“是”，或第四项回答“是”时，先停止扩展并请求产品/架构决策。

三天结束时，成功标准是一个真实可演示的闭环，而不是一个拥有最多目录、实体、服务或抽象层的代码库。
