# ChainPass 产品说明 / Product Brief

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

### 产品定位

ChainPass 为活动组织者提供创建活动、发行门票和核销流程，为参与者提供领取、持有与出示门票体验。它是一个已经贯通 Web、Mobile、API、数据库与测试网的黑客松项目，不是售票支付平台，也不把所有业务强行放到链上。

### 角色与价值

- User：领取属于自己的 Pass，查看状态，展示短时 QR；可选绑定钱包并 Mint。
- Merchant：只管理自己活动及对应票种/邀请，核验和确认入场。
- Admin：管理用户角色、查看全平台活动并跨 organizer 管理；不开放自助注册。
- 公开访客：浏览 PUBLIC + PUBLISHED 活动，或凭有效邀请预览指定票种。

不同商家不共享活动管理权限，也不能核销其他商家的票。身份、资源归属和业务状态由 API 决定，客户端只展示结果。

### 当前业务闭环

```text
商家创建 DRAFT → 创建 ACTIVE 票种 → 发布
→ 分享票种邀请（默认）/ 显式公开
→ 用户登录并 Claim → 独立 ACTIVE Pass
→ 可选 Wallet challenge/verify → issuer Mint
→ 动态 QR → 商家 Verify → 确认 Check-in
→ CHECKED_IN → 用户刷新后看到状态
```

### 邀请制

新建默认 INVITE_ONLY，历史活动保持 PUBLIC。发布只改变 DRAFT/PUBLISHED，不改变公开范围。邀请绑定一个票种，持链接者可转发领取，受 quota/expiry/revocation 限制；不提供绑定指定用户的实名邀约。

每个用户对同一票种只能领取一次。邀请次数、库存和 Pass 创建同事务。撤销邀请不撤销已发 Pass；多个邀请绑定同票种会共享库存。

### 资产与业务状态

数据库是活动、价格/库存、邀请、领取和核销的事实来源。Ethereum Sepolia 上的不可转让 ERC-721 提供 token identity、钱包 owner 和 Pass hash 对应。Mint 可选，由平台 issuer 付 gas；入场无需钱包，核销不上链、不 burn Token。

票种 price 目前是元数据，不等于已收款。连接钱包不等于已验证绑定；Mint 页面展示应用确认后的链上字段，不模拟交易。

### 客户端与视觉

Web 与 Expo Mobile 均有 User/Merchant/Admin 工作区，共享 API/Schema/Web3，不共享 DOM/Native UI。视觉为 Dark-first Holographic Graphite + Future Boarding Pass，普通界面克制，关键 Pass/Mint 采用品牌强调。

实验 Telegram、Discord、Extension、WeChat 只有工程入口，不算已完成客户端。Mobile 浏览器验收与原生设备验收分开，见[范围](docs/DEVELOPMENT_SCOPE.md#zh)。

### 明确边界

当前无支付/退款、转让/二级市场、活动编辑/删除接口、复杂 analytics、团队/多租户组织、钱包登录、自动合约重部署或应用商店发布。无生产 HTTPS；原生设备、异机备份/恢复、限流及 issuer 托管仍需后续验收/设计。

优先继续完善可验证的闭环，而不是增加无消费者的平台抽象。实现细节见[技术说明](docs/TECHNICAL_DETAILS.md#zh)，工程规则见[架构](docs/ARCHITECTURE.md#zh)。

---

<a id="en"></a>

## English

### Product

ChainPass gives organizers a create/issue/admit flow and attendees a claim/hold/present experience. It is an integrated Web/Mobile/API/database/testnet hackathon system, not a payment platform or an all-on-chain workflow.

### Roles

Users own passes, view state, present QR and optionally bind/mint. Merchants manage only their events/tickets/invitations and admission. Admins manage user roles and platform events without self-service privileged registration. Anonymous visitors see PUBLIC + PUBLISHED events or preview one ticket through a valid invitation.

Organizers cannot manage/check in others' events. API identity, ownership and business rules—not client role labels—are authoritative.

### Flow and invitations

```text
Merchant DRAFT → ACTIVE ticket → publish
→ ticket-specific invitation (default) / explicitly public
→ authenticated claim → independent ACTIVE Pass
→ optional wallet challenge/verify and issuer mint
→ rotating QR → verify → explicit check-in
→ CHECKED_IN → attendee refresh
```

New events default INVITE_ONLY; legacy events remain PUBLIC. Publication does not change visibility. Forwardable invitations select a ticket and enforce quota/expiry/revocation, not named-user eligibility. Each user claims a ticket once; invitation quota, inventory and Pass creation are atomic. Revocation preserves existing passes; links for the same ticket share stock.

### Business versus chain

The database owns content/prices/stock/invitations/claim/admission. Ethereum Sepolia non-transferable ERC-721 supplies identity, wallet owner and Pass-hash mapping. Mint is optional and issuer-funded; off-chain admission needs no wallet and does not burn a token.

Price is metadata, not payment. Connected wallets still need signature binding. UI displays confirmed API evidence, not simulated transactions.

### Clients and limits

Web/Expo have User/Merchant/Admin workspaces with shared API/schema/Web3, platform-local UI and dark-first Holographic Graphite/Future Boarding Pass. Telegram/Discord/Extension/WeChat are scaffolds only; browser/native acceptance differs.

Not implemented: payments/refunds, transfer/marketplace, event edit/delete API, complex analytics/teams, wallet login, auto contract redeploy or app-store delivery. Production HTTPS, physical-device acceptance, off-host backup/restore, rate limiting and issuer custody remain further work.

See [scope](docs/DEVELOPMENT_SCOPE.md#en), [internals](docs/TECHNICAL_DETAILS.md#en) and [architecture](docs/ARCHITECTURE.md#en).
