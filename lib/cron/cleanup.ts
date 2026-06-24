/**
 * Cron job cleanup and maintenance tasks
 */

import { getLogger } from "../logger.js";
import { cleanupScrapeOptimizer } from "../scrapers/optimizer.js";
import type { RedisClient } from "../types.js";

const logger = getLogger({ scope: "cron:cleanup" });

/**
 * Run all cleanup tasks (fire-and-forget)
 */
export function runCleanupTasks(redis: RedisClient): void {
  // Cleanup optimizer to prevent memory leaks
  cleanupScrapeOptimizer();

  // Note: cleanupOldLogs and syncDailyStatsToSupabase removed.
  // Supabase handles data retention and TTL automatically.
}
