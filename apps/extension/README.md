# ChainPass Browser Extension

Experimental WXT/React popup scaffold, not a complete ChainPass client.

```bash
pnpm --filter @chainpass/extension dev
pnpm --filter @chainpass/extension build
pnpm --filter @chainpass/extension typecheck
pnpm --filter @chainpass/extension lint
pnpm --filter @chainpass/extension zip
```

WXT prepares generated types during installation and typecheck. Load
`.output/chrome-mv3` as an unpacked development extension after building.
Firefox-specific scripts remain available.

The manifest requests no content-script host permissions. No background worker,
content script, wallet, or side panel is implemented.
