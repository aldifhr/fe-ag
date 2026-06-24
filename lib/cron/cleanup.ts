/**
 * Cron job cleanup and maintenance tasks
 */

import { getLogger } from "../logger.js";
import { cleanupScrapeOptimizer } from "../scrapers/optimizer.js";
import { supabase } from "../supabase.js";

const logger = getLogger({ scope: "cron:cleanup" });

/**
 * Run all cleanup tasks
 */
export function runCleanupTasks(): void {
  cleanupScrapeOptimizer();
  cleanupOldDispatchClaims().catch(() => {});
}

async function cleanupOldDispatchClaims(): Promise<void> {
  try {
    const { error } = await supabase
      .from("dispatch_claims")
      .delete()
      .lt("created_at", new Date(Date.now() - 2 * 86400000).toISOString());

    if (error) throw error;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg }, "Failed to cleanup old dispatch claims");
  }
}
