# ChainPass Mobile

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

一个 Expo / React Native 应用，按服务器返回的角色提供用户、商家和管理员工作区。界面遵守 [Mobile 设计约束](src/design/README.md#zh)；身份、授权和票务规则由 Better Auth 与现有 API 负责。

### 配置与运行

首次配置时复制 `.env.example` 为被 Git 忽略的 `.env`；已有配置不要覆盖。`EXPO_PUBLIC_API_URL` 必须能从设备访问：本地真机使用电脑当前的局域网地址，而不是 `localhost`。生产网关地址包含 `/api`，Mobile 会正确推导 Auth 的 `/api/auth` 路径，不重复拼接前缀。

- `EXPO_PUBLIC_REOWN_PROJECT_ID`：真实的公共项目 ID。缺失时禁用钱包连接，不影响浏览、领票和 QR。
- `EXPO_PUBLIC_APP_URL`：Web 公共 origin，用于分享邀请和钱包元数据；不能填 API 的 `/api` 地址。
- `@chainpass/web3`：提供 Ethereum Sepolia、chain ID `11155111` 和 Explorer 工具，不另建一套链配置。
- 数据库、issuer、Auth 和 QR 签名密钥都不进入 App。

```bash
pnpm install
pnpm --filter mobile dev
```

保留 `chainpass://` scheme。入口先加载官方 WalletConnect 兼容 polyfill，再启动 Expo Router；Reown 使用官方 Ethers adapter，不要求用户输入私钥。完整原生钱包验收需要 development build；Metro 导出成功不证明 Expo Go 支持全部原生依赖。不要手工维护生成的 `ios/`、`android/` 工程。

Expo Web 本地预览：

```bash
EXPO_PUBLIC_API_URL=http://localhost:3001 pnpm --filter mobile web
```

浏览器 origin 必须符合 API 的 CORS 和 `trustedOrigins`，不能关闭 Origin/CSRF 保护来绕过配置问题。

### 导航与身份

```text
src/app/
  _layout                         Session 恢复、Providers、Native Stack
  (tabs)/                         User：Discover / My Passes / Profile
  auth/sign-in, auth/sign-up       原生登录、普通用户注册
  invite                          匿名预览、登录往返、领取
  events/[eventId]                 公开活动详情、领取
  my-passes/[passId]               Pass、QR、Wallet、Mint
  merchant/
    (tabs)/                       Overview / Events / Check-in / Profile
    events/new                    原生日期时间表单
    events/[eventId]               票种、发布、邀请创建/分享/撤销
  admin/(tabs)/                    Overview / Users / Events / Profile
```

`session.user.role` 决定工作区，没有本地角色切换。受保护的深链使用允许列表内的 `returnTo` 登录返回。Admin 可跨组织者管理；注册不提交角色，商家身份由 Admin API 提升。

初次 Session 恢复有加载边界，后续刷新不卸载已初始化的导航。登录/注册成功后，要等 Session hook 与新身份一致再跳转。

### 数据与凭证边界

业务数据经 `api-client` / `schemas`；Admin 用户列表和角色提升经 Better Auth `adminClient`。原生 Session 使用 SecureStore，并为业务请求提供认证 Cookie，不创建第二套 Token 存储。WalletConnect 的带前缀 AsyncStorage 只保存连接元数据。

Query key 集中在 `lib/product.ts`。私有数据的 key 包含 User ID，身份/角色变化或退出时清理；公共缓存独立，mutation 不自动重试。钱包流程是获取 API challenge、签名、复核身份、verify；连接成功不等于已经绑定。Mint 仍调用现有 API，由服务器签发链上交易，客户端展示确认后的字段。

QR 凭证只保存在内存，根据服务器有效期提前十秒刷新，过期即隐藏。失焦或进入后台时停止定时器并清除凭证；回到前台重新查询。Pass 详情只在可见且前台时每五秒轮询。`CHECKED_IN` / `REVOKED` 不展示可用 QR。

### 邀请制

商家新建活动默认 `INVITE_ONLY`，也可显式选择 `PUBLIC`；Discover 只列公开且已发布的活动。邀请制活动发布并具备 ACTIVE 票种后，可创建有次数和期限限制的邀请。

系统分享使用 `<EXPO_PUBLIC_APP_URL>/invite#token=…`，也可提供已安装 App 的 `chainpass://invite#token=…` 链接。服务器只在创建时返回一次原始 token，离开前应保存或分享；列表只显示次数和期限。撤销邀请不影响已经领取的 Pass。

用户可在 Open invitation 粘贴完整 Web 链接。App 只提取凭证，不访问任意粘贴 URL。预览只展示指定票种；登录/注册后返回 `/invite`，通过既有 Claim API 创建独立 Pass，再进入 Pass / QR 页面。

待领取凭证在原生端独立存入 SecureStore；**Mobile 的 Expo Web 预览**使用当前 tab 的 sessionStorage。保留时间不超过 30 分钟或已知服务器有效期。新链接替换旧凭证，非法新链接不回退旧邀请。领取成功、主动清除、退出、身份/角色变化，或邀请过期/撤销/耗尽时清除。

持久化失败会显示警告，当前内存中的流程仍可继续。存储器通过串行写入与版本检查，避免旧恢复结果覆盖新凭证。Token 不进入 Auth 返回地址或 Query key。预览刷新受前台/焦点控制，不预留库存，最终资格由服务器判断。

自定义 scheme 需要已安装的构建；尚无 HTTPS Universal Links / App Links 或 Web 自动唤起 App。浏览器预览不证明操作系统已正确投递深链。

### 现场核验

`expo-camera` 仅扫描 QR；只在页面可见、App 前台且正在扫描时挂载。检测到二维码、失焦或进入后台后卸载。同步锁防止重复帧，旧响应不能覆盖新扫描。拒绝权限或没有相机时，提供系统设置提示和手工 Pass ID 回退。

QR 调用 verify-token，手工模式调用既有 Verify API；两者都需要工作人员明确确认 CheckIn，记录 `method=QR` 或 `MANUAL`。服务器重新检查归属与状态，并原子核销；Off-chain Pass 不依赖钱包或 RPC。

### 验证命令与设备清单

```bash
pnpm --filter mobile lint
pnpm --filter mobile typecheck
pnpm --filter mobile test
pnpm --filter mobile exec expo export --platform ios --clear
pnpm --filter mobile exec expo export --platform android --clear
pnpm --filter mobile exec expo install --check
(cd apps/mobile && pnpm dlx expo-doctor@latest)
```

纯逻辑测试覆盖设计约束、角色/返回地址、私有缓存、QR/相机、钱包状态，以及邀请校验、恢复、保留期限、存储失败和替换竞争。Metro 将 Valtio 解析到 Native Reown 所用实例，使控制器和订阅者共享同一代理注册表；不是全局 workspace override。

设备验收需分别检查：

- iOS / Android Session 重启恢复、角色导航、键盘、安全区和字号缩放。
- User 领取 → 外部钱包签名返回 → Mint → QR。
- Merchant 相机/手工核验/扫描下一张，以及 Admin 提升角色。
- Mobile QR 被 Web 核销后，回到前台同步状态。
- 拒绝权限、后台切换、过期、拒签与减少动态效果偏好。

Hermes 导出不能替代安装、相机和其他硬件验收。

### 已记录验收（2026-10-07）

真实本地 Docker PostgreSQL / API 已验证身份、商家创建活动/票种/发布、用户领取、签名钱包绑定、Sepolia 应用 Mint、receipt / owner / hash / 幂等性、QR / 手工核验、重复核销拒绝、状态同步和 Admin 提升。

Token #5 是本地验收 Pass，不是生产种子数据：[公开交易](https://sepolia.etherscan.io/tx/0xf11fef27990f05f97dcafcdeacff72b41310dfb65c816b84ed67ee2f1cf86fe8)。

Expo Web 的真实三角色界面也已验证；明确命名的测试数据保留，未重置已有 Demo 身份。当时 API E2E 为 79 通过 / 1 跳过，Mobile 15 个纯逻辑测试、根质量检查和 Hermes 导出通过。Expo Doctor 为 20/21；重复原生模块仍需 development build 检查，不能为凑满分全局覆盖 React 版本。

### 邀请验收（2026-10-08）

Expo Web + 真实本地 API / DB 已验证商家 Draft、票种、发布、创建/列出邀请，公开查询隐藏邀请制活动，预览限定票种，以及粘贴/fragment/tab 重载、登录/注册返回邀请、不同用户独立领票。

QR 凭证通过 Merchant API 核验并明确确认 QR Check-in；重复扫描返回 `ALREADY_CHECKED_IN`，Mobile 刷新后隐藏 QR。撤销拒绝新预览并清除待领取凭证，保留已领 Pass。三角色登录、重载和退出通过，没有新增链上交易。

Mobile lint/typecheck、25 个纯逻辑测试、根质量检查和 Hermes 导出通过；隔离 PostgreSQL API E2E 串行为 93 通过 / 1 个 opt-in 跳过。此前并行执行受导出/构建负载影响而超时。这些是历史记录，本轮文档修改未重跑业务测试。

相机实拍、外部钱包跳转、触感、键盘、SecureStore 进程重启、系统分享与已安装 scheme 的物理设备验收仍待完成。浏览器、API 和导出证据不能相互替代。

---

<a id="en"></a>

## English

One Expo / React Native app, three server-selected workspaces. The UI uses the
[Mobile Design Contract](src/design/README.md#en); Better Auth and the existing API
remain the identity, authorization and ticketing authorities.

## Configure and run

Copy `.env.example` to ignored `.env`. `EXPO_PUBLIC_API_URL` must be reachable by
the device: use your computer's current LAN address for local native testing,
not `localhost`. A same-origin production gateway URL includes `/api`.
Mobile derives the Better Auth endpoint as `/api/auth`; it does not reuse the
business `/api` prefix as the Auth root. Both direct local API origins and the
production reverse proxy are covered by regression tests.

- `EXPO_PUBLIC_REOWN_PROJECT_ID`: real public Reown project ID for wallet connection.
  Missing configuration disables connection, not browsing, claiming or QR entry.
- `EXPO_PUBLIC_APP_URL`: public Web origin for shared invitation links and wallet
  metadata. Set the real origin; do not put an API `/api` URL here.
- Chain configuration and explorer helpers come from `@chainpass/web3`;
  Ethereum Sepolia, chain ID `11155111`. Do not introduce a second chain.
- No database, issuer, Better Auth or QR signing secrets belong in this app.

```bash
pnpm install
pnpm --filter mobile dev
```

Keep the `chainpass://` scheme. The entry point loads the official WalletConnect
compatibility polyfills before Expo Router. Reown uses its official Ethers
adapter, not a private-key input. Use a development build for full native wallet
acceptance; a Metro export is not proof that every native dependency exists in
Expo Go. No native `ios/` or `android/` directories are maintained manually.

For Expo Web preview of a local API (not a device test):

```bash
EXPO_PUBLIC_API_URL=http://localhost:3001 pnpm --filter mobile web
```

The preview's browser origin must match API CORS/trusted-origin configuration.
Do not disable CSRF or Origin checks to make preview login work.

## Navigation

```text
src/app/
  _layout                         session restoration, providers, Native Stack
  (tabs)/                         User: Discover / My Passes / Profile
  auth/sign-in, auth/sign-up       native forms, user-only registration
  invite                          anonymous invitation preview / auth / Claim
  events/[eventId]                 public event / Claim / Open Pass
  my-passes/[passId]               holographic pass / QR / Wallet / Mint
  merchant/_layout                merchant/admin route gate, Native Stack
    (tabs)/                       Overview / Events / Check-in / Profile
    events/new                    native date/time form
    events/[eventId]              tickets, publish, invitation creation/share/revoke
  admin/_layout                   admin-only gate, Native Stack
    (tabs)/                       Overview / Users / Events / Profile
```

`session.user.role` selects the workspace after restoration; no client-side role
switch exists. Protected deep links redirect through sign-in with an allowlisted,
role-appropriate `returnTo`. Admin can open cross-organizer event management
without switching to a merchant identity. Registration never accepts a role;
user → merchant promotion calls the official Better Auth Admin API.

## Data and security boundaries

- Business requests use `@chainpass/api-client`; payloads/results use
  `@chainpass/schemas`. Admin list/promotion use Better Auth `adminClient`.
- Better Auth's Expo client persists authentication in SecureStore and supplies
  cookies to native API requests. No second auth or token store exists.
- TanStack Query keys live in `lib/product.ts`. Private keys include user ID;
  identity/role changes and sign-out discard private data. Public event caches
  are separate. Mutation retries are disabled, especially for mint and check-in.
- WalletConnect uses prefixed AsyncStorage for connection metadata only. It
  never stores Better Auth sessions, private keys or entry QR tokens.
- Binding signs the API's challenge, rechecks session identity, then calls
  `/wallets/verify`. A connected address is never treated as a bound wallet.
- Mint calls `/passes/:passId/mint`. The backend signs the transaction; Mobile
  only displays confirmed API fields and shared explorer links.

QR lives in memory, rotates 10 seconds before the server expiry and is hidden
once expired. Screen blur/background stops timers and clears the credential;
foreground revalidates it. Pass detail polls status every five seconds only while
focused and foregrounded. CHECKED_IN/REVOKED never displays a usable QR.

## Invitation-only events

New Merchant drafts default to `INVITE_ONLY`; the creation screen also offers
`PUBLIC`. Only published public events appear in Discover. Publish a private
event with an active ticket type, then create an invitation with a claim limit
and future expiry on its management screen. Native sharing sends the Web link
`<EXPO_PUBLIC_APP_URL>/invite#token=…`; the optional installed-app link is
`chainpass://invite#token=…`. The server returns the raw credential only once.
Save/share it before leaving the screen; lists contain counts and expiry, not
recoverable tokens. Revoking a link stops new claims, not existing passes.

Attendees can open an installed-app link or choose **Open invitation** in
Discover and paste the complete Web link. The app extracts the credential; it
does not request arbitrary pasted URLs. Preview shows only the designated
ticket. Sign-in/sign-up return to `/invite`, then the existing claim API creates
an independent Pass and opens its existing detail/QR screen. A forwardable link
does not grant access to other private events or ticket types.

The pending credential is separate from Better Auth: native SecureStore (Web
preview uses tab sessionStorage), limited to 30 minutes or the known server
expiry, whichever comes first. A new link replaces it; malformed links cannot
fall back to an old invitation. Successful claim, explicit clear, sign-out,
account/role change, expiry, revocation and exhausted quota clear the handoff.
If secure persistence fails, the current in-memory handoff still works with a
visible warning. The server remains the authority for eligibility and stock;
preview does not reserve inventory. No credential is in auth `returnTo` or a
query cache key. Focus/background gates preview refresh and expiry timers.

Custom-scheme links require an installed development/production build. HTTPS
Universal Links / Android App Links and automatic Web-to-app routing are not
configured; Expo Go and browser preview do not prove native deep-link delivery.

## On-site operations

`expo-camera` scans QR only. Camera mounts only during an active scan on the
focused foreground screen and unmounts on detection, blur or background. A
synchronous lock prevents duplicate frame requests; stale scan responses do not
overwrite a newer scan. Permission denial / unavailable hardware offers settings
and manual Pass ID fallback.

Scanning calls the existing verify-token endpoint. Manual mode calls verify by
Pass ID. Neither checks in automatically: staff inspect the result and explicitly
confirm the existing check-in API with `QR` or `MANUAL`. The server rechecks
ownership and state and enforces atomic, one-time entry. Off-chain entry works
without a wallet or blockchain RPC.

## Verify

```bash
pnpm --filter mobile lint
pnpm --filter mobile typecheck
pnpm --filter mobile test
pnpm --filter mobile exec expo export --platform ios --clear
pnpm --filter mobile exec expo export --platform android --clear
pnpm --filter mobile exec expo install --check
(cd apps/mobile && pnpm dlx expo-doctor@latest)
```

Pure tests cover role destinations, redirect attacks, private cache isolation,
QR expiry, camera lifecycle, check-in guards and wallet/network state, alongside
the existing foundation contrast/motion tests. Invitation tests cover link
validation, cold restore, retention, storage failures and replacement races.
Metro pins Valtio resolution to
the native Reown SDK's instance: controllers and subscriptions must share one
proxy registry. This is Mobile-only, not a workspace dependency override.

Native acceptance checklist:

- iOS + Android: restore session, role tabs, auth keyboard, safe areas, font scaling.
- User: browse → claim → pass → wallet app sign/return → verified bind → mint → QR.
- Merchant: create → ticket → publish → camera/manual verify → confirm → scan next.
- Admin: list/search/filter users → confirm promotion → inspect/manage events.
- Present Mobile QR to Web Merchant; confirm CHECKED_IN after foreground/refetch.
- Deny permission, background the app, expire QR, decline signing, test reduced motion.

## Validation record (2026-10-07)

Local Docker PostgreSQL + real API acceptance completed signup/session roles,
merchant event/ticket/publish, user claim, wallet challenge/signature binding,
Sepolia application mint, receipt/owner/hash mapping/idempotency, QR + manual
verification, QR check-in/replay rejection, status sync and Admin promotion.
The mint was a single explicitly named local acceptance pass (token #5), not
production seed data or a mock. Its public transaction is
[on Sepolia Etherscan](https://sepolia.etherscan.io/tx/0xf11fef27990f05f97dcafcdeacff72b41310dfb65c816b84ed67ee2f1cf86fe8).

Expo Web UI acceptance used the real local API: user-only registration and
role-specific login, Merchant draft/ticket/publish, User claim/pass/rotating QR,
Merchant manual verify/confirm/replay, and Admin overview/search/confirmed
user-to-merchant promotion plus cross-organizer event management. Reopening the
checked-in User pass shows CHECKED_IN and hides the usable QR. These explicitly
named local fixtures are retained
for inspection; the existing Demo identities were not reassigned.

Device camera capture, external wallet-app handoff, haptics, native keyboard and
physical session persistence still require device acceptance. Browser preview,
API acceptance and Hermes exports are separate evidence, not substitutes.
Doctor may report monorepo native-module duplication and external network checks;
do not override React globally or change Web simply to obtain 21/21.

The isolated PostgreSQL API regression suite passed 79 tests (8 files), with
one explicitly opt-in blockchain integration test skipped. Mobile's 15 pure
tests, workspace lint/typecheck/test/build and iOS/Android Hermes exports passed.
Expo Doctor passed
20/21 checks; its remaining native-module duplication warning still requires
verification in a native development build. Expo enables autolinking module
resolution for this monorepo, but a successful Hermes export does not prove a
native build is free from linking conflicts.

## Invitation validation record (2026-10-08)

Expo Web preview against the real local API and Docker PostgreSQL passed the
Merchant draft → active ticket → publish → create/list invitation flow. Private
events stayed out of public discovery, and preview exposed only the designated
ticket. Pasted links and direct fragment links restored after a tab reload;
sign-in and registration returned to `/invite` without a credential in the auth
URL. Separate attendees received separate Passes through the existing claim API.

The issued Pass generated the existing QR credential; Merchant API verification
and explicit QR check-in succeeded, replay returned ALREADY_CHECKED_IN, and the
reloaded Mobile screen showed CHECKED_IN without a usable QR. Revocation blocked
new invitation preview, cleared the handoff and preserved already issued Passes.
User, Merchant and Admin login destinations, browser session restoration and
sign-out cleanup also passed against the real API.
The explicitly named local acceptance fixtures remain available for inspection.
No chain transaction was sent by this invitation test.

Mobile lint/typecheck and 25 pure tests passed. The isolated PostgreSQL API E2E
suite passed 93 tests with one opt-in blockchain integration test skipped;
files were run serially after a parallel run encountered assertion timeouts
during simultaneous exports/builds. Workspace lint/typecheck/test/build and
iOS/Android Hermes exports passed. The native acceptance checklist above is
still required: browser preview does not validate system sharing, SecureStore
after process restart, or delivery of `chainpass://` links on iOS/Android.
