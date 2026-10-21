import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  // Dynamically import bot after env variables are populated
  const { bot } = await import("../lib/bot");

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("❌ Error: TELEGRAM_BOT_TOKEN is not defined in .env.local");
    process.exit(1);
  }

  console.log("🚀 Starting NUS Transit Hub Telegram Bot in long-polling development mode...");

  // Graceful shutdown
  const stopRunner = () => {
    console.log("\n🛑 Stopping bot...");
    bot.stop();
    process.exit(0);
  };

  process.once("SIGINT", stopRunner);
  process.once("SIGTERM", stopRunner);

  try {
    await bot.start({
      onStart: (botInfo) => {
        console.log(`✅ Bot @${botInfo.username} is running and listening for messages!`);
        console.log("Available commands: /start, /bus <stop>, /disruptions, /class <moduleCode>");
      },
    });
  } catch (err) {
    console.error("❌ Bot error:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

