# ChainPass Web

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

基于 Next.js 16 / React 19 / Tailwind v4 / Base UI shadcn 的 Dark-first 产品。视觉约束见 [Foundation](lib/design/README.md#zh)，发布说明见[部署指南](../../docs/DEPLOYMENT.md#zh)。

### 运行与环境

从根目录执行 `pnpm install`，按模板配置被 Git 忽略的 API `.env` 和 Web `.env.local`，不要覆盖已有配置。启动开发 PostgreSQL 后应用迁移并生成 Prisma Client：

```bash
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec prisma generate
pnpm --filter api dev
pnpm --filter web dev
```

API 和 Web 分别在终端启动，默认端口为 3001 / 3000。`NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_AUTH_URL` 对应 API / Auth origin，`NEXT_PUBLIC_APP_URL` 为 Web origin。Reown 是公共客户端配置；issuer、QR 和 Auth 密钥只在 API 运行时。教学服务器不构建镜像。

### 本地 Demo 身份

已记录的开发数据库保留 `admin.demo@chainpass.local`、`merchant.demo@chainpass.local`、`user.demo@chainpass.local` 三角色。各自随机密码只在被忽略的 `apps/api/.env.demo-accounts.local`（JSON，权限 600），文档不公开。测试钱包私钥同样只在本地，不能存真实资产；这些不是生产账号。

新的本地数据库需要明确授权后，构建并启动 API，再执行：

```bash
pnpm --filter api build
pnpm --filter api exec node scripts/create-demo-accounts.mjs --bootstrap-local-admin
```

脚本拒绝 production、远端数据库以及非 `localhost:55432/chainpass` 的连接。它通过 Auth 创建账号，只初始化一次新 Demo Admin，再通过 Admin API 提升 Merchant；不会重设没有匹配已存凭证的账号。产品注册始终创建 user。

本地 `ChainPass Web Product Demo` 活动和已有 Pass 保留。同一用户只能领取同一票种一次；复测领取/核销应新建票种，不清空数据库或删除链上证据。

### 路由与角色

| 入口                                                        | 权限与能力                                   |
| ----------------------------------------------------------- | -------------------------------------------- |
| /、/events、/events/[eventId]                               | PUBLIC / PUBLISHED 浏览与领取                |
| /invite                                                     | fragment 凭证指定票种预览、登录往返、领取    |
| /login、/register                                           | Better Auth 登录、普通用户注册、安全返回地址 |
| /my-passes、/my-passes/[passId]                             | 自己的 Pass、QR、Wallet / Mint               |
| /merchant、/merchant/events/new、/merchant/events/[eventId] | 自己的活动、票种、发布与邀请管理             |
| /merchant/events、/merchant/check-in                        | 管理列表、QR/手工核验与确认核销              |
| /admin、/admin/users、/admin/events                         | 平台与用户列表、提升 Merchant                |
| /auth-test                                                  | 兼容重定向到 /login，不是开发控制台          |

RouteGate 在渲染前处理 Session / role，但不能替代 API 安全检查。新活动默认邀请制，可选 PUBLIC；邀请制活动发布后仍不出现在 Discover。

邀请链接为 `/invite#token=…`，登录 next 仅为 `/invite`，当前 tab 的 sessionStorage 交接凭证；领取成功或主动清除后移除。原始 token 只返回一次，需当场保存。列表无法恢复，撤销只阻止后续领取。

### 组件与数据

`globals.css` / `lib/design` 提供语义颜色、状态与动态反馈。`chainpass` 组件提供 Shell/状态，`auth` 提供表单门禁，`events/passes/merchant` 提供业务界面。`queries.ts` 按身份隔离私有缓存，退出时清理；Admin 使用官方客户端适配器，不直接写数据库。`api-client/schemas/web3` 统一契约、链配置、hash 和 Explorer。

mutation 使相关列表/详情缓存失效。Pass 可见时每五秒查询，回到前台重新获取，核销后隐藏 QR；没有 WebSocket。QR 根据返回有效期刷新，不每秒请求。ZXing 在检测、模式切换和卸载时清理相机并去重；不安全 origin、无硬件或拒绝权限时保留手工核验。

Connect 由明确点击启动；签名 challenge 并 verify 后才算绑定。Mint 等待 API receipt 和数据库写回，仅展示真实字段，不模拟 Token 或交易进度。Hero / Pass 使用克制的 CSS / Motion，不要求必须启用 WebGL。

### 验证与历史证据

```bash
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web build
pnpm --filter api test:e2e
```

API E2E 使用隔离数据库。Web 测试含视觉基础、安全返回地址和邀请链接。2026-10-07 本地浏览器已验证角色、创建/发布、领取、Pass、手工核销、390px 布局，以及 API 钱包绑定。

Web 发起真实 Sepolia [Token #3 交易](https://sepolia.etherscan.io/tx/0xe3c7021a1d900f7164b2d797f291921868c68615837a514f71f6b54de2ccec04)；DB / receipt / owner / hash / 幂等性一致，对应 General Pass 保留 ACTIVE。

QR 过期、新凭证、method=QR、重放和用户状态同步也有记录。相机等待取消、手工回退已测；硬件扫描和钱包扩展签名仍需设备验收。HTTP 相机需要 HTTPS，localhost 是例外。本轮只同步文档，未重跑链交易或浏览器流程。

不展示未实现的活动编辑/删除、支付、转让、商家/管理员自助注册或复杂分析功能。

---

<a id="en"></a>

## English

Dark-first Holographic Ticket System built with Next.js 16, React 19, Tailwind v4 and Base UI shadcn.

## Local development

From the repository root, install with `pnpm install`, configure ignored `apps/api/.env` and `apps/web/.env.local` from their examples, and start the existing PostgreSQL development Compose. Apply existing Prisma migrations before starting the API:

```bash
pnpm --filter api exec prisma migrate deploy
pnpm --filter api dev
pnpm --filter web dev
```

The API defaults to port 3001 and Web to port 3000. `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_AUTH_URL` must match the local API / Better Auth public origin. Reown configuration is public client configuration; signer and QR secrets belong only to the API. Production release instructions remain in [DEPLOYMENT.md](../../docs/DEPLOYMENT.md#en); do not build images on the teaching server.

## Reusable local Demo accounts

The local development database has three dedicated identities:

| Role     | Email                           |
| -------- | ------------------------------- |
| Admin    | `admin.demo@chainpass.local`    |
| Merchant | `merchant.demo@chainpass.local` |
| User     | `user.demo@chainpass.local`     |

Their separate random passwords are stored only in ignored `apps/api/.env.demo-accounts.local` (JSON, mode `600`), not in this README or Git. Keep this file local; do not share it in commits, logs or screenshots. Any test-wallet private key in that file is also local-only and must never hold real assets. These identities are not production accounts.

On a fresh **local** database, after starting the API and building it, explicitly authorized first-admin fixture setup is:

```bash
pnpm --filter api build
pnpm --filter api exec node scripts/create-demo-accounts.mjs --bootstrap-local-admin
```

The script refuses production, remote databases and anything other than `localhost:55432/chainpass`. It creates accounts through Better Auth, initializes only the newly created Demo Admin once, then grants Merchant via the official Admin API. Existing accounts without matching saved credentials are never reset. Registration in the product always creates `user`.

`ChainPass Web Product Demo` is retained as local test data, created and published through the Merchant Web UI. For another claim/check-in rehearsal, issue a new ticket type from that account: each user can claim a given ticket type only once, and each pass can be checked in only once. No test reset deletes existing passes or on-chain evidence.

## Invitations

New events default to INVITE_ONLY, with an explicit PUBLIC option. Discovery/detail expose only PUBLIC + PUBLISHED. /invite#token=… previews one designated ticket; auth next contains only /invite and tab sessionStorage hands off the credential. Success/explicit clear removes it. The raw invitation is returned once; save/share it immediately. Lists cannot recover it. Revocation blocks future claims, not existing passes.

## Routes and roles

| Routes                                                                                                      | Access                            | Capabilities                                                                                  |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `/`, `/events`, `/events/[eventId]`                                                                         | Public                            | Brand entry, public published events, active tickets and claim CTA                            |
| `/login`, `/register`                                                                                       | Anonymous                         | Better Auth email login, user-only registration, role-aware safe return paths                 |
| `/my-passes`, `/my-passes/[passId]`                                                                         | Authenticated owner               | Ticket list/detail, signed dynamic QR, verified wallet binding, issuer-backed mint evidence   |
| `/merchant`, `/merchant/events`, `/merchant/events/new`, `/merchant/events/[eventId]`, `/merchant/check-in` | Merchant / admin                  | Own-event overview/list, create, ticket issue, publish, manual/QR verify and confirm check-in |
| `/admin`, `/admin/users`, `/admin/events`                                                                   | Admin                             | Real user/event counts, user search/pagination, promote user to merchant, platform events     |
| `/invite`                                                                                                   | Bearer link / authenticated claim | Ticket-specific preview, safe auth handoff and independent Pass claim                         |
| `/auth-test`                                                                                                | Any                               | Compatibility redirect to `/login`; no development console                                    |

Layouts gate protected content before rendering. The server still enforces Session → Permission → Ownership → Business Rules. The client never decides a trustworthy role or owner ID. Registration submits no role; admin promotion uses Better Auth's official Admin client.

## UI and data boundaries

- `app/globals.css` and `lib/design/*`: existing semantic tokens, status tones, motion presets, keyboard focus and reduced motion.
- `components/chainpass/*`: shared header/footer, role workspace navigation and reusable loading/error/empty/status presentations.
- `components/auth/*`: validated forms, safe role redirects and route rendering gates.
- `components/events/*`, `components/passes/*`, `components/merchant/*`: domain UI, not duplicated business rules.
- `lib/queries.ts`: React Query options. User-sensitive passes/wallet/merchant lists include the session user ID in their keys; sign-out clears the cache.
- `lib/admin-api.ts`: typed Better Auth Admin plugin adapter. No direct user database updates.
- `@chainpass/api-client` / `@chainpass/schemas`: shared request/response boundaries. `@chainpass/web3` supplies chain, ABI, explorer and address helpers.

Claim/create/publish/mint mutations invalidate the affected lists and detail queries. Pass Detail refreshes the owner's pass list every five seconds while visible, and on focus, so check-in hides the QR without a WebSocket. The server-issued QR is renewed near its returned expiry, never requested every second; an expired credential is not rendered. Camera capture stops after the first scan, on mode changes and on unmount. Non-secure contexts, missing devices and denied permissions keep manual verification available.

Wallet UI opens only after an explicit Connect action. A signature challenge proves ownership; connection alone does not bind a wallet. Mint waits for the existing API's receipt/DB flow and displays only returned token, network, contract and transaction metadata. No fake transaction progress or fabricated tokens.

## Validation

```bash
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web build
pnpm --filter api test:e2e
```

Web tests cover foundation contrast/status/motion compilation and safe role redirects. API E2E covers ownership, inventory, wallet signature/replay, mint recovery, QR expiry and check-in concurrency. Real wallet-extension signing and camera scanning require a compatible browser/device; production camera access requires HTTPS (localhost is a secure-context exception).

Local acceptance on 2026-10-07 used the retained Demo identities and real PostgreSQL/API. Browser flows covered user registration/login/session/sign-out, Admin search and Merchant promotion, Merchant event/ticket creation and publication, User claim, live Pass Detail, manual verify/check-in, role restrictions and a 390px viewport. Controlled-wallet challenge/signature/verification used the real API, followed by a Web-initiated Ethereum Sepolia mint: [Token #3 mint transaction](https://sepolia.etherscan.io/tx/0xe3c7021a1d900f7164b2d797f291921868c68615837a514f71f6b54de2ccec04). DB fields, receipt, owner/hash mapping and idempotent retry matched. The minted General admission pass remains ACTIVE for reuse.

Real-time QR expiry, fresh-token verification, `method=QR`, replay rejection and User-side CHECKED_IN synchronization were also verified. Camera permission waiting/cancel and manual fallback were exercised; hardware camera scanning and browser-wallet extension signing still require device-level acceptance, not a simulated provider.

The UI intentionally does not advertise unavailable event edit/delete, payments, transfer/resale, self-service merchant/admin registration or advanced analytics.
