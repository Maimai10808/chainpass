export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(
      `${name} is required. Copy .env.example to .env and configure your development bot.`,
    );
    process.exit(1);
  }
  return value;
}
