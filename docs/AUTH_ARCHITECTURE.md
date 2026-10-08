# ChainPass 认证与授权 / Authentication & Authorization

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

ChainPass 只使用 **Better Auth**，没有并行 JWT、手写登录 API 或 Wallet User。身份与可信边界以 `apps/api/src/auth/auth.ts`、`permissions.ts` 和各 endpoint 的 Session/权限/归属检查为准。

### 实现与存储

NestJS 12 通过 `@thallesp/nestjs-better-auth` 托管 Better Auth 1.7，Prisma adapter 使用 PostgreSQL。Auth 管理 User、Session、Account、Verification；Event、Pass、Wallet 关联同一 User。Admin plugin 提供用户与角色管理，Expo plugin 支持原生客户端。

入口为 `/api/auth/*`，包括 email/password 注册、登录、登出和 Session。Web 使用已有 Better Auth Client/cookie；Mobile 使用 Expo Client/SecureStore。API 的 `bodyParser:false` 保留 Auth 请求处理；业务 CORS 与 Web origin 配置见 `main.ts`。没有已配置的社交 OAuth 或 Wallet Login。

### 角色与权限

| 角色      | 当前业务边界                                                              |
| --------- | ------------------------------------------------------------------------- |
| user      | 公开/邀请预览、领取自己的票、My Passes、自己的 Wallet/Mint/QR             |
| merchant  | 自己的 Event/票种/邀请，Verify/Check-in；没有 pass:claim/mint 权限        |
| admin     | Better Auth 用户管理、全平台 Event 与跨 organizer 操作；owner-only 仍适用 |
| anonymous | 公开活动与有效邀请预览；受保护接口 401                                    |

注册默认 `role=user`，表单不能选择角色。Merchant 提升使用官方 Admin `setRole`，不手工更新数据库。初始 Admin 需要明确授权并安全配置；本地 Demo 初始化只允许 `localhost:55432/chainpass`，不能用于生产。

权限声明中的 `event:update/delete`、`pass:revoke` 不表示已有对应接口。角色权限不能取代资源归属：商家不能管理或核销其他商家的活动。`/events/admin` 明确要求 admin，不能只检查普通 user 也拥有的 `event:read`。

### 请求可信链

```text
Authentication / Session
→ permission
→ resource ownership
→ business state / transactional constraints
```

organizerId、ownerId、verifiedById 固定由 Session 派生，客户端不能自报 userId/role。Admin 也只能给自己持有的 ACTIVE Pass Mint/生成 QR。Native/Web RouteGate 与 safe-next 只是防错误渲染与 UX，不是安全边界。

### Origin、Cookie 与 URL

服务端要求 `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`；`WEB_ORIGIN` 加入 `trustedOrigins`。默认信任 `chainpass://`；localhost 的 3000/8081 端口与 `exp://` 模式仅在非 production 启用。保留 Origin/CSRF 保护，不为解决预览登录关闭它们。

直连本地 API `:3001` 时 Auth 仍在 `/api/auth`；生产业务 base 为公网 `/api` 时，不能重复拼成 `/api/api/auth`。Web 的 `NEXT_PUBLIC_AUTH_URL` 是 Auth 所在的公共 origin；Mobile 从 `EXPO_PUBLIC_API_URL` 推导 Auth 根。回归测试覆盖这两种配置。

生产 Compose 从 `PUBLIC_URL` 派生 `BETTER_AUTH_URL` / `WEB_ORIGIN`，Web 公共 URL 在构建时注入。当前教学 HTTP 不等于 HTTPS 验收；启用 TLS 需审查代理 X-Forwarded-Proto、Cookie 与最终 URL，不能假称已安全传输。

### Session 生命周期

Session 持久化在 PostgreSQL；Web 用 cookie，原生通过 SecureStore 保存 Better Auth Expo 认证状态并向业务 Client 附加 cookie。不用 AsyncStorage 存 Session，不创建第二套 BearerToken。

Session 恢复完成前显示加载边界，已初始化的导航在刷新时保持。身份/角色变化或退出会清理私有 Query 缓存。登录后根据服务器角色跳转，客户端 `next` / `returnTo` 必须经过允许列表校验，不能包含邀请凭证。

### 邀请凭证不是登录

Invitation bearer token 是可转发的领取资格，不是 Session。独立 Web 从链接 fragment 读取凭证，用当前 tab 的 sessionStorage 支持登录往返；领取成功或主动清除后移除。Web 没有额外的 30 分钟保留上限，领取资格始终由服务器有效期决定。

Mobile 原生端使用独立 SecureStore，Mobile 的 Expo Web 预览使用 tab sessionStorage，最多保留 30 分钟或已知服务器有效期。新链接替换旧凭证；领取成功、主动清除、退出、身份/角色变化，以及过期/撤销/耗尽时清除。持久化失败会显示警告，当前内存中的流程可继续；非法新链接不能静默回退旧凭证。

服务器再次检查票种、额度和有效期，预览不预留库存。原生 `chainpass://` 需要已安装的构建，尚无 Universal Links / App Links。具体生命周期见[Mobile](../apps/mobile/README.md#zh)。

### 钱包身份

钱包不是 User。五分钟 challenge 绑定 Session User、规范化地址、chain ID、随机 nonce、存储的消息和有效期；`recoverMessageAddress` 验证个人签名。事务内完成一次性消耗和 Wallet 写入，userId/address 各自唯一；不能用另一个 Session 复用 challenge。

连接钱包不等于绑定；前端先签 challenge 再 verify。当前仅 EOA，没有 EIP-1271、SIWE 登录、解绑/换绑。API Mint 从绑定 Wallet 取得 recipient；issuer key 只在服务器运行时。

### 安全与维护

Auth 与 QR 密钥分别生成，issuer 密钥和 RPC 凭证仅供 API 运行时使用。Git 与镜像排除真实 `.env` 和 keystore；不打印 Session、Cookie 或密码。`apps/api/.env.example` 中 `JWT_SECRET` 是未使用的旧模板字段，不代表当前有 JWT 认证体系。

修改身份能力时同时检查 Server、两个 Client、Role 声明、Ownership 和 E2E。至少覆盖匿名 401、错误角色 403、跨资源拒绝、角色升级、challenge 失效/重放、Session/私有 cache 清理。真实设备重启恢复、Wallet handoff 和生产 Cookie 是独立验收，不以 build 或 export 代替。

参见[API契约](./API_CONTRACT.md#zh)、[技术细节](./TECHNICAL_DETAILS.md#zh)。

---

<a id="en"></a>

## English

**Better Auth is the sole authentication system.** There is no parallel JWT/custom login/Wallet User. auth.ts, permissions.ts and endpoint Session/permission/ownership checks define trust.

### Implementation

NestJS 12/@thallesp hosts Better Auth 1.7 with PostgreSQL/Prisma adapter, Admin and Expo plugins. Auth owns user/session/account/verification; Event/Pass/Wallet relate to the same User. /api/auth/* handles email/password signup/signin/signout/session. Web uses the existing cookie client; Mobile uses Expo/SecureStore. bodyParser:false preserves Auth handling. No social OAuth or wallet login is configured.

### Roles

User can discover/preview invitations, claim own passes, view and bind/mint/QR. Merchant manages own events/tickets/invitations and entry, without claim/mint permission. Admin manages Auth users/platform events/cross-organizer operations, but owner-only rules still apply. Anonymous users may discover public events/preview valid invitations; protected calls return 401.

Registration defaults user with no role selection. Official Admin setRole promotes merchants; no custom DB role update. First-admin provisioning needs deliberate authority. Local Demo bootstrap is guarded to localhost:55432/chainpass, not production.

Permission declarations for update/delete/revoke do not implement endpoints. Role permission does not bypass ownership; /events/admin explicitly requires admin, not generic event:read.

### Trust and origins

Session → permission → ownership → business state/transactional constraints. Client bodies cannot decide user/organizer/owner/verifier/role. Even admin mints/generates QR only for own ACTIVE Pass. Route gates/safe redirects are UX, not security.

BETTER_AUTH_SECRET/URL are required; WEB_ORIGIN is trusted. chainpass:// is allowed; localhost ports 3000/8081 and exp:// patterns are nonproduction only. Origin/CSRF remain enabled.

The direct local API on :3001 uses /api/auth; a production business base ending /api must not become /api/api/auth. Web AUTH_URL is the public Auth origin; Mobile derives the correct root, with regression tests. Compose derives Auth/origin from PUBLIC_URL; public Web URLs are build-time. HTTP teaching service is not HTTPS acceptance; TLS requires forwarded-proto/cookie/origin review.

### Sessions and invitations

Postgres persists Session; Web uses cookies; Native Expo auth state is in SecureStore and cookies reach injected API transport. AsyncStorage is not Session storage, and no second bearer system exists.

Initial restore shows a loading boundary; an initialized navigator survives Session refresh. Identity/role changes/signout clear private Query cache. Role comes from the server Session. Client-supplied next/returnTo destinations are validated against allowed local routes and never carry invitation credentials.

Invitation tokens are transferable claim authority, not login. Standalone Web reads the fragment and uses tab sessionStorage for the authentication handoff; successful claim or explicit clear removes it. It has no additional 30-minute retention cap; server expiry still determines eligibility.

Mobile uses separate native SecureStore, or tab sessionStorage in its Expo Web preview, capped at 30 minutes or known server expiry. Replacement, successful claim, clear, signout, identity/role changes and terminal expiry/revocation/exhaustion clear it. Persistence failure warns while permitting the current in-memory flow; malformed new links cannot silently restore a stale credential. Server rechecks ticket/quota/expiry; preview reserves nothing. Installed chainpass:// builds are supported, not Universal/App Links.

### Wallets and security

Five-minute challenges bind Session/canonical address/chain/nonce/message/expiry. recoverMessageAddress verifies EOA personal signatures; transactional one-use consumption plus unique wallet user/address prevent replay/races. Connection is not binding. No EIP-1271, SIWE login, unbind/rebind exists. Mint recipient comes from bound Wallet; issuer key is API-runtime-only.

Auth/QR secrets are separate; issuer/RPC credentials never enter client/Git/images. Do not print cookies/passwords/keys. JWT_SECRET remains an unused legacy example field, not a reason to introduce another auth system.

Changes require Server/clients/roles/ownership/E2E checks for 401/403/resource boundaries/promotion/challenge replay/cache cleanup. Physical Session restoration, wallet handoff and production cookies require separate acceptance. See [API](./API_CONTRACT.md#en), [technical](./TECHNICAL_DETAILS.md#en), [Mobile](../apps/mobile/README.md#en).
