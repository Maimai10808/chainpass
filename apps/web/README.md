# ChainPass Web

Dark-first Holographic Ticket System built with Next.js 16, React 19, Tailwind v4 and Base UI shadcn.

## Local development

From the repository root, install with `pnpm install`, configure ignored `apps/api/.env` and `apps/web/.env.local` from their examples, and start the existing PostgreSQL development Compose. Apply existing Prisma migrations before starting the API:

```bash
pnpm --filter api exec prisma migrate deploy
pnpm --filter api dev
pnpm --filter web dev
```

The API defaults to port 3001 and Web to port 3000. `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_AUTH_URL` must match the local API / Better Auth public origin. Reown configuration is public client configuration; signer and QR secrets belong only to the API. Production release instructions remain in [DEPLOYMENT.md](../../docs/DEPLOYMENT.md); do not build images on the teaching server.

## Reusable local Demo accounts

The local development database has three dedicated identities:

| Role     | Email                           |
| -------- | ------------------------------- |
| Admin    | `admin.demo@chainpass.local`    |
| Merchant | `merchant.demo@chainpass.local` |
| User     | `user.demo@chainpass.local`     |

Their separate random passwords are stored only in ignored `apps/api/.env.demo-accounts.local` (JSON, mode `600`), not in this README or Git. Keep this file local; do not share it in commits, logs or screenshots. Any test-wallet private key in that file is also local-only and must never hold real assets. These identities are not production accounts.

On a fresh **local** database, after starting the API and building it, explicitly authorized first-admin fixture setup is:

```bash
pnpm --filter api build
pnpm --filter api exec node scripts/create-demo-accounts.mjs --bootstrap-local-admin
```

The script refuses production, remote databases and anything other than `localhost:55432/chainpass`. It creates accounts through Better Auth, initializes only the newly created Demo Admin once, then grants Merchant via the official Admin API. Existing accounts without matching saved credentials are never reset. Registration in the product always creates `user`.

`ChainPass Web Product Demo` is retained as local test data, created and published through the Merchant Web UI. For another claim/check-in rehearsal, issue a new ticket type from that account: each user can claim a given ticket type only once, and each pass can be checked in only once. No test reset deletes existing passes or on-chain evidence.

## Routes and roles

| Routes                                                                                                      | Access              | Capabilities                                                                                  |
| ----------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `/`, `/events`, `/events/[eventId]`                                                                         | Public              | Brand entry, real published events, active tickets and claim CTA                              |
| `/login`, `/register`                                                                                       | Anonymous           | Better Auth email login, user-only registration, role-aware safe return paths                 |
| `/my-passes`, `/my-passes/[passId]`                                                                         | Authenticated owner | Ticket list/detail, signed dynamic QR, verified wallet binding, issuer-backed mint evidence   |
| `/merchant`, `/merchant/events`, `/merchant/events/new`, `/merchant/events/[eventId]`, `/merchant/check-in` | Merchant / admin    | Own-event overview/list, create, ticket issue, publish, manual/QR verify and confirm check-in |
| `/admin`, `/admin/users`, `/admin/events`                                                                   | Admin               | Real user/event counts, user search/pagination, promote user to merchant, platform events     |
| `/auth-test`                                                                                                | Any                 | Compatibility redirect to `/login`; no development console                                    |

Layouts gate protected content before rendering. The server still enforces Session → Permission → Ownership → Business Rules. The client never decides a trustworthy role or owner ID. Registration submits no role; admin promotion uses Better Auth's official Admin client.

## UI and data boundaries

- `app/globals.css` and `lib/design/*`: existing semantic tokens, status tones, motion presets, keyboard focus and reduced motion.
- `components/chainpass/*`: shared header/footer, role workspace navigation and reusable loading/error/empty/status presentations.
- `components/auth/*`: validated forms, safe role redirects and route rendering gates.
- `components/events/*`, `components/passes/*`, `components/merchant/*`: domain UI, not duplicated business rules.
- `lib/queries.ts`: React Query options. User-sensitive passes/wallet/merchant lists include the session user ID in their keys; sign-out clears the cache.
- `lib/admin-api.ts`: typed Better Auth Admin plugin adapter. No direct user database updates.
- `@chainpass/api-client` / `@chainpass/schemas`: shared request/response boundaries. `@chainpass/web3` supplies chain, ABI, explorer and address helpers.

Claim/create/publish/mint mutations invalidate the affected lists and detail queries. Pass Detail refreshes the owner's pass list every five seconds while visible, and on focus, so check-in hides the QR without a WebSocket. The server-issued QR is renewed near its returned expiry, never requested every second; an expired credential is not rendered. Camera capture stops after the first scan, on mode changes and on unmount. Non-secure contexts, missing devices and denied permissions keep manual verification available.

Wallet UI opens only after an explicit Connect action. A signature challenge proves ownership; connection alone does not bind a wallet. Mint waits for the existing API's receipt/DB flow and displays only returned token, network, contract and transaction metadata. No fake transaction progress or fabricated tokens.

## Validation

```bash
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web build
pnpm --filter api test:e2e
```

Web tests cover foundation contrast/status/motion compilation and safe role redirects. API E2E covers ownership, inventory, wallet signature/replay, mint recovery, QR expiry and check-in concurrency. Real wallet-extension signing and camera scanning require a compatible browser/device; production camera access requires HTTPS (localhost is a secure-context exception).

Local acceptance on 2026-10-07 used the retained Demo identities and real PostgreSQL/API. Browser flows covered user registration/login/session/sign-out, Admin search and Merchant promotion, Merchant event/ticket creation and publication, User claim, live Pass Detail, manual verify/check-in, role restrictions and a 390px viewport. Controlled-wallet challenge/signature/verification used the real API, followed by a Web-initiated Ethereum Sepolia mint: [Token #3 mint transaction](https://sepolia.etherscan.io/tx/0xe3c7021a1d900f7164b2d797f291921868c68615837a514f71f6b54de2ccec04). DB fields, receipt, owner/hash mapping and idempotent retry matched. The minted General admission pass remains ACTIVE for reuse.

Real-time QR expiry, fresh-token verification, `method=QR`, replay rejection and User-side CHECKED_IN synchronization were also verified. Camera permission waiting/cancel and manual fallback were exercised; hardware camera scanning and browser-wallet extension signing still require device-level acceptance, not a simulated provider.

The UI intentionally does not advertise unavailable event edit/delete, payments, transfer/resale, self-service merchant/admin registration or advanced analytics.
