import { Bot, InlineKeyboard } from "grammy";
import { fetchAnnouncements, fetchShuttleService } from "./nextbus";
import { extractFirstLesson, fetchModuleData } from "./nusmods";
import { Shuttle } from "./types";

const token = process.env.TELEGRAM_BOT_TOKEN || "000000000:dummy_token_for_build";
export const bot = new Bot(token);

/**
 * Returns a visual urgency badge based on bus arrival time:
 * 🟢 <= 3 min or Arr
 * 🟡 4 - 8 min
 * 🔴 > 8 min or '-' (Off-service/unavailable)
 */
export function getUrgencyBadge(arrivalTime: string): string {
  if (!arrivalTime || arrivalTime === "-" || arrivalTime.toLowerCase() === "n.a.") {
    return "🔴";
  }

  const clean = arrivalTime.trim().toLowerCase();
  if (clean === "arr" || clean === "0") {
    return "🟢";
  }

  const mins = parseInt(clean, 10);
  if (isNaN(mins)) {
    return "🔴";
  }

  if (mins <= 3) {
    return "🟢";
  } else if (mins <= 8) {
    return "🟡";
  } else {
    return "🔴";
  }
}

/**
 * Formats shuttle arrivals into a clean, human-readable Telegram message.
 */
export function formatShuttleTimings(
  stopName: string,
  shuttles: Shuttle[],
  isScheduled: boolean = false
): string {
  let message = `🚏 *Bus Stop: ${stopName}*\n`;
  if (isScheduled) {
    message += `📋 *Schedule Mode:* Scheduled (Estimated)\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;

  if (!shuttles || shuttles.length === 0) {
    message += `🌙 *No shuttles currently in service.*\n`;
    message += `(NUS Internal Shuttle Buses operate 07:00 to 23:00 SGT.)\n`;
    return message;
  }

  const allOffService = shuttles.every((s) => s.arrivalTime === "-");
  if (allOffService) {
    message += `🌙 *Service ended for today.*\n`;
    message += `Internal shuttle buses resume tomorrow at 07:00 AM.\n`;
    return message;
  }

  for (const s of shuttles) {
    const badge = getUrgencyBadge(s.arrivalTime);
    const arrTime = s.arrivalTime === "Arr" ? "Arr" : s.arrivalTime === "-" ? "Off-service" : `${s.arrivalTime} min`;
    const nextTime = s.nextArrivalTime && s.nextArrivalTime !== "-" ? `${s.nextArrivalTime} min` : "N/A";
    const plate = s.vehplate ? ` (${s.vehplate})` : "";
    const crowd = s.passengers ? ` • ${s.passengers}` : "";

    message += `🚌 *${s.name}*  ${badge} *${arrTime}*\n`;
    message += `   ↳ Next: ${nextTime}${plate}${crowd}\n\n`;
  }

  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🟢 ≤3 min  |  🟡 4-8 min  |  🔴 >8 min\n`;
  if (isScheduled) {
    message += `ℹ️ _Timings are estimated based on official NUS ISB frequency tables._\n`;
  }
  return message;
}

/**
 * Builds the quick-action inline keyboard for popular bus stops.
 */
function getQuickStopsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🎓 UTown", "stop:UTOWN")
    .text("💻 COM 3", "stop:COM3")
    .row()
    .text("🚇 Kent Ridge MRT", "stop:KR-MRT")
    .text("📚 Central Library", "stop:CLB");
}

// --- Bot Command Handlers ---

// /start
bot.command("start", async (ctx) => {
  const welcomeText =
    `👋 *Welcome to NUS Campus Transit Bot!*\n\n` +
    `Your smart companion for NUS Internal Shuttle Buses and timetables.\n\n` +
    `*Commands:*\n` +
    `• /bus <stop> — Check live shuttle arrivals (e.g., \`/bus UTOWN\`, \`/bus COM3\`)\n` +
    `• /class <module> — Find your class venue and nearest bus arrivals (e.g., \`/class CS2030S\`)\n` +
    `• /disruptions — Check breakdown alerts & campus transit advisories\n\n` +
    `👇 *Tap a popular stop below for instant timings:*`;

  await ctx.reply(welcomeText, {
    parse_mode: "Markdown",
    reply_markup: getQuickStopsKeyboard(),
  });
});

// /bus <stop>
bot.command("bus", async (ctx) => {
  const query = ctx.match?.trim().toUpperCase();
  const stopCode = query || "UTOWN";

  await ctx.reply(`🔄 *Fetching arrivals for ${stopCode}...*`, { parse_mode: "Markdown" });

  try {
    const { caption, shuttles, isScheduled } = await fetchShuttleService(stopCode);
    const formatted = formatShuttleTimings(caption || stopCode, shuttles, isScheduled);

    await ctx.reply(formatted, {
      parse_mode: "Markdown",
      reply_markup: getQuickStopsKeyboard(),
    });
  } catch (error) {
    console.error("Error in /bus command:", error);
    await ctx.reply("❌ Unable to retrieve shuttle arrivals at the moment. Please try again later.");
  }
});

// /disruptions
bot.command("disruptions", async (ctx) => {
  try {
    const announcements = await fetchAnnouncements();

    if (announcements.length === 0) {
      await ctx.reply(
        "✅ *No transit disruptions reported.*\nAll campus internal shuttle buses are operating under normal schedule.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    let message = "⚠️ *Active NUS Transit Advisories & Disruptions:*\n\n";
    announcements.forEach((ann, index) => {
      message += `${index + 1}. ${ann}\n\n`;
    });

    await ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error in /disruptions command:", error);
    await ctx.reply("❌ Unable to fetch disruption advisories at this time.");
  }
});

// /class <moduleCode>
bot.command("class", async (ctx) => {
  const moduleCode = ctx.match?.trim().toUpperCase();

  if (!moduleCode) {
    await ctx.reply("ℹ️ Please provide a module code.\n*Example:* `/class CS2030S` or `/class MA1521`", {
      parse_mode: "Markdown",
    });
    return;
  }

  await ctx.reply(`🔍 *Looking up timetable for ${moduleCode}...*`, { parse_mode: "Markdown" });

  try {
    const moduleData = await fetchModuleData(moduleCode);
    if (!moduleData) {
      await ctx.reply(`❌ Module *${moduleCode}* not found on NUSMods for the academic year.`, {
        parse_mode: "Markdown",
      });
      return;
    }

    const firstLesson = extractFirstLesson(moduleData);
    if (!firstLesson) {
      await ctx.reply(
        `📚 *${moduleData.moduleCode}: ${moduleData.title}*\nNo scheduled timetable lessons found for this module.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    let msg = `📚 *${firstLesson.moduleCode}: ${firstLesson.title}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🗓 *Lesson:* ${firstLesson.lessonType} (${firstLesson.classNo})\n`;
    msg += `⏰ *Time:* ${firstLesson.day}, ${firstLesson.startTime} - ${firstLesson.endTime}\n`;
    msg += `📍 *Venue:* \`${firstLesson.venue}\`\n`;
    msg += `🚏 *Nearest Bus Stop:* *${firstLesson.mappedStopName}* (\`${firstLesson.mappedStopCode}\`)\n\n`;

    // Fetch timings for this stop
    const { shuttles, isScheduled } = await fetchShuttleService(firstLesson.mappedStopCode);

    msg += `*Arrivals at ${firstLesson.mappedStopName}:*\n`;
    if (isScheduled) {
      msg += `_(Scheduled - Estimated)_\n`;
    }

    if (shuttles.length === 0 || shuttles.every((s) => s.arrivalTime === "-")) {
      msg += `🌙 *No shuttles currently running.*`;
    } else {
      for (const s of shuttles) {
        const badge = getUrgencyBadge(s.arrivalTime);
        const arrTime = s.arrivalTime === "Arr" ? "Arr" : s.arrivalTime === "-" ? "Off-service" : `${s.arrivalTime} min`;
        msg += `• *${s.name}*: ${badge} ${arrTime}\n`;
      }
    }

    await ctx.reply(msg, {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().text(
        `🔄 Refresh ${firstLesson.mappedStopName}`,
        `stop:${firstLesson.mappedStopCode}`
      ),
    });
  } catch (error) {
    console.error("Error in /class command:", error);
    await ctx.reply("❌ Error retrieving class and transit information.");
  }
});

// Inline keyboard callback query handler
bot.callbackQuery(/^stop:(.+)$/, async (ctx) => {
  const stopCode = ctx.match[1];

  try {
    await ctx.answerCallbackQuery({ text: `Loading ${stopCode}...` });
    const { caption, shuttles, isScheduled } = await fetchShuttleService(stopCode);
    const formatted = formatShuttleTimings(caption || stopCode, shuttles, isScheduled);

    await ctx.reply(formatted, {
      parse_mode: "Markdown",
      reply_markup: getQuickStopsKeyboard(),
    });
  } catch (error) {
    console.error("Error in callback query:", error);
    await ctx.reply("❌ Could not load timings for the selected stop.");
  }
});
