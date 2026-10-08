# ChainPass API 契约 / API Contract

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

本文是接口边界/协作规则，不替代 Swagger。服务端 DTO/Controller/OpenAPI 在 apps/api，跨应用 Schema/Client 在 packages；当前 Client 集中手工维护，自动生成未落地。身份端点由 Better Auth 提供，见[认证](./AUTH_ARCHITECTURE.md#zh)。

### 路由

下表是 NestJS 直连业务路径。生产公网普通业务加 `/api`；Auth 本来就是 `/api/auth/*`，代理不能重复加前缀。Swagger 为 `/docs` 和 `/docs/openapi.json`。未登录受保护请求 401，错误角色或归属 403。

| 方法   | 路径                                 | 权限               | 行为                                           |
| ------ | ------------------------------------ | ------------------ | ---------------------------------------------- |
| `POST` | `/events`                            | merchant/admin     | 创建 DRAFT，默认邀请制，organizer 来自 Session |
| `GET`  | `/events`                            | public             | 仅 PUBLIC + PUBLISHED                          |
| `GET`  | `/events/mine`                       | merchant/admin     | 只列当前 organizer                             |
| `GET`  | `/events/admin`                      | admin              | 全平台，显式 admin 角色                        |
| `GET`  | `/events/:eventId`                   | public             | 仅公开已发布详情与 ACTIVE 票种                 |
| `GET`  | `/events/:eventId/manage`            | organizer/admin    | 完整管理 Event                                 |
| `POST` | `/events/:eventId/publish`           | organizer/admin    | 合法日期、至少一个 ACTIVE 票种；重复幂等       |
| `POST` | `/events/:eventId/ticket-types`      | organizer/admin    | 创建票种、库存与价格元数据                     |
| `GET`  | `/events/:eventId/ticket-types`      | organizer/admin    | 受归属限制的管理列表                           |
| `POST` | `/events/:eventId/invitations`       | organizer/admin    | 已发布邀请制；绑定 ACTIVE 票种；token 仅一次   |
| `GET`  | `/events/:eventId/invitations`       | organizer/admin    | quota/expiry/revocation，无 token/hash         |
| `POST` | `/invitations/:invitationId/revoke`  | organizer/admin    | 幂等撤销；已领 Pass 不受影响                   |
| `POST` | `/invitations/resolve`               | bearer link        | 匿名预览指定活动/票种，不消费次数              |
| `POST` | `/ticket-types/:ticketTypeId/claim`  | user/admin         | 可选 invitationToken；事务领取                 |
| `GET`  | `/passes/me`                         | authenticated      | 仅 Session owner                               |
| `GET`  | `/wallets/me`                        | authenticated      | 已验证 Wallet 或 null                          |
| `POST` | `/wallets/challenge`                 | authenticated      | 五分钟一次性签名挑战                           |
| `POST` | `/wallets/verify`                    | authenticated      | 签名验证与唯一绑定                             |
| `POST` | `/passes/:passId/mint`               | user/admin + owner | ACTIVE、已绑定；幂等/恢复                      |
| `POST` | `/passes/:passId/verification-token` | owner              | 仅 ACTIVE，60 秒 HMAC QR                       |
| `GET`  | `/passes/:passId/verify`             | organizer/admin    | 只读；可选链上增强                             |
| `POST` | `/passes/verify-token`               | organizer/admin    | 验签/expiry/DB 后复用 Verify                   |
| `POST` | `/passes/:passId/check-in`           | organizer/admin    | QR/MANUAL，原子一次性核销                      |

### 关键输入输出

- CreateEvent：name/description/coverImageUrl/location/startsAt/endsAt/accessMode；省略 accessMode 默认 INVITE_ONLY。无更新 accessMode 入口。公开查询不泄漏 Draft/私有详情。
- TicketType：name/description/price/totalSupply；claimedCount 服务端初始化，状态默认 ACTIVE。price 请求安全非负整数、DB BIGINT、响应十进制字符串；不是支付流程。
- Invitation create：ticketTypeId/maxUses/expiresAt；未来带时区时间、正整数 quota。resolve：{token}；创建一次返回原始 token，列表不返回 tokenHash。响应 private/no-store。
- Claim body：可空或{invitationToken}。PUBLIC 允许空 body，邀请制缺 token 为 INVITATION_REQUIRED；owner 固定 Session。返回 Pass 与 remaining。quota/库存/Pass 同事务，Pass 票种+owner 唯一。
- Wallet：challenge 提交 address/chainId；verify 提交 challengeId/signature。不能提交 userId。连接不等于绑定，challenge 五分钟且一次性。
- Mint 无 recipient；从绑定 Wallet 取目标。仅自己的 ACTIVE Pass，receipt/owner 验证后写完整字段；已 Mint/链成功 DB 失败重试恢复。tokenId 与 uint256 用字符串。
- QR 返回{token,expiresAt}；输入 verify-token 为{token}。Payload v/passId/ownerId/nonce/iat/exp，HMAC 签名 60 秒，DB 状态重新校验。
- Check-in 仅 method=MANUAL/QR；verifiedById 来自 Session，唯一 CheckIn+条件 ACTIVE 更新防重。
- PassView 的 ON_CHAIN_VERIFIED 是已持久化 Mint 字段，不等于该请求新查 RPC。Verify 的 NOT_MINTED/VERIFIED/MISMATCH/UNAVAILABLE 为链上增强，不阻塞业务有效核销。

### 错误约定

无统一 success envelope；明确 DTO 直接返回。错误使用 HTTP status、code、message，不泄漏 stack/SQL/Secret。主要可预期错误：

| Code                                                                                     | 状态/含义                             |
| ---------------------------------------------------------------------------------------- | ------------------------------------- |
| EVENT_HAS_NO_ACTIVE_TICKET_TYPES                                                         | 400，不能发布                         |
| EVENT_NOT_FOUND                                                                          | 404，含公开查询到 Draft/邀请制        |
| INVITATION_REQUIRED                                                                      | 403，邀请制缺凭证                     |
| INVALID_INVITATION                                                                       | 400，格式/未知/票种错配               |
| INVITATION_EXPIRED / REVOKED / EXHAUSTED / UNAVAILABLE（均加 INVITATION_前缀）           | 409，资格失效                         |
| PASS_ALREADY_CLAIMED / TICKET_TYPE_SOLD_OUT / EVENT_NOT_PUBLISHED / TICKET_TYPE_INACTIVE | 409，领取冲突                         |
| PASS_NOT_ACTIVE                                                                          | 409，Mint/QR 前置状态                 |
| INVALID_QR_TOKEN / QR_TOKEN_EXPIRED                                                      | 400，篡改/过期，不能混成 INVALID PASS |
| PASS_ALREADY_CHECKED_IN                                                                  | 409，核销防重                         |

详见 DTO/Controller/tests 以确认各 endpoint 精确字段，不引入未经实现的分页/envelope。业务列表目前按实际实现返回数组；Admin 用户列表分页由 Better Auth 负责。

### 契约维护

Request、Response、Prisma 内部 Model、SharedSchema 与 On-chain JSON 类型分开；客户端不导入 Prisma。日期带时区 ISO8601，BigInt 用 string。可信身份只来自 Session，不能从 ownerId/organizerId/verifier/role body 决定。

变更必须同步 DTO/OpenAPI、Zod、Client、Web/Mobile 与成功/401/403/ownership/状态/并发测试。未做/api/v1，破坏性变更也不能让消费者猜测。接口声明中的权限不代表 update/delete/revoke 功能已经实现。

Mobile 邀请已复用这些 API；Web fragment、Native SecureStore/粘贴/scheme 只是交接凭证，不新增第二套 Claim。详见[技术说明](./TECHNICAL_DETAILS.md#zh)。

---

<a id="en"></a>

## English

DTO/Controller/OpenAPI in apps/api define server behavior; shared Zod/client packages define consumer boundaries. The client is currently handwritten, not generated. Better Auth owns authentication, see [Auth](./AUTH_ARCHITECTURE.md#en).

### Routes

These are direct Nest business paths. Public gateway adds /api to ordinary business routes; Auth already owns /api/auth/*. Swagger is /docs and /docs/openapi.json. Protected anonymous calls return 401; wrong role/ownership 403.

| Method | Path                                 | Access             | Behavior                                               |
| ------ | ------------------------------------ | ------------------ | ------------------------------------------------------ |
| `POST` | `/events`                            | merchant/admin     | Create DRAFT; default INVITE_ONLY; Session organizer   |
| `GET`  | `/events`                            | public             | PUBLIC + PUBLISHED only                                |
| `GET`  | `/events/mine`                       | merchant/admin     | Current organizer only                                 |
| `GET`  | `/events/admin`                      | admin              | Platform list; explicit admin role                     |
| `GET`  | `/events/:eventId`                   | public             | Public published detail/ACTIVE tickets                 |
| `GET`  | `/events/:eventId/manage`            | organizer/admin    | Managed event                                          |
| `POST` | `/events/:eventId/publish`           | organizer/admin    | Valid dates/ACTIVE ticket; repeat idempotent           |
| `POST` | `/events/:eventId/ticket-types`      | organizer/admin    | Create ticket/stock/price metadata                     |
| `GET`  | `/events/:eventId/ticket-types`      | organizer/admin    | Ownership-protected management list                    |
| `POST` | `/events/:eventId/invitations`       | organizer/admin    | Published private/ACTIVE ticket; one-time token output |
| `GET`  | `/events/:eventId/invitations`       | organizer/admin    | Quota/expiry/revocation; no token/hash                 |
| `POST` | `/invitations/:invitationId/revoke`  | organizer/admin    | Idempotent revoke; preserves passes                    |
| `POST` | `/invitations/resolve`               | bearer link        | Anonymous designated preview; no quota use             |
| `POST` | `/ticket-types/:ticketTypeId/claim`  | user/admin         | Optional invitationToken; atomic claim                 |
| `GET`  | `/passes/me`                         | authenticated      | Session owner's passes                                 |
| `GET`  | `/wallets/me`                        | authenticated      | Verified wallet or null                                |
| `POST` | `/wallets/challenge`                 | authenticated      | Five-minute one-use challenge                          |
| `POST` | `/wallets/verify`                    | authenticated      | Signature verification/unique binding                  |
| `POST` | `/passes/:passId/mint`               | user/admin + owner | ACTIVE/bound wallet; idempotency/recovery              |
| `POST` | `/passes/:passId/verification-token` | owner              | ACTIVE only; 60-second HMAC QR                         |
| `GET`  | `/passes/:passId/verify`             | organizer/admin    | Read-only; optional chain evidence                     |
| `POST` | `/passes/verify-token`               | organizer/admin    | Signature/expiry/DB then existing verify               |
| `POST` | `/passes/:passId/check-in`           | organizer/admin    | QR/MANUAL atomic admission                             |

### Contracts

CreateEvent defaults INVITE_ONLY; no accessMode update API. Public detail hides draft/private. Ticket creation defaults ACTIVE/claimedCount 0; safe nonnegative integer price becomes BIGINT/decimal response string, not a payment.

Invitation create accepts ticketTypeId/maxUses/future expiresAt; resolve accepts {token}. Raw token is output once; lists omit token/hash; responses are private/no-store. Claim accepts empty body or optional invitationToken: PUBLIC permits empty, private requires a matching valid token. Session owner is authoritative. Quota/stock/Pass are one transaction; duplicate ticket/owner is forbidden.

Wallet challenge accepts address/chainId; verification challengeId/signature. No userId; five-minute one-use signature, connection is not binding. Mint accepts no recipient, uses bound wallet, ACTIVE owner and confirmed receipt/owner checks. Idempotent/recovery returns existing chain identity; uint256 values use strings.

QR returns {token,expiresAt}; verify-token takes {token}. HMAC payload v/passId/ownerId/nonce/iat/exp expires after 60 seconds and DB is reloaded. Check-in accepts only QR/MANUAL, Session verifier, conditional ACTIVE update and unique CheckIn.

PassView ON_CHAIN_VERIFIED means persisted complete metadata, not a fresh chain read. Verify chain NOT_MINTED/VERIFIED/MISMATCH/UNAVAILABLE is advisory and does not block business-valid admission.

### Errors and evolution

Success DTOs have no universal envelope. Errors expose HTTP/code/message, not SQL/stack/secret. Publication without active tickets: 400; public draft/private detail: 404; missing invitation: 403; invalid/mismatched invitation: 400; expired/revoked/exhausted/unavailable invitation: 409; duplicate/sold-out/unpublished/inactive claim: 409; inactive Pass: 409; invalid/expired QR: 400; duplicate check-in: 409.

Use exact DTOs/controllers/tests for fields. Business lists currently return arrays; Better Auth owns admin-user pagination. No /api/v1 exists. Request/response/internal Prisma/shared schema/on-chain JSON remain distinct; dates are timezone ISO8601 and BigInt strings.

Every change updates DTO/OpenAPI/Zod/client/consumers and success/401/403/ownership/state/race tests atomically. Permission declarations do not implement edit/delete/revoke. Mobile invitations reuse the same contract, not another claim flow. See [internals](./TECHNICAL_DETAILS.md#en).
