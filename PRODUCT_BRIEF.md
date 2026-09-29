# ChainPass Product Brief

> 本文档是 ChainPass 项目的核心业务说明。
> 后续进行产品设计、数据库设计、API 设计、智能合约设计、Web / Mobile 开发时，应优先以本文档定义的业务目标和边界为准，避免自行扩展无关业务。

---

# 1. 项目定位

**ChainPass 是一个链上数字票务与核销平台。**

平台允许活动主办方创建活动并发行数字门票，用户领取门票后获得属于自己的数字 Pass。

每张 Pass 拥有唯一身份，并可关联链上 Token / Ownership 信息。

活动现场可以对用户持有的 Pass 进行核验和核销，核销结果同步回业务系统。

核心目标：

**让数字门票完成「发行 → 领取 → 链上确权 → 持有 → 核验 → 核销」的完整闭环。**

---

# 2. 三端角色

ChainPass 分为三个主要业务端。

## A 端：平台管理员

平台级管理角色。

主要职责：

- 管理商家 / 活动主办方
- 管理平台活动
- 查看平台整体运营数据
- 查看门票发行、领取、核销情况
- 处理异常商家、活动或门票

A 端不是核心出票方，主要承担平台治理和运营职责。

---

## B 端：商家 / 活动主办方

ChainPass 的核心业务角色。

商家可以：

- 创建活动
- 编辑活动信息
- 创建票种
- 设置票数
- 发布门票
- 查看领取情况
- 查看剩余票量
- 查看门票持有人
- 核验用户门票
- 扫码核销门票
- 查看活动实时数据

典型数据：

- Issued
- Claimed
- Remaining
- Checked In

B 端承担主要的票务发行和现场核销流程。

---

## C 端：普通用户

数字门票的持有者。

用户可以：

- 浏览活动
- 查看活动详情
- 领取门票
- 查看自己的数字 Pass
- 查看门票状态
- 查看链上信息
- 展示门票二维码
- 接受现场核验和核销

用户核心页面：

- Discover
- My Passes
- Pass Detail
- Profile

---

# 3. 核心业务流程

ChainPass 第一阶段只围绕下面这条主链开发：

```text
商家创建活动
    ↓
创建票种并设置票数
    ↓
发布活动 / 门票
    ↓
用户浏览活动
    ↓
用户领取门票
    ↓
创建 ChainPass
    ↓
链上 Mint / 建立 Token 身份
    ↓
Pass 归属于当前用户
    ↓
用户在 My Passes 查看门票
    ↓
现场展示 Pass / 二维码
    ↓
商家核验门票
    ↓
确认 Check-in
    ↓
Pass 状态变更为已核销
    ↓
商家后台 / 实时数据同步更新
```

这条流程是当前项目的最高优先级。

---

# 4. Pass 的核心状态

第一阶段 Pass 至少需要支持：

```text
ACTIVE
    ↓
CHECKED_IN
```

同时预留：

```text
REVOKED
```

含义：

- `ACTIVE`：门票有效，可以正常核验
- `CHECKED_IN`：已经完成核销，不可重复使用
- `REVOKED`：门票已被撤销

同一张票不得重复核销。

---

# 5. 区块链职责

Blockchain 是 ChainPass 的可信资产层，而不是完整业务数据库。

区块链主要负责：

- Pass 的唯一链上身份
- Token ID
- Pass 的发行
- Ownership
- Pass 与用户钱包之间的归属关系
- 必要的链上验证信息
- 关键状态的可信记录

典型链上信息：

```text
Event
Token ID
Issuer
Owner
Contract Address
Transaction Hash
Status / Verification Data
```

---

# 6. 不上链的数据

普通业务信息仍然由后端和 PostgreSQL 管理。

例如：

- 用户昵称
- 用户资料
- 活动描述
- 活动图片
- 商家资料
- 领取记录
- 核销操作详情
- 核销时间
- 统计数据
- Dashboard 数据

原则：

**Blockchain 负责身份、Ownership 和可信验证；Backend 负责完整业务。**

不得为了“使用区块链”而将所有业务数据强行写入链上。

---

# 7. 三端与技术职责

## Web

主要服务：

- A 端管理员
- B 端商家 / 活动主办方

承担：

```text
Admin
Merchant Dashboard
Event Management
Ticket Management
Check-in
Statistics
Live Dashboard
```

---

## Mobile

主要服务 C 端用户，同时可以承担部分现场核销能力。

承担：

```text
Discover
My Passes
Pass Detail
QR Code
Scanner
Wallet / Web3
Profile
```

React Native 同时覆盖 iOS 和 Android。

---

## Backend

Backend 是 ChainPass 的业务核心。

负责：

```text
Auth
User
Merchant
Event
Ticket
Pass
Claim
Check-in
Blockchain Integration
Statistics
Realtime Events
```

---

## Smart Contract

智能合约负责数字 Pass 的链上能力。

第一阶段重点：

```text
Event / Issuer
Mint Pass
Token Identity
Ownership
Verification
```

合约应保持简单，不在第一阶段设计复杂 Token 经济系统。

---

# 8. 三天 MVP

本次 Hackathon 的目标不是完成一个大型票务平台，而是完成一条真正可运行的端到端链路。

必须优先完成：

1. 商家创建活动
2. 商家设置票数
3. 发布活动
4. 用户查看活动
5. 用户领取 Pass
6. Pass 创建数据库记录
7. Pass 完成链上 Mint
8. 用户查看 My Pass
9. 用户展示门票
10. 商家核验 / 核销
11. 防止重复核销
12. 核销后状态实时更新
13. 可以查看基本链上验证信息

如果以上主流程没有完整跑通，不优先增加外围功能。

---

# 9. 当前非目标

第一阶段暂不重点实现：

- NFT Marketplace
- Token 交易市场
- DeFi
- DAO
- 复杂 Token Economics
- 虚拟货币支付
- 二级票务市场
- 黄牛治理系统
- 复杂退款体系
- 复杂座位系统
- 多级代理商体系
- 推荐系统
- AI 功能
- 元宇宙
- 数字孪生
- 社交系统
- 大型微服务架构

除非核心业务已经完整完成，否则不要自行加入这些功能。

---

# 10. 产品核心原则

ChainPass 的第一阶段始终遵循以下原则：

### 1. 业务优先

不是为了展示区块链而设计业务。

### 2. 链上做可信层

Blockchain 负责身份、Ownership 和验证，而不是承担整个后端。

### 3. 保持主流程简单

核心始终是：

**创建活动 → 发行门票 → 领取 → Mint → 持有 → 核验 → 核销。**

### 4. Web / Mobile 各司其职

Web 更偏平台和商家管理。

Mobile 更偏用户持票和现场交互。

### 5. MVP 优先

本次开发周期较短，优先完成真正可演示、可运行的完整闭环，而不是堆积大量未完成的功能。

---

# 11. 一句话定义

> **ChainPass 是一个链上数字票务与核销平台：商家创建活动并发行数字门票，用户领取后获得具有唯一链上身份的 Pass，并可以在活动现场完成核验和核销。**

---

# 12. 当前核心业务主链

任何 AI 或开发者在新增功能前，应首先确认该需求是否服务于以下主链：

```text
Create Event
    ↓
Issue Tickets
    ↓
Claim Pass
    ↓
Mint On-chain
    ↓
Own Pass
    ↓
Verify Pass
    ↓
Check-in
```

如果功能与这条主链没有直接关系，在当前 MVP 阶段默认降低优先级。
