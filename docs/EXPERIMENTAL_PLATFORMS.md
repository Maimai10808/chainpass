# ChainPass 实验平台 / Experimental Platforms

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

核心开发范围仍是 Web / API / Mobile 与共享包；服务器只部署 Web / API 和基础设施。五个实验应用均为 private 工程骨架，未部署、未接完整票务 API / Auth / 钱包，不建立另一套身份或业务。

| Workspace                | 框架                              | 最小入口      |
| ------------------------ | --------------------------------- | ------------- |
| @chainpass/telegram-mini | Vite 8/React 19/Telegram SDK 依赖 | 欢迎页面      |
| @chainpass/telegram-bot  | Node 24/TypeScript/grammY         | /start        |
| @chainpass/extension     | WXT/React 19/TypeScript 5         | Popup         |
| @chainpass/discord-bot   | Node 24/TypeScript/discord.js     | /hello        |
| @chainpass/wechat-mini   | Taro 4/React 18/TS5/Vite 4        | WeChat 欢迎页 |

### 运行与检查

每个应用提供可执行的 dev/build/typecheck/lint。Bot 运行时需要自己的被忽略的 `.env`，编译检查不需要 Secret；Discord 命令注册是独立网络操作。WXT 保留 zip/Firefox/postinstall，typecheck 会准备 `.wxt` 类型；Taro 保留 WeChat 别名和原平台脚本，目前只验收 WeChat。

```bash
pnpm --filter @chainpass/telegram-mini dev
pnpm --filter @chainpass/extension dev
pnpm --filter @chainpass/wechat-mini dev:weapp
pnpm check:platforms
```

### 生产隔离

默认根 dev/build/lint/typecheck/test 显式过滤核心与共享包。`check:platforms` 只检查五个实验端，最多并发 2；`build:all` / `check:all` 主动纳入所有 workspace。直接执行未过滤的 Turbo build 也会纳入实验端，其范围不同于生产 Quality Gate。

`workspace-boundaries.test.mjs` 检查任务图、private 身份和 Docker 排除规则。没有为实验端增加生产服务或 CI workflow。共享 lockfile 与 hoisted 安装仍解析各端依赖，peer、缓存和安装时间可能变化；任务过滤不等于依赖解析隔离。

`.dockerignore` 排除五端与 Mobile。API / Web 采用 isolated 安装和 Turbo prune，仅打包相关依赖图。根配置或 lockfile 变化仍可能使缓存失效；实验源码、凭证、Taro / WXT 产物不进入生产镜像。

### 边界与后续

保留框架各自的 tsconfig / React / TypeScript / Vite 组合，不强制 Taro 使用 React 19，也不强制 WXT / Expo / Next.js 统一版本。有真实消费者时才复用 api-client/schemas/web3/config，UI 各端维护。Taro 不天然提供浏览器 fetch / cookie 语义，接 API 前需审查请求适配层。

根 ignore 排除 `.env`、node_modules、dist、build、.output、.wxt、coverage 等，允许 `.env.example`；Taro 的 `.temp/.swc` 也是构建产物。真实 Bot token / issuer secret 不进入 Git 或客户端构建。各端入口见[文档导航](../README.md#zh)。

---

<a id="en"></a>

## English

Five private experimental clients are scaffolds—not deployed ticketing/Auth/wallet systems. Core development remains Web/API/Mobile/shared packages; server production deploys Web/API and infrastructure only. Telegram Mini uses Vite 8/React 19/SDK dependency; Bot grammY/Node 24; Extension WXT/React 19/TS5; Discord discord.js/Node 24; WeChat Taro 4/React 18/TS5/Vite 4.

Each has real dev/build/typecheck/lint. Bots require ignored env only for runtime; Discord registration is separate. WXT retains zip/Firefox/postinstall and prepares types; Taro retains original platform scripts and WeChat aliases, with only WeChat accepted.

```bash
pnpm --filter @chainpass/telegram-mini dev
pnpm --filter @chainpass/extension dev
pnpm --filter @chainpass/wechat-mini dev:weapp
pnpm check:platforms
```

Default root tasks filter core/shared; check:platforms checks only experiments with concurrency 2; build:all/check:all and unfiltered Turbo include everyone deliberately. workspace-boundaries.test.mjs verifies graph/private/Docker boundaries. No extra CI/production services. Shared lock/hoisted installation still resolves all deps/peers/cache: task isolation is not dependency isolation.

dockerignore excludes experiments/Mobile; isolated Turbo-pruned Docker installs/package graphs remain production-only. Root/lock changes may invalidate cache without enlarging runtime.

Keep framework-managed TS/React/Vite combinations, share only stable API/schema/web3/config with real consumers, not forced UI. Taro transport/cookie compatibility needs explicit review before APIs. Root ignore protects env/artifacts and allows examples; no real tokens/secrets in Git/client builds. See [application guides](../README.md#en).
