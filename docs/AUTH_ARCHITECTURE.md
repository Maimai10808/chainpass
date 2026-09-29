# ChainPass Authentication Architecture

> 本文档定义 ChainPass 当前统一的身份认证、Session、用户角色和权限架构。
>
> 任何涉及以下内容的开发，在开始实现之前都应优先阅读本文档：
>
> - 登录 / 注册
> - Session
> - 用户身份
> - 用户角色
> - RBAC / 权限
> - Web 鉴权
> - Mobile 鉴权
> - NestJS API 权限保护
> - 管理员能力
> - 商家身份
> - Wallet Login / Web3 Authentication
> - OAuth / Social Login
>
> **禁止 Web、Mobile、Backend 或 Blockchain 模块自行重新实现一套独立鉴权体系。**

---

# 1. 核心原则

ChainPass 使用：

**Better Auth 作为统一身份认证系统。**

当前整体架构：

```text
                    Better Auth
                         │
                 Identity / Session
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
      Next.js         NestJS          Expo
        Web             API           Mobile
          │              │              │
          └──────────────┼──────────────┘
                         │
                      Prisma
                         │
                    PostgreSQL
```

核心原则：

> **整个 ChainPass 只有一套用户身份体系。**

用户是谁、是否登录、Session 是否有效、用户是什么角色，统一由 Better Auth 决定。

---

# 2. 当前技术实现

当前认证技术栈：

```text
Authentication
Better Auth 1.7.x

Backend Integration
NestJS
@thallesp/nestjs-better-auth

Database Adapter
Better Auth Prisma Adapter

Database
PostgreSQL

ORM
Prisma 7

Web Client
better-auth/react

Mobile Client
better-auth/react
@better-auth/expo/client

Mobile Session Storage
expo-secure-store
```

---

# 3. Auth Server 所在位置

Better Auth Server 运行在：

```text
apps/api
```

核心文件：

```text
apps/api/src/auth/
├── auth.ts
└── permissions.ts
```

Prisma：

```text
apps/api/src/lib/prisma.ts
```

Better Auth HTTP Endpoint：

```text
/api/auth/*
```

本地开发地址：

```text
http://localhost:3001/api/auth/*
```

例如：

```text
POST /api/auth/sign-up/email
POST /api/auth/sign-in/email
POST /api/auth/sign-out

GET  /api/auth/get-session

POST /api/auth/admin/set-role
```

业务模块不得重新实现：

```text
/login
/register
/session
/refresh-token
/logout
```

等平行 Authentication API。

优先直接消费 Better Auth。

---

# 4. Better Auth Server 配置

Better Auth Server 当前位于：

```text
apps/api/src/auth/auth.ts
```

当前主要能力：

```text
Better Auth
│
├── Prisma Adapter
├── Email + Password
├── Admin Plugin
├── Expo Plugin
├── Trusted Origins
└── Custom Roles / Access Control
```

当前开启：

```text
emailAndPassword.enabled = true
```

第一阶段使用：

```text
Email
+
Password
+
Session
```

作为基础登录体系。

---

# 5. 数据库模型

Better Auth 当前拥有以下核心模型：

```text
User
Session
Account
Verification
```

这些模型已经：

```text
Better Auth
     ↓
Prisma Schema
     ↓
Prisma Migration
     ↓
PostgreSQL
```

完成正式初始化。

---

# 6. User 是唯一身份源

非常重要：

> **业务系统不得再次创建第二套 User 表。**

当前：

```text
Better Auth User
```

就是 ChainPass 用户身份的唯一来源。

未来：

```text
Event
Pass
CheckIn
MerchantProfile
Wallet
```

等业务模型应该关联现有 Better Auth User。

例如：

```text
User
 │
 ├── Organized Events
 │
 ├── Passes
 │
 ├── CheckIns
 │
 └── Wallets
```

而不是：

```text
BetterAuthUser
+
BusinessUser
+
WalletUser
```

形成多套互相同步的用户体系。

---

# 7. 当前三种角色

ChainPass 当前定义三个核心角色：

```text
admin
merchant
user
```

显示层可以使用：

```text
ADMIN
MERCHANT
USER
```

数据库 / Better Auth 内部统一使用：

```text
admin
merchant
user
```

---

# 8. USER

普通用户注册以后默认：

```text
role = user
```

USER 主要权限：

```text
Event
└── read

Pass
├── claim
└── read
```

业务含义：

```text
浏览活动
查看活动
领取 Pass
查看自己的 Pass
使用 Pass
```

---

# 9. MERCHANT

MERCHANT 是活动主办方 / 商家。

主要权限：

```text
Event
├── create
├── read
├── update
├── delete
└── publish

Pass
├── read
├── verify
└── check-in
```

业务含义：

```text
创建活动
管理活动
发行门票
查看领取情况
核验 Pass
现场 Check-in
```

普通用户不能自行把自己升级为 merchant。

当前角色升级应由：

```text
ADMIN
```

完成。

---

# 10. ADMIN

ADMIN 是 ChainPass 平台级管理员。

ADMIN 拥有：

```text
Better Auth Admin 权限
+
ChainPass 平台业务权限
```

包括：

```text
用户管理
Session 管理
角色管理

商家管理
活动管理
Pass 管理
平台治理
```

ADMIN 可以执行例如：

```text
user
↓
merchant
```

角色提升。

当前已经验证：

```text
USER → MERCHANT
```

可通过 Better Auth Admin API 正常完成。

---

# 11. 权限定义位置

统一权限定义：

```text
apps/api/src/auth/permissions.ts
```

当前 Access Control 主要资源：

```text
event
pass
merchant
```

原则：

> 如果增加新的业务权限，优先扩展这里的统一 Access Control。

不要在不同 Controller 内自行发明互不一致的：

```text
if (role === ...)
```

体系。

业务层可以做资源 Ownership 判断，但角色能力的基础定义应保持统一。

---

# 12. Session 模型

ChainPass 当前使用 Better Auth Session。

基本流程：

```text
用户登录
   ↓
Better Auth
   ↓
生成 Session
   ↓
Session 写入 PostgreSQL
   ↓
Client 保存 Session 信息
   ↓
后续请求携带 Session
   ↓
Better Auth 恢复当前 User
```

当前 Session 数据保存在：

```text
session
```

表中。

业务代码不需要自行：

```text
生成 JWT
维护 Refresh Token
维护 Session Table
手写 Cookie
手写 Password Hash
```

这些职责交给 Better Auth。

---

# 13. Web 如何消费 Auth

Web：

```text
apps/web
```

Better Auth Client：

```text
apps/web/lib/auth-client.ts
```

当前导出：

```ts
authClient
signIn
signUp
signOut
useSession
```

因此 Web 页面应优先通过这些能力获取 Authentication 状态。

例如：

```ts
const { data: session } = useSession();
```

然后：

```ts
session.user.id
session.user.name
session.user.email
session.user.role
```

获取当前用户信息。

---

# 14. Web 注册

Web 不自己调用：

```text
POST /users
```

注册账号。

使用：

```ts
signUp.email({
  name,
  email,
  password,
});
```

Better Auth 自动负责：

```text
创建 User
创建 Account
创建 Session
返回登录状态
```

---

# 15. Web 登录

使用：

```ts
signIn.email({
  email,
  password,
});
```

不要自行：

```text
fetch("/api/login")
→ 返回 JWT
→ localStorage.setItem()
```

重新实现一套认证流程。

---

# 16. Web Session

Web 使用：

```ts
useSession()
```

读取：

```text
当前用户
Session
Role
登录状态
```

当前已经完成实际验证：

```text
Sign Up   ✅
Sign In   ✅
Session   ✅
Role      ✅
Sign Out  ✅
```

---

# 17. Mobile 如何消费 Auth

Mobile：

```text
apps/mobile
```

Auth Client：

```text
apps/mobile/src/lib/auth-client.ts
```

当前：

```text
Better Auth React Client
+
Better Auth Expo Plugin
+
Expo SecureStore
```

---

# 18. Mobile Session Storage

移动端 Session 不使用：

```text
localStorage
```

而使用：

```text
expo-secure-store
```

Better Auth Expo Client 当前配置：

```text
scheme: chainpass
storagePrefix: chainpass
storage: SecureStore
```

也就是说：

```text
Authentication Session
        ↓
Expo Client
        ↓
SecureStore
```

---

# 19. Mobile 注册 / 登录

Mobile 和 Web 使用同一个 Better Auth Server。

注册：

```ts
signUp.email(...)
```

登录：

```ts
signIn.email(...)
```

读取 Session：

```ts
useSession()
```

退出：

```ts
signOut()
```

因此：

> Web 与 Mobile 不应分别拥有不同登录系统。

它们只是 Better Auth 的两个 Client。

---

# 20. Mobile Deep Link

当前 Expo Scheme：

```text
chainpass://
```

配置位置：

```text
apps/mobile/app.json
```

用于：

```text
OAuth Callback
Authentication Redirect
Future Wallet/Auth Redirect
```

等场景。

---

# 21. Mobile API 地址

真机开发时：

```text
localhost
```

指向手机本身，不是开发电脑。

因此 Expo 真机开发需要使用开发电脑的局域网 IP：

```text
EXPO_PUBLIC_API_URL=http://<LAN-IP>:3001
```

例如：

```text
http://192.168.x.x:3001
```

生产环境以后使用正式 API 域名。

---

# 22. Trusted Origins

Better Auth 会对带 Cookie / Session 的敏感请求进行 Origin 校验。

当前开发环境信任：

```text
http://localhost:3000
http://localhost:8081

chainpass://

exp://
exp://**
exp://192.168.*.*:*/**
```

Expo 开发 Origin 只允许在：

```text
NODE_ENV !== production
```

时加入。

生产环境不得保留宽泛的：

```text
exp://**
```

规则。

---

# 23. CSRF / Origin 安全

Better Auth 自带 Origin / CSRF 防护。

因此：

```text
POST
PUT
PATCH
DELETE
```

等敏感操作必须来自受信任 Origin。

不要为了“接口调不通”而关闭 Better Auth Origin Check。

如果出现：

```text
INVALID_ORIGIN
MISSING_OR_NULL_ORIGIN
```

应检查：

```text
客户端实际 Origin
trustedOrigins
开发环境地址
```

而不是禁用安全机制。

---

# 24. API 如何获取当前用户

NestJS Controller / Service 需要当前用户时，应优先消费：

```text
Better Auth Session
```

而不是：

```text
自行解析 JWT
从 request header 自己解析 userId
信任客户端传入 userId
```

特别是：

```text
ownerId
organizerId
verifiedById
```

这类字段应该尽可能来自：

```text
Authenticated Session
```

而不是客户端提交。

---

# 25. Business Authorization

需要区分：

```text
Authentication
```

和：

```text
Authorization
```

Authentication 回答：

> 你是谁？

Better Auth Session 负责。

Authorization 回答：

> 你能干什么？

由：

```text
role
+
Access Control
+
Resource Ownership
```

共同决定。

例如：

```text
merchant
```

虽然可以更新 Event，

但仍然只能更新：

```text
organizerId === session.user.id
```

的 Event。

因此：

```text
Role Permission
```

不能替代：

```text
Resource Ownership Check
```

---

# 26. 推荐的权限判断模型

以后业务接口建议按照：

```text
Session
   ↓
Role
   ↓
Permission
   ↓
Resource Ownership
   ↓
Business Rule
```

顺序检查。

例如：

```text
Update Event

用户是否登录？
        ↓
是否 merchant/admin？
        ↓
是否拥有 event:update？
        ↓
是不是该 Event organizer？
        ↓
Event 当前状态是否允许编辑？
        ↓
执行更新
```

---

# 27. Blockchain 与 Authentication 的边界

ChainPass 是 Web3 项目，但：

> **Wallet ≠ User**

不要把钱包地址直接当作整个业务用户体系。

正确关系应该是：

```text
Better Auth User
       │
       ├── Email Account
       │
       ├── Future OAuth Account
       │
       └── Wallet
```

也就是说：

> Better Auth User 是主体。
>
> Wallet 是这个 User 关联的一种身份 / Web3 Account。

---

# 28. 未来 Wallet Login 原则

未来如果增加：

```text
Sign in with Ethereum
Wallet Login
Reown Wallet Login
Wallet Signature Authentication
```

必须优先考虑接入现有 Better Auth User 体系。

禁止创建：

```text
WalletUser
```

并形成第二套：

```text
Wallet Authentication System
```

未来推荐模型：

```text
Better Auth User
       │
       └── Wallet Identity
              │
              ├── address
              ├── chainId
              └── verifiedAt
```

用户即使：

```text
Email 登录
```

或者：

```text
Wallet 登录
```

最终都应该解析到同一个：

```text
User.id
```

---

# 29. Blockchain Ownership 与 App User

需要特别区分：

```text
Application Ownership
```

和：

```text
On-chain Ownership
```

例如某张 Pass：

```text
Database

Pass.ownerId
→ Better Auth User.id
```

同时：

```text
Blockchain

ownerOf(tokenId)
→ Wallet Address
```

业务层负责保证：

```text
Better Auth User
        ↕
Wallet
        ↕
On-chain Pass
```

之间关系正确。

不要直接使用 Wallet Address 替代：

```text
ownerId
```

---

# 30. Business Model 与 Better Auth User

以后 Prisma 业务模型应直接关联 Better Auth User。

例如：

```text
User
├── events
├── passes
└── checkIns
```

示意：

```text
Better Auth User
      │
      ├───────────────┐
      ▼               ▼
    Event            Pass
      │               │
      │               ▼
      │            CheckIn
      │
      ▼
 Merchant
```

不要修改 Better Auth 核心模型语义来承担复杂业务。

必要时可以建立：

```text
MerchantProfile
UserProfile
Wallet
```

等扩展业务表。

---

# 31. Authentication 相关环境变量

API：

```text
BETTER_AUTH_SECRET
BETTER_AUTH_URL
DATABASE_URL
```

Web：

```text
NEXT_PUBLIC_API_URL
```

Mobile：

```text
EXPO_PUBLIC_API_URL
```

敏感值：

```text
BETTER_AUTH_SECRET
```

只能存在于服务端环境。

绝不能使用：

```text
NEXT_PUBLIC_*
EXPO_PUBLIC_*
```

暴露。

---

# 32. 当前已经验证的功能

Backend：

```text
Better Auth Server              ✅
NestJS Integration              ✅
Prisma Adapter                  ✅
PostgreSQL                      ✅
Email / Password                ✅
Session                         ✅
Admin Plugin                    ✅
Expo Plugin                     ✅
Custom Roles                    ✅
```

角色：

```text
USER                            ✅
MERCHANT                        ✅
ADMIN                           ✅
```

角色提升：

```text
USER → MERCHANT                 ✅
```

Web：

```text
Sign Up                         ✅
Sign In                         ✅
Get Session                     ✅
Role                            ✅
Sign Out                        ✅
```

Mobile：

```text
Better Auth Client              ✅
Expo Client                     ✅
SecureStore                     ✅
Expo Origin                     ✅
Sign Up                         ✅
Sign In                         ✅
Session                         ✅
Role                            ✅
Sign Out                        ✅
```

---

# 33. 禁止事项

后续开发默认禁止：

### 禁止重新手写登录系统

不要重新实现：

```text
Password Hash
JWT
Refresh Token
Session Table
Cookie
Login Endpoint
Register Endpoint
Logout Endpoint
```

---

### 禁止创建第二套 User

不要创建：

```text
users
app_users
wallet_users
merchant_users
```

作为平行身份系统。

---

### 禁止 Web / Mobile 各自维护身份体系

Web 和 Mobile：

```text
共用 Better Auth Server。
```

---

### 禁止信任客户端提交角色

例如：

```json
{
  "role": "admin"
}
```

客户端不得决定自己的角色。

---

### 禁止客户端提交 ownerId

例如 Claim Pass：

错误：

```text
POST /claim

{
  "ownerId": "..."
}
```

正确：

```text
ownerId
=
session.user.id
```

---

### 禁止绕过 Better Auth Origin 安全

遇到 Origin 问题应修 Trusted Origin 配置。

不应直接关闭 CSRF / Origin Protection。

---

# 34. 新增 Authentication 功能时的决策顺序

以后任何 AI / Developer 想实现：

```text
新的登录方式
新的角色
新的身份体系
Wallet Login
OAuth
SSO
权限控制
```

必须按照以下顺序处理：

```text
1. 阅读本文档
      ↓
2. 检查 Better Auth 是否已有官方能力 / Plugin
      ↓
3. 检查现有 ChainPass Auth 是否可以扩展
      ↓
4. 优先扩展现有 Better Auth
      ↓
5. 最后才考虑自行实现
```

默认不允许：

```text
“为了方便，再写一套”
```

---

# 35. AI 开发规则

任何 AI 在修改 ChainPass Authentication 相关代码之前：

必须优先读取：

```text
PRODUCT_BRIEF.md
docs/AUTH_ARCHITECTURE.md
```

然后检查：

```text
apps/api/src/auth/auth.ts
apps/api/src/auth/permissions.ts

apps/web/lib/auth-client.ts

apps/mobile/src/lib/auth-client.ts

apps/api/prisma/schema.prisma
```

不得仅根据通用最佳实践重新设计 Authentication。

当前仓库实际实现是最高优先级事实来源。

---

# 36. 当前 Authentication Architecture

最终结构：

```text
                         PostgreSQL
                              ▲
                              │
                            Prisma
                              ▲
                              │
                         Better Auth
                              │
               ┌──────────────┼──────────────┐
               │              │              │
               ▼              ▼              ▼
            Next.js         NestJS          Expo
              Web            API            Mobile
               │              │              │
               │         Business API        │
               │              │              │
               └──────────────┼──────────────┘
                              │
                           Session
                              │
                       Better Auth User
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
              ADMIN        MERCHANT        USER
```

未来 Blockchain Authentication：

```text
Wallet
  │
  ▼
Wallet Verification
  │
  ▼
Better Auth User
  │
  ▼
ChainPass Business Identity
```

而不是：

```text
Better Auth User

+

独立 Wallet User
```

---

# 37. 一句话原则

> **ChainPass 的所有身份认证统一基于 Better Auth；Web、Mobile 和 Backend 都消费同一套 User、Session、Role 和 Permission，任何未来的 OAuth、Wallet Login 或 Web3 Authentication 都应优先扩展这套体系，而不是重新创建一套平行鉴权系统。**
