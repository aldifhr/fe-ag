/**
 * Cron job cleanup and maintenance tasks
 */

import { cleanupScrapeOptimizer } from "../../shared/scrapers/optimizer.js";

export function runCleanupTasks(): void {
  cleanupScrapeOptimizer();
}
