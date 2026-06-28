/**
 * Health map loading/saving extracted from orchestrator
 * ponytail: single-function extraction; split when health logic grows beyond map CRUD
 */
import { SourceState, SourceHealth } from "../types.js";
import { normalizeSource } from "./shared.js";
import {
  buildNextSourceHealthMap,
  getDisabledSources,
  saveSourceHealthMap,
} from "../../lib/services/health.js";
import { SOURCE_KEYS } from "../constants/sources.js";
import { getLogger } from "../logger.js";

const logger = getLogger({ scope: "orchestrator:health" });

export function loadDisabledSources(
  currentHealthMap: Record<string, SourceHealth>,
  optionsDisabledSources?: string[],
): { disabledSources: Set<string>; disabledInfo: Record<string, string> } {
  const cooldownSources = getDisabledSources(currentHealthMap, SOURCE_KEYS);
  const optionsDisabled = Array.isArray(optionsDisabledSources)
    ? optionsDisabledSources.map((source) => normalizeSource(source)!)
    : [];

  const disabledSources = new Set([...cooldownSources, ...optionsDisabled]);
  const disabledInfo: Record<string, string> = {};
  for (const src of disabledSources) {
    disabledInfo[src] = "Source in cooldown or manually disabled";
  }

  if (disabledSources.size > 0) {
    logger.info(
      { disabled: Array.from(disabledSources) },
      "skipping disabled or cooling down sources",
    );
  }

  return { disabledSources, disabledInfo };
}

export async function updateAndSaveHealthMap(
  sourceStates: Record<string, SourceState>,
  currentHealthMap: Record<string, SourceHealth>,
  options?: { healthFailureThreshold?: number; healthCooldownSeconds?: number },
): Promise<Record<string, SourceHealth>> {
  let nextSourceHealth: Record<string, SourceHealth> = currentHealthMap;
  try {
    nextSourceHealth = buildNextSourceHealthMap({
      sourceKeys: SOURCE_KEYS,
      currentMap: currentHealthMap,
      sourceStates,
      nowIso: new Date().toISOString(),
      failureThreshold: options?.healthFailureThreshold,
      cooldownSeconds: options?.healthCooldownSeconds,
    });
    await saveSourceHealthMap(nextSourceHealth, SOURCE_KEYS);
  } catch (healthErr: unknown) {
    const err = healthErr instanceof Error ? healthErr : new Error(String(healthErr));
    logger.warn({ err: err.message }, "failed to update source health map");
  }
  return nextSourceHealth;
}
