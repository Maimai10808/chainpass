import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { requireEnv } from "./env.js";

const token = requireEnv("DISCORD_BOT_TOKEN");
const clientId = requireEnv("DISCORD_CLIENT_ID");
const guildId = requireEnv("DISCORD_GUILD_ID");
const command = new SlashCommandBuilder()
  .setName("hello")
  .setDescription("Say hello to ChainPass");

// Explicit guild-scoped creation updates /hello without replacing unrelated commands.
await new REST({ version: "10" })
  .setToken(token)
  .post(Routes.applicationGuildCommands(clientId, guildId), {
    body: command.toJSON(),
  })
  .then(() =>
    console.info("Registered /hello in the configured development guild."),
  )
  .catch(() => {
    console.error(
      "Discord command registration failed. Check credentials, guild ID, and applications.commands access.",
    );
    process.exitCode = 1;
  });
