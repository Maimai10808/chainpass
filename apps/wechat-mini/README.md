# ChainPass WeChat Mini Program

Experimental Taro 4 / React 18 / Vite 4 scaffold, not a complete ticketing client.

```bash
pnpm --filter @chainpass/wechat-mini dev
pnpm --filter @chainpass/wechat-mini build
pnpm --filter @chainpass/wechat-mini typecheck
pnpm --filter @chainpass/wechat-mini lint
```

`dev` aliases `dev:weapp` (watch); `build` aliases `build:weapp`. Import this app's
`project.config.json` into WeChat DevTools after building; `dist` is generated.
`touristappid` is the scaffold's no-credential default, not a production App ID.
For an actual development app use Taro's `TARO_APP_ID` environment configuration.

Taro's original platform scripts/plugins are retained to avoid changing its
framework compatibility matrix during workspace integration. Only WeChat is
validated here; other platform builds are not accepted capabilities. Local
TypeScript scopes automatic types to Node/React and uses `skipLibCheck` for Taro's
upstream multi-platform declaration conflicts; app/config source remains checked.
The scaffold
does not initialize a nested Git repository or install root Git hooks.
