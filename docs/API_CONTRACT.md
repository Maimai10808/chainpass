# ChainPass API Contract

本文约束 ChainPass 业务 API 的设计、发布和客户端消费方式。Authentication 端点继续由 Better Auth 提供，详细边界见 [AUTH_ARCHITECTURE.md](./AUTH_ARCHITECTURE.md)。工程依赖方向见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 1. 当前状态与目标链路

当前业务 Contract 包含 Event 创建/发布、Merchant 管理查询、公开活动列表/详情，以及 TicketType 创建/列表。NestJS 负责路由、Role/Ownership 权限与 OpenAPI metadata，`@chainpass/schemas` 提供跨 API/Web 边界的 Zod 输入/输出 Schema，`@chainpass/api-client` 封装调用。Swagger UI 位于 `/docs`，JSON Contract 位于 `/docs/openapi.json`。Pass 与 CheckIn Contract 尚未实现。

Event 接口边界如下：

| Method | Path                            | Access          | Semantics                                                           |
| ------ | ------------------------------- | --------------- | ------------------------------------------------------------------- |
| `POST` | `/events`                       | merchant/admin  | 创建 `DRAFT` Event，organizer 来自 Session                          |
| `GET`  | `/events/:eventId/manage`       | organizer/admin | 返回 Merchant 管理所需的完整 Event                                  |
| `POST` | `/events/:eventId/publish`      | organizer/admin | 满足发布规则后执行 `DRAFT → PUBLISHED`；重复发布幂等返回当前 Event  |
| `GET`  | `/events`                       | public          | 只返回 `PUBLISHED` Event 的公开字段                                 |
| `GET`  | `/events/:eventId`              | public          | 只返回 `PUBLISHED` Event 与 `ACTIVE` TicketType；Draft 按未找到处理 |
| `POST` | `/events/:eventId/ticket-types` | organizer/admin | 创建 TicketType                                                     |
| `GET`  | `/events/:eventId/ticket-types` | authenticated   | 返回管理流程的 TicketType 列表                                      |

发布 Event 前服务端按 Authentication → Permission → Ownership → Business Rule 校验：merchant 只能发布自己组织的 Event，admin 可发布任意 Event；Event 必须存在、时间范围合法，并至少拥有一个 `ACTIVE` TicketType。缺少可发行票种返回 `400 EVENT_HAS_NO_ACTIVE_TICKET_TYPES`。

公开 Event Detail 不暴露 `organizerId`、创建时间等内部管理字段。公开 TicketType 只包含 `ACTIVE` 项，并由服务端计算 `remaining = totalSupply - claimedCount`。

TicketType 的 `price` 以最小货币单位的非负整数写入 PostgreSQL `BIGINT`；创建请求使用 JavaScript 安全整数，响应使用十进制字符串避免 JSON/JavaScript 精度损失，`"0"` 表示免费票。`claimedCount` 由服务端初始化为 `0`，客户端不能提交。Merchant 创建票种前必须通过 Event ownership 校验，admin 可以代管，查询接口保持为已登录用户可读的简单列表。

业务 API 的目标链路是：

```text
NestJS DTO + Controller
    ↓
OpenAPI / Swagger document
    ↓
@chainpass/api-client
    ↓
Next.js + React Native
```

这是一条实施约束，不是当前已经完成的生成流水线。

## 2. Source of Truth

NestJS 暴露的业务 API Contract 是服务端接口事实来源，包括：

- 路径、HTTP method 与 operation ID；
- Request path/query/body DTO；
- 成功 Response DTO 与状态码；
- 错误状态、错误码和可展示信息；
- Authentication/Authorization requirement；
- 分页、排序、过滤与时间格式。

DTO 和 OpenAPI metadata 必须同步。Web/Mobile 通过 `@chainpass/api-client` 消费同一 Contract，不在页面、hook 或 platform service 中各自手写重复 DTO。

`@chainpass/schemas` 只承载确实跨边界共享且有运行时校验价值的 Zod Schema。它不能成为与 NestJS/OpenAPI 并行、需要人工同步的第二套完整 Contract。

## 3. NestJS Contract 规则

每个业务 endpoint 应明确：

- 一个稳定且语义清晰的 operation ID；
- 完整的 Request/Response DTO，避免 `any`、模糊对象与未声明字段；
- 必填、可选、nullable 的区别；
- enum、格式、长度、数值范围和示例；
- Auth 是否必需、允许的 Role/Permission；
- 资源 Ownership 与业务状态限制；
- 可预期的 4xx/5xx 状态和机器可识别错误码。

内部 Prisma Model 不是外部 DTO。Controller 不直接暴露 Prisma 记录；通过 DTO 控制字段、日期、枚举与敏感信息。

## 4. API Client 规则

`@chainpass/api-client` 是 Web 与 Mobile 的统一业务访问层。当前 Web 分别通过 `getManagedEvent`、`publishEvent`、`listPublishedEvents` 和 `getPublishedEvent` 消费管理与公开 Contract。它应：

- 从 OpenAPI 生成类型/Client，或在生成链路落地前集中维护唯一实现；
- 使用调用方提供的 base URL 和平台适配的 Session/Cookie transport；
- 返回可辨识的成功类型与错误类型；
- 统一序列化 path/query/body、日期和可选值；
- 保持 UI 框架无关，不导入 Next.js、React Native 或 NestJS implementation。

业务页面默认不直接散落：

```ts
fetch("/api/...");
```

若某个尚未生成的 endpoint 暂时必须直接 request，应把调用集中在 `@chainpass/api-client` 或应用内单一过渡 adapter，并复用服务端 Contract 类型来源；不得让 Web 和 Mobile 各自形成长期实现。

Better Auth 的 `signIn`、`signUp`、`signOut`、`useSession` 继续通过各端已有 Better Auth Client 使用，不为了形式统一将其复制成业务 API DTO。

## 5. Response 与 Error

当前业务 API 尚未建立统一 response envelope。第一批 Vertical Slice 不应先设计复杂 envelope。

默认原则：

- 成功响应直接返回 endpoint 的明确 DTO；
- 创建使用 `201`，查询/修改使用合适的 `200`/`204`；
- 错误至少提供稳定 `code` 和人类可读 `message`；
- validation、authentication、authorization、not found、conflict 和业务状态错误使用可区分的 HTTP status；
- 不把 stack、SQL、secret、内部路径或 provider 原始敏感信息返回客户端。

如果实现中决定统一 `{ data, message, error }`，必须先用一个真实 endpoint 验证其必要性，并同步 OpenAPI、Client 和所有调用方；不得同时保留包裹与非包裹两种无规则格式。

建议的最小错误形态：

```json
{
  "code": "PASS_ALREADY_CHECKED_IN",
  "message": "Pass has already been checked in"
}
```

字段级 validation detail 可以附加，但其结构也必须进入 OpenAPI Contract。

## 6. Authentication 与可信身份

业务 endpoint 的用户身份来自 Better Auth Session：

```text
Request
  ↓
Better Auth Session
  ↓
session.user.id / role
  ↓
Permission + Ownership + Business Rule
```

客户端不得通过以下字段决定可信身份：

```text
ownerId
organizerId
verifiedById
checkedInById
role
```

例如 Claim Pass 请求只提交业务选择（如 `eventId`、`ticketTypeId`）；`ownerId` 由 Session 产生。Merchant 修改 Event 时按以下顺序验证：

```text
Authenticated
  → merchant/admin role
  → event:update permission
  → organizer ownership
  → current event state permits update
```

如果 endpoint 需要代表钱包完成链上操作，Session User 与已验证 Wallet 的绑定也必须由服务端确认，不能信任任意客户端地址声明。

## 7. DTO 与 Schema 边界

推荐区分：

- Request DTO：客户端允许提交的字段；
- Response DTO：客户端稳定可见的字段；
- Domain/Prisma Model：API 内部状态与关系；
- Shared Schema：两个以上边界消费者需要的运行时校验；
- On-chain type：ABI、address、transaction 和 chain-specific 数据。

不要把整个 Prisma Model 导出到前端，也不要让前端根据数据库字段猜测 API。链上 `uint256`、地址、交易 hash 等值需要在 Contract 中声明 JSON 表示方式；大整数不得依赖 JavaScript `number` 的隐式精度。

日期/时间在第一批 DTO 中统一使用带时区的 ISO 8601 字符串；数据库保存和业务展示的时区策略应由服务端明确，客户端不猜测裸字符串。

## 8. 列表、库存与幂等

第一批列表接口只引入主链需要的分页、过滤和排序，参数与默认值写入 OpenAPI。不要提前构建通用 query language。

Claim、Mint 和 Check-in 都可能被重复点击、网络重试或链上回调重复触发，Contract 必须定义：

- 唯一约束或 idempotency key；
- 重复请求返回同一结果还是明确 conflict；
- DB 状态与 transaction hash 的关系；
- pending、confirmed、failed 等状态是否对客户端可见；
- Check-in 如何保证同一 Pass 不重复核销。

这些规则应由业务 API 承担，不能只依赖按钮禁用或客户端本地状态。

## 9. Versioning

三天 Hackathon 阶段不主动引入复杂 API versioning。当前可保持无 `/api/v1` 的业务路径；在移动端进入真实发布、需要兼容旧 Client 时，再基于实际兼容需求评估版本策略。

破坏性 Contract 变更在当前阶段仍必须原子更新所有仓库内消费者，不能以“尚未 v1”为由让调用方猜测。

## 10. Contract Change Checklist

每次新增或修改业务接口，完成以下闭环：

1. 更新 NestJS DTO、Controller metadata 和业务校验。
2. 更新/生成 OpenAPI，并检查 operation、required/nullable、enum、状态码和 Auth 描述。
3. 更新 `@chainpass/api-client` 与必要的 `@chainpass/schemas`。
4. 更新全部 Web/Mobile 调用方，不保留重复旧类型。
5. 增加覆盖成功、未登录、无权限、Ownership、非法状态及关键幂等场景的最小测试。
6. 运行相关 lint、typecheck、test/build，并检查生成产物没有未解释漂移。

Backend Contract 变更与调用方修复属于同一个 Vertical Slice。完成标准见 [DEVELOPMENT_SCOPE.md](./DEVELOPMENT_SCOPE.md)。
