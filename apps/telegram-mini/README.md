# ChainPass Telegram Mini App

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

Vite/React 实验入口，显示 ChainPass / Telegram Mini App，不是完整票务客户端。SDK 依赖已安装，页面可在普通浏览器打开；没有伪造 Telegram 环境、登录、支付、钱包或 API 业务。

```bash
pnpm --filter @chainpass/telegram-mini dev
pnpm --filter @chainpass/telegram-mini build
pnpm --filter @chainpass/telegram-mini typecheck
pnpm --filter @chainpass/telegram-mini lint
```

工程隔离与后续复用边界见[实验平台](../../docs/EXPERIMENTAL_PLATFORMS.md#zh)。

---

<a id="en"></a>

## English

Experimental Vite/React welcome scaffold, not a full ticketing client. Telegram SDK is installed; the page works in an ordinary browser without fake host/login/payment/wallet/API behavior.

```bash
pnpm --filter @chainpass/telegram-mini dev
pnpm --filter @chainpass/telegram-mini build
pnpm --filter @chainpass/telegram-mini typecheck
pnpm --filter @chainpass/telegram-mini lint
```

See [platform boundaries](../../docs/EXPERIMENTAL_PLATFORMS.md#en).
