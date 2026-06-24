/**
 * Cron job cleanup and maintenance tasks
 */

import { cleanupScrapeOptimizer } from "../scrapers/optimizer.js";

export function runCleanupTasks(): void {
  cleanupScrapeOptimizer();
}
