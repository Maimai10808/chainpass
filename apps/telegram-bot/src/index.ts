import { Bot } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

if (!token) {
  console.error(
    "TELEGRAM_BOT_TOKEN is required. Copy .env.example to .env and configure your development bot.",
  );
  process.exit(1);
}

const bot = new Bot(token);
bot.command("start", (ctx) => ctx.reply("Hello from ChainPass."));
// Provider errors can contain request credentials. Log only a safe summary.
bot.catch(() =>
  console.error(
    "Telegram update failed. Check bot permissions and connectivity.",
  ),
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    if (bot.isRunning()) {
      void bot.stop().catch(() => {
        process.exitCode = 1;
      });
    }
  });
}

await bot
  .start({
    onStart: (info) =>
      console.info(`ChainPass Telegram bot started: @${info.username}`),
  })
  .catch(() => {
    console.error(
      "Telegram bot could not start. Check TELEGRAM_BOT_TOKEN and network access.",
    );
    process.exitCode = 1;
  });
