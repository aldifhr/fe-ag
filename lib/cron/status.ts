import { readCronStatus, loadSourceHealthSnapshot } from "../services/storage.js";
import { SOURCE_KEYS } from "../constants/sources.js";

export async function readCronStatusWithHealth() {
  const data = await readCronStatus();
  if (!data) return null;

  const fallbackHealth = await loadSourceHealthSnapshot(SOURCE_KEYS);

  const base = {
    ...data,
    recommendations: [] as unknown[],
    lastHealthCheck: null as string | null,
  };

  if (data.sourceHealth && typeof data.sourceHealth === "object") {
    const mergedHealth = { ...fallbackHealth };
    for (const [source, value] of Object.entries(data.sourceHealth)) {
      mergedHealth[source] = value;
    }
    return {
      ...base,
      sourceHealth: mergedHealth,
    };
  }

  return {
    ...base,
    sourceHealth: fallbackHealth,
  };
}
