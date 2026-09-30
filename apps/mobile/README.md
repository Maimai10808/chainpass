# ChainPass Mobile

Expo / React Native client for the ChainPass user flow:

```text
Sign in → Discover → Event detail → Claim → My Passes → Dynamic QR
```

The app consumes the existing Better Auth session, `@chainpass/api-client`,
`@chainpass/schemas`, and `@chainpass/web3`. It does not implement ticketing
rules locally.

## Configure

Copy `.env.example` to `.env` and set an API URL reachable by the device:

```bash
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001
```

`localhost` points to the phone when running in Expo Go, so use the development
computer's LAN address for a physical device. Do not place API secrets, QR
secrets, or issuer private keys in `EXPO_PUBLIC_*` variables.

## Run

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the app:

   ```bash
   pnpm --filter mobile dev
   ```

Open the project in Expo Go, an iOS simulator, or an Android emulator. The app
scheme remains `chainpass://`.

## Routes

```text
(tabs)/index              Discover published events
events/[eventId]          Event details and claiming
(tabs)/my-passes          Current user's passes
my-passes/[passId]        Pass details and dynamic QR
(tabs)/profile            Better Auth account and sign out
auth/sign-in              Sign in
auth/sign-up              Create account
```

## Verify

```bash
pnpm --filter mobile exec tsc --noEmit
pnpm --filter mobile lint
pnpm --filter mobile exec expo install --check
```

Dynamic QR codes are issued by the API and refresh shortly before their server
expiry. When the app returns to the foreground, the pass list and QR state are
revalidated; checked-in or revoked passes do not display a usable QR.
