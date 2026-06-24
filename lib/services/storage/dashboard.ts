import { getLogger } from "../../logger.js";
import { CronLogEntry, WhitelistEntry, MangaMetadata } from "../../types.js";
import { normalizeCronLogEntry } from "../../utils/log-helpers.js";
import { CronLogEntrySchema, ChapterItemSchema } from "../../schemas.js";
import { validateData } from "../../validation.js";
import { loadWhitelist } from "./whitelist.js";
import { batchGetMangaMetadata } from "./metadata.js";
import { supabase } from "../../supabase.js";
import { normalizeTitleKey } from "../../domain.js";

const logger = getLogger({ scope: "storage.dashboard" });

export interface DashboardSnapshot {
  cronStatus: unknown;
  sourceHealth: Record<string, unknown>;
  recommendations: string[];
  lastHealthCheck: string | null;
  recentChapters: unknown[];
  recentLogs: CronLogEntry[];
  liveEvents: unknown[];
  whitelist: WhitelistEntry[];
  whitelistCount: number;
  queueLength: number;
  queueItems: unknown[];
  timestamp: string;
}


export async function readCronLogs(start = 0, stop = 49): Promise<CronLogEntry[]> {
  const limit = Math.max(1, stop - start + 1);
  const { data, error } = await supabase
    .from('cron_logs')
    .select('raw_payload')
    .order('timestamp', { ascending: false })
    .range(start, stop);

  if (error || !data) {
    logger.warn({ error: error?.message }, "Failed to fetch logs from Supabase");
    return [];
  }

  return data
    .map(d => {
      const normalized = normalizeCronLogEntry(d.raw_payload);
      return validateData(CronLogEntrySchema, normalized, "cron_log_entry", logger);
    })
    .filter((l): l is CronLogEntry => !!l);
}

export async function readRecentChapters(_start = 0, _stop = 49): Promise<unknown[]> {
  // Redis removed; recent chapters no longer available
  return [];
}

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  // Redis removed; all pipeline-based data is replaced with default/empty values

  const cronStatus = null;
  const sourceHealth: Record<string, unknown> = {};
  const recommendations: string[] = [];
  const lastHealthCheck: string | null = null;
  const recentChapters: unknown[] = [];
  const liveEvents: unknown[] = [];

  // Pull logs from Supabase via readCronLogs
  const parsedRecentLogs = await readCronLogs(0, 9);

  let whitelist: WhitelistEntry[] = [];
  try {
    whitelist = await loadWhitelist();
    
    // Hydrate whitelist with metadata (covers, etc.)
    const titleKeys = whitelist.map(w => w._normalizedTitle || normalizeTitleKey(w.title));
    const metadata = await batchGetMangaMetadata(titleKeys);
    
    whitelist = whitelist.map((entry, i) => {
      const meta = metadata[i];
      if (meta && meta.cover) {
        return {
          ...entry,
          cover: meta.cover,
          description: meta.description,
          status: meta.status,
          rating: meta.rating
        } as any;
      }
      return entry;
    });
  } catch (err: unknown) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "[fetchDashboardSnapshot] Failed to load whitelist");
  }

  return {
    cronStatus,
    sourceHealth,
    recommendations,
    lastHealthCheck,
    recentChapters,
    recentLogs: parsedRecentLogs,
    liveEvents,
    whitelist,
    whitelistCount: whitelist.length,
    queueLength: 0,
    queueItems: [],
    timestamp: new Date().toISOString(),
  };
}
