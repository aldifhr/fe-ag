import { getLogger } from "../logger.js";
import { sendDiscordEmbedsChannelBatch } from "../discord/messaging.js";
import { DiscordEmbedData } from "../types.js";
import { env } from "../config/env.js";

const logger = getLogger({ scope: "health-monitor" });

const sourceActivityMap = new Map<string, number>();
const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 Hours
const HEALTH_ALERT_CHANNEL_ID = env.HEALTH_ALERT_CHANNEL_ID || "1500721659915665549";

/**
 * Record that a source just provided an update
 */
export async function recordSourceActivity(source: string) {
  sourceActivityMap.set(source, Date.now());
}

/**
 * Check if any source has become stale (no updates for a long time)
 */
export async function checkSourceHealth(sources: string[]) {
  const alerts: string[] = [];
  const now = Date.now();

  for (const source of sources) {
    const lastUpdate = sourceActivityMap.get(source);
    
    if (lastUpdate !== undefined) {
      const elapsed = now - lastUpdate;
      
      if (elapsed > STALE_THRESHOLD_MS) {
        const hours = Math.round(elapsed / (1000 * 60 * 60));
        alerts.push(`⚠️ **[${source.toUpperCase()}]** has not sent updates for **${hours} hours**!`);
      }
    } else {
      // First time initialization
      recordSourceActivity(source);
    }
  }

  if (alerts.length > 0) {
    logger.warn({ count: alerts.length }, "Source health alerts detected");
    
    // Send alert to Discord
    const alertMessage = `🚨 **MANHWA MONITORING SYSTEM** 🚨\n\n${alerts.join('\n')}\n\n*Note: Bot is still running, but the sources above have not provided new updates in the last few hours.*`;
    
    try {
      const embeds: DiscordEmbedData[] = [{
        title: "⚠️ Peringatan Stabilitas Sumber",
        description: alertMessage,
        type: "report",
        // Mandatory fields for DiscordEmbedData
        chapter: "Health Monitor",
        url: "https://manhwa-scrap.system",
        source: "system",
      }];
      
      await sendDiscordEmbedsChannelBatch(
        embeds,
        HEALTH_ALERT_CHANNEL_ID
      );
    } catch (err) {
      logger.error({ err: (err as Error).message }, "Failed to send health alert to Discord");
    }
    
    return alertMessage;
  }
  
  return null;
}
