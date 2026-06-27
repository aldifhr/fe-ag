/**
 * Cron job input loading - whitelist, guild channels, source health
 */

import { getLogger } from "../../shared/logger.js";
import {
  loadWhitelist,
  getAllGuildChannels,
  supabasePing,
} from "../services/storage.js";
import { proactiveHealWhitelist } from "../services/url/healing.js";
import { initializeAllProviders } from "../boot.js";
import { initializeScrapeOptimizer } from "../../shared/scrapers/optimizer.js";
import type {
  WhitelistEntry,
  SourceHealth,
} from "../../shared/types.js";

const logger = getLogger({ scope: "cron:inputs" });

export interface CronInputs {
  whitelist: WhitelistEntry[];
  guildChannels: Record<string, string>;
  sourceHealthMap: Record<string, SourceHealth>;
}

export interface LoadInputsOptions {
  loadWhitelistFn?: () => Promise<WhitelistEntry[]>;
  getAllGuildChannelsFn?: () => Promise<Record<string, string>>;
}

/**
 * Load all cron inputs concurrently
 */
export async function loadCronInputs(
  options: LoadInputsOptions = {},
): Promise<CronInputs> {
  const {
    loadWhitelistFn = loadWhitelist,
    getAllGuildChannelsFn = getAllGuildChannels,
  } = options;

  // Initialize providers and optimizer in parallel
  const initPromise = initializeAllProviders().catch((err: unknown) => {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Provider initialization failed, continuing with registered providers",
    );
  });
  initializeScrapeOptimizer();

  // Anti-Shutdown: Send a ping to Supabase to keep the project active
  supabasePing().catch((err: unknown) => {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "Supabase ping failed");
  });

  const [whitelist, guildChannels, _] =
    await Promise.all([
      loadWhitelistFn(),
      getAllGuildChannelsFn(),
      initPromise,
      proactiveHealWhitelist().catch((err: unknown) => {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "proactiveHealWhitelist failed, continuing",
        );
      }),
    ]);
  const sourceHealthMap: Record<string, SourceHealth> = {};

  return {
    whitelist,
    guildChannels: guildChannels || {},
    sourceHealthMap,
  };
}

/**
 * Validate that we have minimum required inputs to proceed
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  details?: string;
}

export function validateCronInputs(
  inputs: CronInputs,
): ValidationResult {
  if (!inputs.whitelist.length) {
    return { valid: false, reason: "no_whitelist" };
  }

  const activeGuilds = Object.keys(inputs.guildChannels).length;
  if (!activeGuilds) {
    return { valid: false, reason: "no_guilds" };
  }

  return { valid: true };
}
