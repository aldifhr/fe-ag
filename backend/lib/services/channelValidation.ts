import { httpGet } from "../../shared/httpClient.js";
import pLimit from "p-limit";
import { getLogger } from "../../shared/logger.js";
import { env } from "../../shared/config/env.js";
import type {
  DiscordChannel,
  DiscordApiError,
  FetchDiscordChannelOptions,
  ValidateDiscordChannelOptions,
  ValidateDiscordChannelsBatchOptions,
} from "../../shared/types.js";

const logger = getLogger({ scope: "channelValidation" });

export const CHANNEL_VALIDATION_CACHE_SEC = env.CHANNEL_VALIDATION_CACHE_SEC;

export const CHANNEL_VALIDATION_CONCURRENCY = 5;

// Module-level in-memory cache: channelId -> { valid, expiresAt }
const validationCache = new Map<string, { valid: boolean; expiresAt: number }>();

// Re-export consolidated types for backward compatibility
export type { DiscordChannel, DiscordApiError, FetchDiscordChannelOptions, ValidateDiscordChannelOptions, ValidateDiscordChannelsBatchOptions };

/**
 * Runs a background cleanup of expired validation entries.
 * Does not await the results to avoid blocking the main execution.
 */
function _runAsyncCleanup(): void {
  // Only run cleanup with a 5% chance to minimize overhead during high-concurrency runs
  if (Math.random() > 0.05) return;

  // Run in background without awaiting
  (async () => {
    try {
      const now = Date.now();
      const toDelete: string[] = [];
      for (const [channelId, entry] of validationCache) {
        if (entry.expiresAt < now) {
          toDelete.push(channelId);
        }
      }
      for (const channelId of toDelete) {
        validationCache.delete(channelId);
      }
    } catch {
      // Cleanup errors are non-critical
    }
  })();
}

export async function fetchDiscordChannel({
  channelId,
  botToken,
}: FetchDiscordChannelOptions): Promise<DiscordChannel | null> {
  if (!channelId) return null;

  const resp = await httpGet(
    `https://discord.com/api/v10/channels/${channelId}`,
    {
      headers: { Authorization: `Bot ${botToken}` },
      timeout: 10000,
    },
    { retries: 2 },
  );

  return resp.data ?? null;
}

export async function getCachedChannelValidity(
  channelId: string,
): Promise<boolean | null> {
  if (!channelId) return null;
  try {
    const cached = validationCache.get(channelId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.valid;
    }
  } catch {
    // ignore cache read errors
  }
  return null;
}

export async function validateDiscordChannel({
  channelId,
  botToken,
  cacheSec = CHANNEL_VALIDATION_CACHE_SEC,
  onValid = null,
  onInvalid = null,
}: ValidateDiscordChannelOptions): Promise<boolean> {
  if (!channelId) return false;

  const cached = await getCachedChannelValidity(channelId);
  if (cached !== null) return cached;

  try {
    const channel = await fetchDiscordChannel({ channelId, botToken });

    validationCache.set(channelId, {
      valid: true,
      expiresAt: Date.now() + cacheSec * 1000,
    });
    _runAsyncCleanup();

    if (channel && typeof onValid === "function") {
      await Promise.resolve(onValid(channel));
    }
    return !!channel;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 403 || status === 404) {
      validationCache.set(channelId, {
        valid: false,
        expiresAt: Date.now() + cacheSec * 1000,
      });
      _runAsyncCleanup();
    }
    if (typeof onInvalid === "function") {
      await Promise.resolve(onInvalid(err as Error | { message: string; response?: { status?: number } }));
    }
    return false;
  }
}


/**
 * Fetch multiple Discord channels in parallel with concurrency control
 */
export async function fetchDiscordChannelsBatch(
  channelIds: string[],
  botToken: string,
  concurrency = CHANNEL_VALIDATION_CONCURRENCY,
): Promise<Map<string, any>> {
  if (!channelIds || channelIds.length === 0) return new Map();

  const limit = pLimit(concurrency);
  const results = new Map();

  const fetchTasks = channelIds.map((channelId) =>
    limit(async () => {
      try {
        const channel = await fetchDiscordChannel({ channelId, botToken });
        return { channelId, channel, valid: true };
      } catch (err: unknown) {
        const axiosErr = err as Record<string, unknown> | undefined;
        const response = axiosErr?.response as Record<string, unknown> | undefined;
        const status = response?.status as number | undefined;
        return {
          channelId,
          channel: null,
          valid: !(status === 403 || status === 404),
          error: err,
        };
      }
    }),
  );

  const settled = await Promise.allSettled(fetchTasks);

  for (let i = 0; i < channelIds.length; i++) {
    const result = settled[i];
    const channelId = channelIds[i];

    if (result.status === "fulfilled") {
      results.set(channelId, result.value);
    } else {
      results.set(channelId, { channel: null, valid: false });
    }
  }

  return results;
}

/**
 * Batch check cached validity for multiple channels
 */
export async function getCachedChannelsValidityBatch(
  channelIds: string[],
): Promise<Map<string, boolean | null>> {
  if (!channelIds || channelIds.length === 0) return new Map();

  const results = new Map<string, boolean | null>();
  const now = Date.now();

  for (const channelId of channelIds) {
    try {
      const cached = validationCache.get(channelId);
      if (cached && cached.expiresAt > now) {
        results.set(channelId, cached.valid);
      } else {
        results.set(channelId, null);
      }
    } catch {
      results.set(channelId, null);
    }
  }

  return results;
}

export async function validateDiscordChannelsBatch({
  channelIds = [],
  botToken,
  cacheSec = CHANNEL_VALIDATION_CACHE_SEC,
  concurrency = CHANNEL_VALIDATION_CONCURRENCY,
}: ValidateDiscordChannelsBatchOptions): Promise<Map<string, boolean>> {
  if (!channelIds || channelIds.length === 0) return new Map();

  const results = new Map<string, boolean>();
  const now = Date.now();

  const cachedResults = await getCachedChannelsValidityBatch(channelIds);
  const channelsToFetch: string[] = [];

  for (const [channelId, valid] of cachedResults) {
    if (valid !== null) {
      results.set(channelId, valid);
    } else {
      channelsToFetch.push(channelId);
    }
  }

  if (channelsToFetch.length === 0) {
    return results;
  }

  const fetchedResults = await fetchDiscordChannelsBatch(
    channelsToFetch,
    botToken,
    concurrency,
  );

  for (const [channelId, data] of fetchedResults) {
    const isValid = data.valid;
    results.set(channelId, isValid);

    validationCache.set(channelId, {
      valid: isValid,
      expiresAt: now + cacheSec * 1000,
    });
  }

  _runAsyncCleanup();

  return results;
}
