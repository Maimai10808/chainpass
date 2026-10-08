# ChainPass 开发范围 / Development Scope

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

当前优先级是一条真实业务闭环，而不是目录/框架数量。三天 Hackathon 最初目标已扩展为当前 Web/Native 实现；不要把历史计划当今天状态。

### 已实现

- Better Auth Session/RBAC，User/Merchant/Admin 与资源归属规则。
- Merchant Event/ACTIVE TicketType/Publish，PUBLIC 发现与默认 INVITE_ONLY。
- 指定票种邀请：创建、限次数/有效期、分享、撤销、匿名预览。
- Claim：quota/stock/Pass 同事务，独立 owner Pass 与防重复。
- My Passes/Detail、签名 Wallet Binding、issuer Mint/链 DB 恢复。
- 动态 HMAC QR、原有 Verify/原子 CheckIn、QR/手工模式。
- Web 三角色产品；Mobile 三角色 Native 界面与邀请交接/分享入口。
- Sepolia 合约部署、Sourcify 与历史真实应用 Mint 证据。
- Docker 生产配置、CI 与人工触发 CD；实验五端工程骨架。

### 完成与验收分层

已有 2026-10-08 本地邀请浏览器/API/DB 验收、93 个 E2E 通过 / 1 个 opt-in 跳过、Mobile 25 个纯逻辑测试与 Hermes 导出 记录；详见[Mobile](../apps/mobile/README.md#zh)。这些是历史记录，本轮文档未重跑。

尚需验证：iOS/Android 安装、相机、外部钱包签名返回、haptics、系统分享、SecureStore 进程重启与安装深链。无 HTTPS Universal/App Links。生产 HTTP/camera、异机备份/restore 与 issuer 长期托管仍未完成；当前分支不自动代表线上版本。

### 验收路径

```text
Merchant create → ticket → publish → invitation / explicit public
→ User login/claim → own Pass
→ optional wallet/mint → QR
→ Merchant verify/confirm → CHECKED_IN → replay rejected
→ User foreground/refetch shows new state
```

没有钱包仍应可核销。演示数据库手工 INSERT/直接合约 Mint 不能代替应用路径；公共链测试必须有明确授权，不能因为 CI 通过就广播交易。

### Vertical Slice 与 Definition of Done

DB/constraints → API/authorization → DTO/OpenAPI/schema/client → clientUX → tests/acceptance。一个 Slice 至少满足正常/拒绝路径、loading/empty/error、服务端幂等或冲突、Secret 边界和文档；链业务另需真实 chain/receipt/hash 关联证据。

后续修改邀请不复制 Claim，QR 不复制核销，角色扩展不新建 Auth。接口变更原子更新消费者，实验端不加入生产门禁。日常发布见[运维](./OPERATIONS.md#zh)。

### 非目标

支付/退款、转让/二级市场、组织多租户、复杂 analytics、钱包登录、微服务/Kubernetes/队列、无真实消费者的共享 UI 与状态平台不在当前范围。活动编辑/删除、Pass 撤销 API 也未实现，不允许用界面伪装。

需求先判断是否推进闭环、能否验收、是否保持 API/Auth/数据边界；遇到新的高风险授权或范围扩张先明确决策。

---

<a id="en"></a>

## English

Prioritize one real business loop, not directory/framework count. The original three-day target has evolved into current Web/native implementation; historical plans are not current state.

Implemented: Better Auth/RBAC/ownership; events/tickets/publication and default invitations; ticket-specific quota/expiry/share/revoke/preview; atomic claim; owner Pass/detail; signature Wallet/Mint/recovery; HMAC QR and existing verify/atomic admission; Web/Mobile role workspaces; Sepolia deployment/mint evidence; Docker/CI/manual CD; five experimental scaffolds.

Recorded 2026-10-08 local invitation acceptance includes 93 E2E/one opt-in skip, 25 Mobile pure tests and Hermes exports. See [Mobile](../apps/mobile/README.md#en). Not rerun during this documentation edit.

Pending: physical installation/camera/wallet handoff/haptics/sharing/SecureStore restart/deep links; Universal/App Links; HTTPS camera and off-host restore/issuer custody. Current source does not automatically equal live production.

Acceptance: merchant create/ticket/publish/invite or explicit public → user login/claim → optional wallet/mint → QR → merchant verify/confirm → CHECKED_IN/replay rejected → foreground/refetch. Off-chain admission must work. Direct DB inserts/contract mints cannot impersonate application acceptance; chain writes need explicit authority.

Vertical slice: DB constraints → API authorization → DTO/OpenAPI/schema/client → UX → tests. Done includes success/rejection, loading/empty/error, server idempotency/conflict, secret boundaries and docs. Chain changes additionally need chain/receipt/hash evidence. Reuse claim/admission/Auth; update consumers atomically; keep experimental checks separate.

Not in scope: payments/refunds/transfer/marketplace/complex analytics/teams/wallet login/microservices/clusters/queues/speculative shared UI. Event edit/delete and Pass revocation APIs are absent. See [operations](./OPERATIONS.md#en) for release; material scope/authority expansions require a decision.
