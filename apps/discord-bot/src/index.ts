import { Client, Events, GatewayIntentBits } from "discord.js";
import { requireEnv } from "./env.js";

const token = requireEnv("DISCORD_BOT_TOKEN");
const clientId = requireEnv("DISCORD_CLIENT_ID");
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (ready) => {
  if (ready.user.id !== clientId) {
    console.error(
      "DISCORD_CLIENT_ID does not match this bot. Check the development application configuration.",
    );
    void client.destroy();
    process.exitCode = 1;
    return;
  }
  console.info(`ChainPass Discord bot started: ${ready.user.tag}`);
});

client.on(Events.InteractionCreate, (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "hello") {
    void interaction.reply("Hello from ChainPass.").catch(() => {
      console.error(
        "Discord command reply failed. Check permissions and connectivity.",
      );
    });
  }
});

client.on(Events.Error, () =>
  console.error(
    "Discord connection error. Check bot configuration and connectivity.",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void client.destroy();
  });
}

await client.login(token).catch(async () => {
  console.error(
    "Discord bot could not start. Check DISCORD_BOT_TOKEN and network access.",
  );
  await client.destroy();
  process.exitCode = 1;
});
