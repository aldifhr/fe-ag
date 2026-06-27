import { getLogger } from "../../shared/logger.js";
import {
  CronStatus,
  ClaimState,
  SourceHealth,
  ChapterItem,
} from "../../shared/types.js";
import {
  CronStatusSchema,
  ChannelValidationStateSchema,
} from "../../shared/schemas.js";
import { z } from "zod";
import { validateData } from "../../shared/validation.js";
import { loadWhitelist, saveWhitelist, invalidateWhitelistCache } from "./storage/whitelist.js";
import { batchGetMangaMetadata, setMangaMetadata, deleteMangaMetadata } from "./storage/metadata.js";
import { supabasePing } from "./storage/stats.js";
import { supabase } from "../supabase.js";
import { normalizeSourceUrl } from "../../shared/domain.js";


export { loadWhitelist, saveWhitelist, invalidateWhitelistCache };
export { batchGetMangaMetadata, setMangaMetadata, deleteMangaMetadata };
export { supabasePing };
export { readCronLogs, readRecentChapters, fetchDashboardSnapshot } from "./storage/dashboard.js";

type ChannelValidationState = z.infer<typeof ChannelValidationStateSchema>;

const logger = getLogger({ scope: "storage" });

const LIVE_EVENTS_LIMIT = 50;


export async function writeCronStatus(status: CronStatus): Promise<void> {
  supabase.from("cron_run_status").insert({ status }).then(({ error }: any) => {
    if (error) logger.warn({ error: error.message }, "Failed to persist cron status to Supabase");
  });
}

export async function readCronStatus(): Promise<CronStatus | null> {
  const { data: dbRow } = await supabase.from("cron_run_status").select("status").order("id", { ascending: false }).limit(1).maybeSingle();
  if (dbRow?.status) {
    return validateData(CronStatusSchema, dbRow.status, "cron_status", logger);
  }
  return null;
}

export async function loadSourceHealthSnapshot(
  keys: string[],
): Promise<Record<string, SourceHealth>> {
  if (!keys.length) return {};
  try {
    const { data, error } = await supabase
      .from("source_health")
      .select("source, status, consecutive_failures, disabled_until, last_error, last_success_at, last_checked_at, response_time_ms, failures_today, successes_today")
      .in("source", keys);

    if (error) throw error;
    if (!data) return {};

    const result: Record<string, SourceHealth> = {};
    for (const row of data) {
      result[row.source] = {
        source: row.source,
        status: row.status as SourceHealth["status"],
        consecutiveFailures: row.consecutive_failures,
        disabledUntil: row.disabled_until ?? null,
        lastError: row.last_error ?? null,
        lastSuccessAt: row.last_success_at ?? null,
        lastCheckedAt: row.last_checked_at ?? null,
        responseTime: row.response_time_ms ?? null,
        failuresToday: row.failures_today,
        successesToday: row.successes_today,
      };
    }
    return result;
  } catch (err: unknown) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "loadSourceHealthSnapshot: Supabase error");
    return {};
  }
}


export async function readChannelValidationState(): Promise<ChannelValidationState | null> {
  try {
    const { data } = await supabase
      .from("channel_validation_cache")
      .select("channel_id, valid, expires_at")
      .gt("expires_at", new Date().toISOString())
      .limit(500);
    if (!data || data.length === 0) return null;
    // Reconstruct the validation state map
    const state: Record<string, { valid: boolean; expiresAt: string }> = {};
    for (const row of data) {
      state[row.channel_id] = { valid: row.valid, expiresAt: row.expires_at };
    }
    return validateData(ChannelValidationStateSchema, state, "channel_validation_state", logger);
  } catch (err: unknown) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "readChannelValidationState: Supabase error");
    return null;
  }
}

export async function writeChannelValidationState(
  state: ChannelValidationState,
): Promise<void> {
  try {
    const rows = Object.entries(state as Record<string, any>).map(([channelId, val]) => ({
      channel_id: channelId,
      valid: val.valid ?? false,
      expires_at: val.expiresAt ?? new Date(Date.now() + 86400 * 7 * 1000).toISOString(),
    }));
    if (rows.length > 0) {
      await supabase.from("channel_validation_cache").upsert(rows, { onConflict: "channel_id" });
    }
  } catch (err: unknown) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "writeChannelValidationState: Supabase error");
  }
}

export async function appendLiveEvent(
  event: { message: string; type?: string },
): Promise<boolean> {
  const payload = {
    timestamp: new Date().toISOString(),
    message: String(event.message || "Unknown event").trim(),
    type: event.type || "info",
  };

  try {
    const { error } = await supabase.from('live_events').insert(payload);
    if (error) logger.warn({ error: error.message }, "Failed to persist live event to Supabase");
    return !error;
  } catch (err: unknown) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "Failed to append live event");
    return false;
  }
}

// --- Channel Store ---
export async function getNotificationChannel(guildId: string): Promise<string | null> {
  const field = String(guildId);
  try {
    const { data, error } = await supabase
      .from('guild_settings')
      .select('channel_id')
      .eq('guild_id', field)
      .maybeSingle();
    if (data && !error) return data.channel_id;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch guild settings from Supabase");
  }
  return null;
}

export async function setNotificationChannel(guildId: string, channelId: string): Promise<void> {
  const field = String(guildId);
  const value = String(channelId).trim();
  try {
    const { error } = await supabase
      .from('guild_settings')
      .upsert({ guild_id: field, channel_id: value, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (err) {
    logger.error({ err }, "Failed to save guild settings to Supabase");
  }
  channelMapCache = null;
}

export async function deleteGuildChannel(guildId: string): Promise<void> {
  const field = String(guildId);
  try {
    await supabase.from('guild_settings').delete().eq('guild_id', field);
  } catch (err) {
    logger.error({ err }, "Failed to delete guild settings from Supabase");
  }
  channelMapCache = null;
}

let channelMapCache: Record<string, string> | null = null;
let channelMapCacheExpiry = 0;

export async function getAllGuildChannels(): Promise<Record<string, string>> {
  const now = Date.now();
  if (channelMapCache && now < channelMapCacheExpiry) {
    return channelMapCache;
  }

  try {
    const { data, error } = await supabase
      .from('guild_settings')
      .select('guild_id, channel_id');
    if (data && !error) {
      const map: Record<string, string> = {};
      data.forEach(row => {
        if (row.guild_id && row.channel_id) map[row.guild_id] = row.channel_id;
      });
      channelMapCache = map;
      channelMapCacheExpiry = now + 60000; // 1 minute
      return map;
    }
  } catch (err) {
    logger.warn({ err }, "Failed to fetch all guild settings from Supabase");
  }

  return channelMapCache || {};
}

export async function batchGetLastScrapeChecks(titleKeys: string[]): Promise<(string | null)[]> {
  if (!titleKeys?.length) return [];

  try {
    const { data, error } = await supabase
      .from('scrape_history')
      .select('title_key, last_check_at')
      .in('title_key', titleKeys);
    
    if (error) throw error;

    const map = new Map(data.map(d => [d.title_key, new Date(d.last_check_at).getTime().toString()]));
    return titleKeys.map(k => map.get(k) || null);
  } catch (err) {
    logger.warn({ err }, "Failed to fetch scrape history from Supabase");
    return new Array(titleKeys.length).fill(null);
  }
}

export async function batchSetLastScrapeChecks(
  titleKeys: string[],
  timestamp: string | number = Date.now(),
): Promise<void> {
  if (!titleKeys?.length) return;
  
  const last_check_at = new Date(timestamp).toISOString();
  const upserts = titleKeys.map(title_key => ({
    title_key,
    last_check_at,
  }));

  try {
    const { error } = await supabase
      .from('scrape_history')
      .upsert(upserts, { onConflict: 'title_key' });
    
    if (error) throw error;
  } catch (err) {
    logger.warn({ err }, "Failed to update scrape history in Supabase");
  }
}

export async function batchClaimPendingChapters(
  items: { key: string; duplicateKey?: string | null; nowIso: string }[],
  pendingClaimTtl: number,
): Promise<boolean[]> {
  if (!items?.length) return [];

  const ttlSec = Math.floor(pendingClaimTtl);

  try {
    // Use atomic Supabase RPC for each item (parallel)
    const results = await Promise.all(
      items.map(async ({ key, duplicateKey, nowIso: _nowIso }) => {
        // Strip "chapter:" prefix — Supabase stores raw URLs
        const chapterUrl = key.startsWith("chapter:") ? key.slice("chapter:".length) : key;
        const dupUrl = duplicateKey
          ? (duplicateKey.startsWith("chapter:") ? duplicateKey.slice("chapter:".length) : duplicateKey)
          : "";

        try {
          const { data, error } = await supabase.rpc("claim_dispatch_chapter", {
            p_chapter_url: chapterUrl,
            p_duplicate_url: dupUrl,
            p_title_key: "",
            p_source: "",
            p_ttl_seconds: ttlSec,
          });
          if (error) {
            logger.warn({ err: error.message, chapterUrl }, "claim_dispatch_chapter RPC error");
            return true; // fail-open to avoid silent drops
          }
          return data === true;
        } catch (err) {
          logger.warn({ err: err instanceof Error ? err.message : String(err), chapterUrl }, "claim_dispatch_chapter failed");
          return true; // fail-open
        }
      }),
    );
    return results;
  } catch (dbErr) {
    logger.error({ err: dbErr }, "batchClaimPendingChapters: Supabase batch failed, defaulting to allow");
    return items.map(() => true);
  }
}
export async function batchCheckDispatchedChapters(chapterUrls: string[]): Promise<Set<string>> {
  if (!chapterUrls.length) return new Set();
  try {
    const { data, error } = await supabase
      .from('dispatch_history')
      .select('chapter_url')
      .in('chapter_url', chapterUrls);
    
    if (error) throw error;
    return new Set(data.map(d => d.chapter_url));
  } catch (err) {
    logger.warn({ err }, "Failed to check dispatch history in Supabase");
    return new Set();
  }
}

export async function recordDispatchToSupabase(chapter: ChapterItem, titleKey: string): Promise<void> {
  const now = new Date().toISOString();
  const normalizedUrl = normalizeSourceUrl(chapter.url);
  try {
    await Promise.all([
      supabase.from('dispatch_history').upsert({
        chapter_url: normalizedUrl,
        title_key: titleKey,
        source: chapter.source,
        chapter_title: chapter.chapter,
        sent_at: now,
        metadata: { cover: chapter.cover, updatedTime: chapter.updatedTime },
      }),
      supabase.from('dispatch_claims').upsert({
        chapter_url: normalizedUrl,
        status: "sent",
        sent_at: now,
      }, { onConflict: "chapter_url" }),
    ]);
  } catch (err) {
    logger.error({ err, url: chapter.url }, "Failed to record dispatch to Supabase");
  }
}
