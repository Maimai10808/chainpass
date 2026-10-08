# ChainPass Telegram Bot

Experimental TypeScript/grammY scaffold. `/start` replies `Hello from ChainPass.`
It does not implement ticketing or a second authentication system.

From the repository root:

```bash
cp apps/telegram-bot/.env.example apps/telegram-bot/.env
# Set TELEGRAM_BOT_TOKEN in this ignored local file.
pnpm --filter @chainpass/telegram-bot dev
```

`build`, `typecheck`, and `lint` do not require credentials or contact Telegram.
`start` runs compiled output after `build`. Node.js 24 loads the optional local
`.env`; missing credentials exit with a clear message. Runtime logs omit provider
error objects because they can include token-bearing request URLs.
