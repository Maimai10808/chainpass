# ChainPass Discord Bot

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

TypeScript/discord.js 实验 Bot，/hello 回复 Hello from ChainPass.；无票务、OAuth 或 privileged message-content intent。

```bash
cp apps/discord-bot/.env.example apps/discord-bot/.env
pnpm --filter @chainpass/discord-bot register:commands
pnpm --filter @chainpass/discord-bot dev
```

本地配置 DISCORD_BOT_TOKEN、DISCORD_CLIENT_ID；注册另需 DISCORD_GUILD_ID。邀请到专用开发 guild 使用 bot/applications.commands scopes。register:commands 是明确的网络写操作，不在 install/build/startup/CI 自动执行；只创建/更新该 guild 的 hello，不替换所有命令。

build/typecheck/lint 无需凭证/网络；build 后 start。runtime 校验登录 Bot 与 clientID 一致，缺配置清楚退出，日志不打印 provider 错误对象。见[实验平台](../../docs/EXPERIMENTAL_PLATFORMS.md#zh)。

---

<a id="en"></a>

## English

TypeScript/discord.js scaffold; /hello replies Hello from ChainPass. No ticketing/OAuth/privileged message-content intent.

```bash
cp apps/discord-bot/.env.example apps/discord-bot/.env
pnpm --filter @chainpass/discord-bot register:commands
pnpm --filter @chainpass/discord-bot dev
```

Configure token/clientID in ignored env; guildID is registration-only. Invite to a dedicated development guild with bot/applications.commands scopes. Registration is an explicit network write, not an install/build/startup/CI hook, and upserts only hello rather than replacing all commands.

Build/typecheck/lint need no credentials/network. start uses built output; runtime verifies bot/client identity and clearly reports missing config without logging provider objects. See [platforms](../../docs/EXPERIMENTAL_PLATFORMS.md#en).
