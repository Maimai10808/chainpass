# ChainPass Discord Bot

Experimental TypeScript/discord.js scaffold. `/hello` replies
`Hello from ChainPass.` No ticketing, OAuth, or privileged message-content intent.

```bash
cp apps/discord-bot/.env.example apps/discord-bot/.env
# Configure your development application token, client ID, and guild ID locally.
pnpm --filter @chainpass/discord-bot register:commands
pnpm --filter @chainpass/discord-bot dev
```

Invite the bot to your dedicated development guild with the `bot` and
`applications.commands` scopes. Registration is an explicit network-write command,
separate from startup and CI. It creates/updates only `/hello` in that guild rather
than replacing all commands. `DISCORD_GUILD_ID` is required only for registration.

`build`, `typecheck`, and `lint` work without credentials or Discord access.
`start` runs compiled output after `build`. Runtime requires `DISCORD_BOT_TOKEN`
and `DISCORD_CLIENT_ID` and checks that the authenticated bot matches the client ID.
Missing configuration exits clearly; provider error objects are not logged.
