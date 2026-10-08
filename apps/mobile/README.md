# ChainPass Mobile

One Expo / React Native app, three server-selected workspaces. The UI uses the
[Mobile Design Contract](src/design/README.md); Better Auth and the existing API
remain the identity, authorization and ticketing authorities.

## Configure and run

Copy `.env.example` to ignored `.env`. `EXPO_PUBLIC_API_URL` must be reachable by
the device: use your computer's current LAN address for local native testing,
not `localhost`. A same-origin production gateway URL includes `/api`.
Mobile derives the Better Auth endpoint as `/api/auth`; it does not reuse the
business `/api` prefix as the Auth root. Both direct local API origins and the
production reverse proxy are covered by regression tests.

- `EXPO_PUBLIC_REOWN_PROJECT_ID`: real public Reown project ID for wallet connection.
  Missing configuration disables connection, not browsing, claiming or QR entry.
- `EXPO_PUBLIC_APP_URL`: public Web origin for shared invitation links and wallet
  metadata. Set the real origin; do not put an API `/api` URL here.
- Chain configuration and explorer helpers come from `@chainpass/web3`;
  Ethereum Sepolia, chain ID `11155111`. Do not introduce a second chain.
- No database, issuer, Better Auth or QR signing secrets belong in this app.

```bash
pnpm install
pnpm --filter mobile dev
```

Keep the `chainpass://` scheme. The entry point loads the official WalletConnect
compatibility polyfills before Expo Router. Reown uses its official Ethers
adapter, not a private-key input. Use a development build for full native wallet
acceptance; a Metro export is not proof that every native dependency exists in
Expo Go. No native `ios/` or `android/` directories are maintained manually.

For Expo Web preview of a local API (not a device test):

```bash
EXPO_PUBLIC_API_URL=http://localhost:3001 pnpm --filter mobile web
```

The preview's browser origin must match API CORS/trusted-origin configuration.
Do not disable CSRF or Origin checks to make preview login work.

## Navigation

```text
src/app/
  _layout                         session restoration, providers, Native Stack
  (tabs)/                         User: Discover / My Passes / Profile
  auth/sign-in, auth/sign-up       native forms, user-only registration
  invite                          anonymous invitation preview / auth / Claim
  events/[eventId]                 public event / Claim / Open Pass
  my-passes/[passId]               holographic pass / QR / Wallet / Mint
  merchant/_layout                merchant/admin route gate, Native Stack
    (tabs)/                       Overview / Events / Check-in / Profile
    events/new                    native date/time form
    events/[eventId]              tickets, publish, invitation creation/share/revoke
  admin/_layout                   admin-only gate, Native Stack
    (tabs)/                       Overview / Users / Events / Profile
```

`session.user.role` selects the workspace after restoration; no client-side role
switch exists. Protected deep links redirect through sign-in with an allowlisted,
role-appropriate `returnTo`. Admin can open cross-organizer event management
without switching to a merchant identity. Registration never accepts a role;
user → merchant promotion calls the official Better Auth Admin API.

## Data and security boundaries

- Business requests use `@chainpass/api-client`; payloads/results use
  `@chainpass/schemas`. Admin list/promotion use Better Auth `adminClient`.
- Better Auth's Expo client persists authentication in SecureStore and supplies
  cookies to native API requests. No second auth or token store exists.
- TanStack Query keys live in `lib/product.ts`. Private keys include user ID;
  identity/role changes and sign-out discard private data. Public event caches
  are separate. Mutation retries are disabled, especially for mint and check-in.
- WalletConnect uses prefixed AsyncStorage for connection metadata only. It
  never stores Better Auth sessions, private keys or entry QR tokens.
- Binding signs the API's challenge, rechecks session identity, then calls
  `/wallets/verify`. A connected address is never treated as a bound wallet.
- Mint calls `/passes/:passId/mint`. The backend signs the transaction; Mobile
  only displays confirmed API fields and shared explorer links.

QR lives in memory, rotates 10 seconds before the server expiry and is hidden
once expired. Screen blur/background stops timers and clears the credential;
foreground revalidates it. Pass detail polls status every five seconds only while
focused and foregrounded. CHECKED_IN/REVOKED never displays a usable QR.

## Invitation-only events

New Merchant drafts default to `INVITE_ONLY`; the creation screen also offers
`PUBLIC`. Only published public events appear in Discover. Publish a private
event with an active ticket type, then create an invitation with a claim limit
and future expiry on its management screen. Native sharing sends the Web link
`<EXPO_PUBLIC_APP_URL>/invite#token=…`; the optional installed-app link is
`chainpass://invite#token=…`. The server returns the raw credential only once.
Save/share it before leaving the screen; lists contain counts and expiry, not
recoverable tokens. Revoking a link stops new claims, not existing passes.

Attendees can open an installed-app link or choose **Open invitation** in
Discover and paste the complete Web link. The app extracts the credential; it
does not request arbitrary pasted URLs. Preview shows only the designated
ticket. Sign-in/sign-up return to `/invite`, then the existing claim API creates
an independent Pass and opens its existing detail/QR screen. A forwardable link
does not grant access to other private events or ticket types.

The pending credential is separate from Better Auth: native SecureStore (Web
preview uses tab sessionStorage), limited to 30 minutes or the known server
expiry, whichever comes first. A new link replaces it; malformed links cannot
fall back to an old invitation. Successful claim, explicit clear, sign-out,
account/role change, expiry, revocation and exhausted quota clear the handoff.
If secure persistence fails, the current in-memory handoff still works with a
visible warning. The server remains the authority for eligibility and stock;
preview does not reserve inventory. No credential is in auth `returnTo` or a
query cache key. Focus/background gates preview refresh and expiry timers.

Custom-scheme links require an installed development/production build. HTTPS
Universal Links / Android App Links and automatic Web-to-app routing are not
configured; Expo Go and browser preview do not prove native deep-link delivery.

## On-site operations

`expo-camera` scans QR only. Camera mounts only during an active scan on the
focused foreground screen and unmounts on detection, blur or background. A
synchronous lock prevents duplicate frame requests; stale scan responses do not
overwrite a newer scan. Permission denial / unavailable hardware offers settings
and manual Pass ID fallback.

Scanning calls the existing verify-token endpoint. Manual mode calls verify by
Pass ID. Neither checks in automatically: staff inspect the result and explicitly
confirm the existing check-in API with `QR` or `MANUAL`. The server rechecks
ownership and state and enforces atomic, one-time entry. Off-chain entry works
without a wallet or blockchain RPC.

## Verify

```bash
pnpm --filter mobile lint
pnpm --filter mobile typecheck
pnpm --filter mobile test
pnpm --filter mobile exec expo export --platform ios --clear
pnpm --filter mobile exec expo export --platform android --clear
pnpm --filter mobile exec expo install --check
(cd apps/mobile && pnpm dlx expo-doctor@latest)
```

Pure tests cover role destinations, redirect attacks, private cache isolation,
QR expiry, camera lifecycle, check-in guards and wallet/network state, alongside
the existing foundation contrast/motion tests. Invitation tests cover link
validation, cold restore, retention, storage failures and replacement races.
Metro pins Valtio resolution to
the native Reown SDK's instance: controllers and subscriptions must share one
proxy registry. This is Mobile-only, not a workspace dependency override.

Native acceptance checklist:

- iOS + Android: restore session, role tabs, auth keyboard, safe areas, font scaling.
- User: browse → claim → pass → wallet app sign/return → verified bind → mint → QR.
- Merchant: create → ticket → publish → camera/manual verify → confirm → scan next.
- Admin: list/search/filter users → confirm promotion → inspect/manage events.
- Present Mobile QR to Web Merchant; confirm CHECKED_IN after foreground/refetch.
- Deny permission, background the app, expire QR, decline signing, test reduced motion.

## Validation record (2026-10-07)

Local Docker PostgreSQL + real API acceptance completed signup/session roles,
merchant event/ticket/publish, user claim, wallet challenge/signature binding,
Sepolia application mint, receipt/owner/hash mapping/idempotency, QR + manual
verification, QR check-in/replay rejection, status sync and Admin promotion.
The mint was a single explicitly named local acceptance pass (token #5), not
production seed data or a mock. Its public transaction is
[on Sepolia Etherscan](https://sepolia.etherscan.io/tx/0xf11fef27990f05f97dcafcdeacff72b41310dfb65c816b84ed67ee2f1cf86fe8).

Expo Web UI acceptance used the real local API: user-only registration and
role-specific login, Merchant draft/ticket/publish, User claim/pass/rotating QR,
Merchant manual verify/confirm/replay, and Admin overview/search/confirmed
user-to-merchant promotion plus cross-organizer event management. Reopening the
checked-in User pass shows CHECKED_IN and hides the usable QR. These explicitly
named local fixtures are retained
for inspection; the existing Demo identities were not reassigned.

Device camera capture, external wallet-app handoff, haptics, native keyboard and
physical session persistence still require device acceptance. Browser preview,
API acceptance and Hermes exports are separate evidence, not substitutes.
Doctor may report monorepo native-module duplication and external network checks;
do not override React globally or change Web simply to obtain 21/21.

The isolated PostgreSQL API regression suite passed 79 tests (8 files), with
one explicitly opt-in blockchain integration test skipped. Mobile's 15 pure
tests, workspace lint/typecheck/test/build and iOS/Android Hermes exports passed.
Expo Doctor passed
20/21 checks; its remaining native-module duplication warning still requires
verification in a native development build. Expo enables autolinking module
resolution for this monorepo, but a successful Hermes export does not prove a
native build is free from linking conflicts.

## Invitation validation record (2026-10-08)

Expo Web preview against the real local API and Docker PostgreSQL passed the
Merchant draft → active ticket → publish → create/list invitation flow. Private
events stayed out of public discovery, and preview exposed only the designated
ticket. Pasted links and direct fragment links restored after a tab reload;
sign-in and registration returned to `/invite` without a credential in the auth
URL. Separate attendees received separate Passes through the existing claim API.

The issued Pass generated the existing QR credential; Merchant API verification
and explicit QR check-in succeeded, replay returned ALREADY_CHECKED_IN, and the
reloaded Mobile screen showed CHECKED_IN without a usable QR. Revocation blocked
new invitation preview, cleared the handoff and preserved already issued Passes.
User, Merchant and Admin login destinations, browser session restoration and
sign-out cleanup also passed against the real API.
The explicitly named local acceptance fixtures remain available for inspection.
No chain transaction was sent by this invitation test.

Mobile lint/typecheck and 25 pure tests passed. The isolated PostgreSQL API E2E
suite passed 93 tests with one opt-in blockchain integration test skipped;
files were run serially after a parallel run encountered assertion timeouts
during simultaneous exports/builds. Workspace lint/typecheck/test/build and
iOS/Android Hermes exports passed. The native acceptance checklist above is
still required: browser preview does not validate system sharing, SecureStore
after process restart, or delivery of `chainpass://` links on iOS/Android.
