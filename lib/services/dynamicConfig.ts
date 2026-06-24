import { getLogger } from "../logger.js";

const logger = getLogger({ scope: "dynamic-config" });

export interface DynamicOverrides {
  shinigamiBase?: string;
  ikiruBase?: string;
  lastUpdated?: string;
}

// In-memory only; Redis removed
let cachedOverrides: DynamicOverrides = {};

/**
 * Get dynamic overrides from in-memory cache
 */
export async function getDynamicOverrides(): Promise<DynamicOverrides> {
  return cachedOverrides;
}

/**
 * Set dynamic overrides in memory
 */
export async function setDynamicOverrides(overrides: Partial<DynamicOverrides>): Promise<void> {
  const next = { ...cachedOverrides, ...overrides, lastUpdated: new Date().toISOString() };
  cachedOverrides = next;
  logger.info(overrides, "Updated dynamic overrides");
}
