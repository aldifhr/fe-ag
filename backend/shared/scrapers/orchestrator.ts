import {
  batchGetLastScrapeChecks,
  batchSetLastScrapeChecks,
  appendLiveEvent,
} from "../../lib/services/storage.js";
import {
  SourceState,
  ChapterItem,
  SourceHealth,
  OrchestrateOptions,
  Logger,
} from "../types.js";
import { isWithinLastHours, safeParseDate } from "../dateUtils.js";
import { normalizeSourceUrl, normalizeTitleKey } from "./shared.js";
import { mangaProviderRegistry } from "../providers/registry.js";
import {
  getHibernatingTitleKeys,
  applyIncrementalFilter,
  buildPreferredSecondaryMatcher,
  hasPreferredSecondaryMatcher,
  filterWhitelistedChapters,
  filterRecentChapters,
  PreferredSecondaryMatcher,
} from "./orchestrator-helpers.js";
import { autoHealIfNeeded } from "../../lib/services/domainHealing.js";
import { getLogger } from "../logger.js";
import { enrichScrapeResults } from "./orchestrator-enrich.js";
import { loadDisabledSources, updateAndSaveHealthMap } from "./orchestrator-health.js";

const defaultLogger = getLogger({ scope: "scraper" });

// Re-export for backward compatibility
export type { PreferredSecondaryMatcher } from "./orchestrator-helpers.js";

type OrchestrateLogger = Pick<Logger, "info" | "error" | "warn" | "debug">;

export interface OrchestrateScrapeSourcesParams {
  options?: OrchestrateOptions;
  logger?: OrchestrateLogger;
  providers?: import("../providers/base.js").MangaProvider[];
}

export async function orchestrateScrapeSources({
  options = {},
  logger = defaultLogger,
  providers = mangaProviderRegistry.getAllProviders(),
}: OrchestrateScrapeSourcesParams = {}) {
  const { lifecycle, startTime = Date.now(), deadlineMs = 0 } = options;
  const deadline = deadlineMs > 0 ? startTime + deadlineMs : 0;
  const SCRAPE_SAFETY_MARGIN_MS = 5000;

  const sourceStates: Record<string, SourceState> = {};
  providers.forEach(p => {
    sourceStates[p.id] = { status: "pending", count: 0, error: null, metrics: null, errCode: null };
  });
  const scrapedChapters: ChapterItem[] = [];

  const currentHealthMap: Record<string, SourceHealth> = options?.currentHealthMap ?? {};

  try {
    // --- Disabled / cooldown sources (delegated to orchestrator-health) ---
    const { disabledSources, disabledInfo } = loadDisabledSources(currentHealthMap, options?.disabledSources);
    for (const src of disabledSources) {
      if (sourceStates[src]) {
        sourceStates[src].status = "circuit_break";
        sourceStates[src].error = disabledInfo[src];
      }
    }

    // --- Whitelist setup ---
    const ikiruTitles = Array.isArray(options?.preferredIkiru?.titles)
      ? options.preferredIkiru.titles
      : (Array.isArray(options?.preferredIkiruTitles) ? options.preferredIkiruTitles : []);

    const ikiruUrls = Array.isArray(options?.preferredIkiru?.urls) ? options.preferredIkiru.urls : [];

    let preferredIkiruTitleKeys = new Set(
      ikiruTitles
        .map((title) => normalizeTitleKey(title))
        .filter((tk): tk is string => !!tk),
    );

    const preferredIkiruUrlKeys = new Set(
      ikiruUrls
        .map((url) => normalizeSourceUrl(url))
        .filter((uk): uk is string => !!uk),
    );

    // Keep full copies for final filtering
    const fullWhitelistIkiruTitleKeys = new Set(preferredIkiruTitleKeys);
    const fullWhitelistIkiruUrlKeys = new Set(preferredIkiruUrlKeys);

    const secondarySourceNames = Object.keys(options?.preferredSecondaryTitles || {});
    const preferredSecondaryMatchersBySource: Record<string, PreferredSecondaryMatcher> = {};
    for (const src of secondarySourceNames) {
      preferredSecondaryMatchersBySource[src] = buildPreferredSecondaryMatcher(
        options?.preferredSecondaryTitles?.[src],
        options?.preferredSecondaryUrls?.[src],
        options?.preferredSecondaryEntries?.[src],
      );
    }
    const secondarySources = Object.keys(preferredSecondaryMatchersBySource);

    // Keep full copies for final filtering
    const fullWhitelistSecondaryTitleKeys = new Set(
      secondarySources.flatMap(src => Array.from(preferredSecondaryMatchersBySource[src].titleKeys))
    );
    const fullWhitelistSecondaryUrlKeys = new Set(
      secondarySources.flatMap(src => Array.from(preferredSecondaryMatchersBySource[src].urlKeys))
    );

    // --- Incremental + hibernation filter ---
    const useIncremental = options?.incremental !== false && options?.force !== true;
    const allTitleKeys = Array.from(
      new Set([
        ...preferredIkiruTitleKeys,
        ...preferredSecondaryMatchersBySource.shinigami.titleKeys,
      ]),
    );

    const initialTitleCount = allTitleKeys.length;
    let hibernatedCount = 0;
    let incrementalSavedCount = 0;

    const [skipTitleKeys, ikiruIncrementalFiltered, secondaryIncrementalFiltered] = await Promise.all([
      getHibernatingTitleKeys(allTitleKeys, options),
      useIncremental && preferredIkiruTitleKeys.size > 0
        ? applyIncrementalFilter(preferredIkiruTitleKeys, batchGetLastScrapeChecks)
        : null as unknown as Promise<Set<string>>,
      Promise.all(
        secondarySources.map(async (source) => {
          const matcher = preferredSecondaryMatchersBySource[source];
          const results: {
            source: string;
            titleKeys: Set<string> | null;
            urlKeys: Set<string> | null;
            originalCount: number;
          } = { source, titleKeys: null, urlKeys: null, originalCount: matcher.titleKeys.size };
          if (useIncremental) {
            [results.titleKeys, results.urlKeys] = await Promise.all([
              matcher.titleKeys.size > 0 ? applyIncrementalFilter(matcher.titleKeys, batchGetLastScrapeChecks) : null,
              matcher.urlKeys.size > 0 ? applyIncrementalFilter(matcher.urlKeys, batchGetLastScrapeChecks) : null,
            ]);
          }
          return results;
        }),
      ),
    ]);

    hibernatedCount = skipTitleKeys.size;

    if (ikiruIncrementalFiltered) {
      incrementalSavedCount += (preferredIkiruTitleKeys.size - ikiruIncrementalFiltered.size);
      preferredIkiruTitleKeys = ikiruIncrementalFiltered;
    }

    for (const filterRes of secondaryIncrementalFiltered) {
      const matcher = preferredSecondaryMatchersBySource[filterRes.source];
      if (!matcher) continue;

      if (filterRes.titleKeys && filterRes.titleKeys instanceof Set) {
        incrementalSavedCount += (filterRes.originalCount - filterRes.titleKeys.size);
        matcher.titleKeys = filterRes.titleKeys;
      }
      if (filterRes.urlKeys && filterRes.urlKeys instanceof Set) {
        matcher.urlKeys = filterRes.urlKeys;
      }
    }

    // Apply hibernation skip ONCE to all final sets
    if (skipTitleKeys.size > 0) {
      for (const tk of skipTitleKeys) {
        preferredIkiruTitleKeys.delete(tk);
        for (const source of secondarySources) {
          preferredSecondaryMatchersBySource[source].titleKeys.delete(tk);
        }
      }
    }

    // --- Provider scrape tasks ---
    const providerTasks = providers.map(async (provider) => {
      const sourceStart = Date.now();
      const id = provider.id;

      // Individual provider budget: Total Scrape Time - dispatch buffer
      const providerDeadline = deadline ? Math.min(deadline - 2000, Date.now() + 45000) : 0;

      try {
        if (deadline && Date.now() > deadline - SCRAPE_SAFETY_MARGIN_MS) {
          return { id, results: [], state: { status: "skipped", count: 0, error: "Nearing execution deadline", metrics: null, responseTime: Date.now() - sourceStart } };
        }

        if (disabledSources.has(id)) {
          return { id, results: [], state: { status: "circuit_break", count: 0, error: "Source in cooldown or manually disabled", metrics: null, responseTime: Date.now() - sourceStart } };
        }

        if (lifecycle) lifecycle.currentStep = `scraping_${id}`;

        let matcher: { titles: Set<string>; urls: Set<string> } | PreferredSecondaryMatcher | null = null;
        if (id === "ikiru") {
          matcher = { titles: preferredIkiruTitleKeys, urls: preferredIkiruUrlKeys };
          if (matcher.titles.size === 0 && matcher.urls.size === 0) {
            return { id, results: [], state: { status: "skipped", count: 0, error: "no whitelist titles", metrics: null, responseTime: Date.now() - sourceStart } };
          }
        } else if (preferredSecondaryMatchersBySource[id]) {
          matcher = preferredSecondaryMatchersBySource[id];
          if (!hasPreferredSecondaryMatcher(matcher)) {
            return { id, results: [], state: { status: "skipped", count: 0, error: "no whitelist titles", metrics: null, responseTime: Date.now() - sourceStart } };
          }
        }

        const scrapeWithRetry = async () => {
          let attempts = 0;
          const maxAttempts = 2; // Try up to 2 times (1 retry)

          while (attempts < maxAttempts) {
            attempts++;
            try {
              const out = await provider.scrapeUpdates({
                preferredMatcher: matcher as Record<string, unknown> | null,
                logger: logger as Logger,
                force: options.force,
                fullRefresh: options.fullRefresh,
                skipExpansion: options.skipExpansion,
                deadline: providerDeadline,
              });

              const status = out.state?.status;
              const errCode = out.state?.errCode;

              // Only retry on certain error codes and if we have time
              const isTransient = errCode === "TIMEOUT" || errCode === "RATE_LIMIT" || status === "error";
              const hasTime = !deadline || (Date.now() < deadline - (SCRAPE_SAFETY_MARGIN_MS + 2000));

              if (status === "error" && isTransient && hasTime && attempts < maxAttempts) {
                const backoff = 2000 * attempts;
                logger.warn({ source: id, attempt: attempts, backoff }, "adaptive retry: transient error detected, retrying...");
                await new Promise(r => setTimeout(r, backoff));
                continue;
              }

              if (status === "error" && attempts === maxAttempts) {
                // Final attempt failed, check if we need to auto-heal domain
                await autoHealIfNeeded(id, out.state?.error);
              }

              return out;
            } catch (err: unknown) {
              const hasTime = !deadline || (Date.now() < deadline - 15000);
              if (hasTime && attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 2000));
                continue;
              }
              throw err;
            }
          }
          throw new Error(`Max scrape attempts reached for source: ${id}`);
        };

        const out = await scrapeWithRetry();

        // Record last check if successful
        const status = out.state?.status;
        const isSuccess = status === "ok" || status === "healthy" || status === "success";

        if (isSuccess) {
          const keysToMark = [];
          if (id === "ikiru") keysToMark.push(...Array.from(preferredIkiruTitleKeys));
          else if (preferredSecondaryMatchersBySource[id]) keysToMark.push(...Array.from(preferredSecondaryMatchersBySource[id].titleKeys));

          if (keysToMark.length) await batchSetLastScrapeChecks(keysToMark);
        }

        return { id, results: out.results, state: { ...out.state, responseTime: Date.now() - sourceStart } };
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err);
        logger.error({ err: errMessage, source: id }, `${id} scrape failed`);
        return { id, results: [], state: { status: "error", count: 0, error: errMessage, metrics: null, responseTime: Date.now() - sourceStart } };
      }
    });

    // --- Collect results ---
    const executionResults = await Promise.all(providerTasks);

    for (const res of executionResults) {
      if (res.results.length) {
        scrapedChapters.push(...res.results);
        await appendLiveEvent({
          message: `Scraped ${res.results.length} items from ${res.id}`,
          type: "info",
        });
      }
      sourceStates[res.id] = res.state as SourceState;
    }

    // --- Post-scrape filtering ---
    if (scrapedChapters.length > 0) {
      // 1. Ensure all have title keys and detect potential title mismatches (Auto-Heal candidates)
      scrapedChapters.forEach((ch: ChapterItem & { titleKey?: string }) => {
        ch.titleKey = normalizeTitleKey(String(ch?.title || ""));
      });

      // 2. Aggregate all whitelist criteria (USE FULL WHITELIST, NOT FILTERED)
      const activeWhitelistTitles = new Set([
        ...fullWhitelistIkiruTitleKeys,
        ...fullWhitelistSecondaryTitleKeys
      ]);

      const activeWhitelistUrls = new Set([
        ...fullWhitelistIkiruUrlKeys,
        ...fullWhitelistSecondaryUrlKeys
      ]);

      // 3. Filter whitelist and recent chapters
      const unfilteredCount = scrapedChapters.length;
      const filtered = filterWhitelistedChapters(scrapedChapters, activeWhitelistTitles, activeWhitelistUrls);

      if (filtered.length < unfilteredCount) {
        logger.info(
          { original: unfilteredCount, kept: filtered.length },
          "filtered out non-whitelist updates before enrichment"
        );
        scrapedChapters.length = 0;
        scrapedChapters.push(...filtered);
      }

      // 4. Filter out stale chapters (>24h)
      const recentCutoffHours = 24;
      const recentChapters = filterRecentChapters(scrapedChapters, recentCutoffHours, safeParseDate, isWithinLastHours);

      if (recentChapters.length < scrapedChapters.length) {
        logger.info(
          {
            original: scrapedChapters.length,
            kept: recentChapters.length,
            removed: scrapedChapters.length - recentChapters.length
          },
          "filtered out stale chapters older than 24 hours"
        );
        scrapedChapters.length = 0;
        scrapedChapters.push(...recentChapters);
      }
    }

    // --- Metadata enrichment (delegated to orchestrator-enrich) ---
    await enrichScrapeResults(scrapedChapters, !!options.force, deadline, SCRAPE_SAFETY_MARGIN_MS, lifecycle, logger);

    // --- Health map update (delegated to orchestrator-health) ---
    const nextSourceHealth = await updateAndSaveHealthMap(sourceStates, currentHealthMap, {
      healthFailureThreshold: options?.healthFailureThreshold,
      healthCooldownSeconds: options?.healthCooldownSeconds,
    });

    let skippedHibernation = 0;
    if (skipTitleKeys instanceof Set) {
      skippedHibernation = skipTitleKeys.size;
    }

    return {
      items: scrapedChapters,
      sourceStates: sourceStates,
      nextSourceHealth,
      metrics: {
        hibernatedCount,
        incrementalSaved: incrementalSavedCount,
        initialWhitelistSize: initialTitleCount,
      }
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error({ err: error.message }, "scrape fatal - returning partial data");
    return {
      items: scrapedChapters,
      sourceStates: sourceStates || Object.fromEntries(
        providers.map(p => [p.id, { status: "error", count: 0, error: error.message, metrics: null }])
      ),
    };
  }
}

export async function scrapeMangaUpdatesWithMeta(options: OrchestrateOptions = {}) {
  return orchestrateScrapeSources({
    options,
    logger: defaultLogger,
  });
}
