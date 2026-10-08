# ChainPass 浏览器扩展 / Browser Extension

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

WXT/React 实验 Popup，不是完整票务客户端。

```bash
pnpm --filter @chainpass/extension dev
pnpm --filter @chainpass/extension build
pnpm --filter @chainpass/extension typecheck
pnpm --filter @chainpass/extension lint
pnpm --filter @chainpass/extension zip
```

WXT 在 install/typecheck 准备.wxt 类型；build 后把.output/chrome-mv3 作为未打包开发扩展加载。保留 Firefox 脚本。不申请 content-script host 权限，没有 background worker/content script/wallet/side panel。见[平台边界](../../docs/EXPERIMENTAL_PLATFORMS.md#zh)。

---

<a id="en"></a>

## English

Experimental WXT/React popup, not a full ticketing client.

```bash
pnpm --filter @chainpass/extension dev
pnpm --filter @chainpass/extension build
pnpm --filter @chainpass/extension typecheck
pnpm --filter @chainpass/extension lint
pnpm --filter @chainpass/extension zip
```

Install/typecheck prepare.wxt types. Load.output/chrome-mv3 unpacked after build; Firefox scripts remain. No host permissions/background/content script/wallet/side panel is implemented. See [boundaries](../../docs/EXPERIMENTAL_PLATFORMS.md#en).
