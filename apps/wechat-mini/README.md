# ChainPass 微信小程序 / WeChat Mini Program

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

Taro 4/React 18/Vite 4 实验工程，只显示欢迎页，不实现微信登录、支付或票务。

```bash
pnpm --filter @chainpass/wechat-mini dev
pnpm --filter @chainpass/wechat-mini build
pnpm --filter @chainpass/wechat-mini typecheck
pnpm --filter @chainpass/wechat-mini lint
```

dev→dev:weapp watch，build→build:weapp。构建后在微信开发者工具导入 project.config.json；dist 是产物。touristappid 只是免凭证模板值，真实开发 App 使用 TARO_APP_ID。

为兼容保留原多平台脚本/插件，仅 WeChat 构建已验收，其余不能算支持完成。tsconfig 限制自动 types 为 Node/React，skipLibCheck 处理 Taro 上游多平台声明冲突，应用/config 源码仍检查。不再创建嵌套 Git 或 root hook。见[实验边界](../../docs/EXPERIMENTAL_PLATFORMS.md#zh)。

---

<a id="en"></a>

## English

Taro 4/React 18/Vite 4 welcome scaffold, no WeChat login/payment/ticketing.

```bash
pnpm --filter @chainpass/wechat-mini dev
pnpm --filter @chainpass/wechat-mini build
pnpm --filter @chainpass/wechat-mini typecheck
pnpm --filter @chainpass/wechat-mini lint
```

dev aliases dev:weapp watch, build aliases build:weapp. Import project.config.json into WeChat DevTools; dist is generated. touristappid is a no-credential template default, not productionID; use TARO_APP_ID for real development.

Original platform scripts/plugins remain for compatibility; only WeChat is accepted. Node/React automatic types and skipLibCheck handle upstream declarations; app/config source stays checked. No nested Git/root hooks. See [boundaries](../../docs/EXPERIMENTAL_PLATFORMS.md#en).
