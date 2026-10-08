# ChainPass Telegram Bot

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

TypeScript/grammY 实验入口；/start 回复 Hello from ChainPass.，不实现票务或第二套认证。

```bash
cp apps/telegram-bot/.env.example apps/telegram-bot/.env
pnpm --filter @chainpass/telegram-bot dev
```

在 ignored 文件配置自己的 TELEGRAM_BOT_TOKEN，不提交/打印。Node 24 加载可选.env；缺配置清楚退出。build/typecheck/lint 不需 token、不访问 Telegram；build 后 start 运行编译产物。日志不输出可能包含 token URL 的 provider 错误对象。见[实验平台](../../docs/EXPERIMENTAL_PLATFORMS.md#zh)。

---

<a id="en"></a>

## English

TypeScript/grammY scaffold; /start replies Hello from ChainPass., without ticketing/another Auth system.

```bash
cp apps/telegram-bot/.env.example apps/telegram-bot/.env
pnpm --filter @chainpass/telegram-bot dev
```

Set your TELEGRAM_BOT_TOKEN only in ignored env. Node 24 loads optional .env and clearly exits if missing. Build/typecheck/lint need no token/network; start runs built output. Logs omit provider objects that may contain credential URLs. See [boundaries](../../docs/EXPERIMENTAL_PLATFORMS.md#en).
