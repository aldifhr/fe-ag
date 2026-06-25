import { getLogger } from "../../logger.js";
import { CronLogEntry, WhitelistEntry, MangaMetadata } from "../../types.js";
import { normalizeCronLogEntry } from "../../utils/log-helpers.js";
import { CronLogEntrySchema } from "../../schemas.js";
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

export async function readRecentChapters(start = 0, stop = 49): Promise<unknown[]> {
  try {
    const { data, error } = await supabase
      .from('dispatch_history')
      .select('*')
      .order('sent_at', { ascending: false })
      .range(start, stop);

    if (error || !data || data.length === 0) {
      if (error) logger.warn({ error: error.message }, "Failed to fetch recent chapters");
      return [];
    }

    const titleKeys = [...new Set(data.map(d => d.title_key))];
    const { data: whitelistData } = await supabase
      .from('whitelist')
      .select('title_key, title')
      .in('title_key', titleKeys);

    const titleMap = new Map<string, string>();
    if (whitelistData) {
      for (const row of whitelistData) {
        titleMap.set(row.title_key, row.title);
      }
    }

    return data.map(d => ({
      title: titleMap.get(d.title_key) || d.title_key,
      chapter: d.chapter_title,
      url: d.chapter_url,
      source: d.source,
      sentAt: d.sent_at,
      metadata: d.metadata,
    }));
  } catch (err) {
    logger.warn({ err }, "readRecentChapters failed");
    return [];
  }
}

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  // Redis removed; all pipeline-based data is replaced with default/empty values

  const cronStatus = null;
  const sourceHealth: Record<string, unknown> = {};
  const recommendations: string[] = [];
  const lastHealthCheck: string | null = null;
  const liveEvents: unknown[] = [];

  // Pull logs and recent chapters from Supabase
  const [recentChapters, parsedRecentLogs] = await Promise.all([
    readRecentChapters(0, 19),
    readCronLogs(0, 9),
  ]);

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
