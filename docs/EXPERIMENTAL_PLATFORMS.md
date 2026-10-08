# Experimental Platform Workspaces

The core remains Web/API/Mobile plus the shared packages. Five additional private
applications are scaffolds, not deployed ticketing clients. They do not introduce
another User, Auth, API, database, wallet, or shared UI implementation.

## Run and verify

From the repository root, install with `pnpm install`. Each experimental application
provides real `dev`, `build`, `typecheck`, and `lint` scripts:

| Filter                     | Framework                                 | Minimal entry                                |
| -------------------------- | ----------------------------------------- | -------------------------------------------- |
| `@chainpass/telegram-mini` | Vite 8, React 19, Telegram SDK dependency | ChainPass / Telegram Mini App welcome page   |
| `@chainpass/telegram-bot`  | Node.js 24, TypeScript, grammY            | `/start` → `Hello from ChainPass.`           |
| `@chainpass/extension`     | WXT, React 19, TypeScript 5               | ChainPass / Browser Extension popup          |
| `@chainpass/discord-bot`   | Node.js 24, TypeScript, discord.js        | `/hello` → `Hello from ChainPass.`           |
| `@chainpass/wechat-mini`   | Taro 4, React 18, TypeScript 5, Vite 4    | ChainPass / WeChat Mini Program welcome page |

```bash
pnpm --filter @chainpass/telegram-mini dev
pnpm --filter @chainpass/extension dev
pnpm --filter @chainpass/wechat-mini dev:weapp
pnpm check:platforms
```

Bot development requires your own ignored `.env`, copied from the app's template.
Build/typecheck/lint never require a token. Discord guild command registration is
an explicit separate network-write operation, not an install/build/startup hook.
See the [Telegram Bot](../apps/telegram-bot/README.md) and
[Discord Bot](../apps/discord-bot/README.md) instructions.

WXT keeps its `zip`, Firefox, and `postinstall` scripts. Its typecheck prepares
`.wxt` declarations each time, including after a fresh checkout. Taro retains
`dev:weapp`, `build:weapp`, and the original optional platform scripts. Only the
WeChat build is part of the experimental acceptance checks; the other Taro targets
are not verified capabilities. Keep their framework-managed dependencies until
separate platform removal/build testing justifies trimming them.

## Core CI versus opt-in checks

- `pnpm dev/build/lint/typecheck/test`: explicit Web/API/Mobile and `packages/*`
  filters preserve the original task scope. Core API E2E remains its separate CI job.
- `pnpm check:platforms`: the five experimental apps only, lint/typecheck/build,
  at most two concurrent tasks.
- `pnpm build:all` and `pnpm check:all`: explicitly include every workspace.
- Direct `turbo run build` is unfiltered and includes experimental applications.
  Production Quality Gate uses the filtered root scripts instead.
- `scripts/workspace-boundaries.test.mjs` checks the actual default Turbo graphs,
  private identities, and production context exclusions in `pnpm test`.

No new CI workflow or production deployment service is added. The shared lockfile
and hoisted dependency installation still resolve all workspace dependencies, so
new dependencies can change install time, peer resolutions, and cache keys even
when their tasks are filtered. Validate `pnpm install --frozen-lockfile` and core
checks whenever adding platforms; filtering is not dependency-resolution isolation.

## Production packaging and shared code

Root `.dockerignore` excludes all five experimental directories, as it already
excludes Mobile. Web/API Dockerfiles retain their isolated dependency layout and
`turbo prune web/api --docker`; pruned manifests/lockfiles install only the relevant
workspace graph. Experimental source, hooks, credentials, and framework tooling
must not enter production runtime images. Lockfile/root-script changes can still
invalidate Docker build caches; they do not add an experimental runtime service.

Each app owns its framework-compatible tsconfig. Do not force Taro/React 18,
WXT/TypeScript 5, or Vite 8 to match Next.js/Expo dependency versions. Existing
`api-client`, `schemas`, `web3`, and `config` packages can be reused when a real
consumer needs them; these welcome scaffolds have no business API calls yet.
Taro does not automatically provide browser `fetch`/cookie semantics, so a future
Taro API transport requires an explicit compatibility review rather than copying
business logic. UI remains platform-local.

Root ignore rules protect `.env` and generated output; `.env.example` remains
trackable. WXT `.wxt/.output`, Taro `dist/.temp/.swc`, and Bot `dist` are generated.
No real bot token, private key, or production secret belongs in Git or client builds.
