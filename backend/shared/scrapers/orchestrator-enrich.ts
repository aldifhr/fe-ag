/**
 * Metadata enrichment pipeline extracted from orchestrator
 * ponytail: keep here until enrichment logic grows; then split by provider
 */
import {
  ChapterItem,
  LifecycleState,
  Logger,
} from "../types.js";
import { batchGetMangaMetadata } from "../../lib/services/storage.js";
import {
  enrichChaptersMetadata,
  applyMetadataToChapters,
} from "../../lib/services/metadata-enrichment.js";
import { sortChapters } from "./orchestrator-helpers.js";
import { getChapterNumber } from "../domain.js";
import { safeParseDate } from "../dateUtils.js";

type EnrichLogger = Pick<Logger, "info" | "error" | "warn" | "debug">;

export async function enrichScrapeResults(
  scrapedChapters: ChapterItem[],
  force: boolean,
  deadline: number,
  scrapeSafetyMarginMs: number,
  lifecycle?: LifecycleState,
  logger?: EnrichLogger,
): Promise<void> {
  if (scrapedChapters.length === 0) return;

  if (lifecycle) lifecycle.currentStep = "enriching_metadata";

  const uniqueTitleKeys = [
    ...new Set(
      scrapedChapters.map(
        (ch: ChapterItem & { titleKey?: string }) => ch.titleKey,
      ),
    ),
  ];
  const metadataMap = new Map();

  // Load cached metadata from Supabase
  const cachedResults = await batchGetMangaMetadata(
    uniqueTitleKeys.filter((tk): tk is string => !!tk),
  );
  cachedResults.forEach((meta, i) => {
    if (meta) metadataMap.set(uniqueTitleKeys[i], meta);
  });

  // OPTIMIZATION: If QStash is enabled, we usually skip synchronous enrichment
  // to save time. However, for a small number of items (e.g. new manga),
  // we allow a tiny batch of sync fetches so the first notification isn't "Unknown".
  const isQStash = process.env.QSTASH_ENABLED === "true";
  const skipSyncEnrichment = isQStash && !force;

  const maxSyncFetches = skipSyncEnrichment ? 15 : 40;

  const enrichmentStats = await enrichChaptersMetadata(
    scrapedChapters,
    metadataMap,
    {
      maxFetches: maxSyncFetches,
      deadline,
      safetyMarginMs: scrapeSafetyMarginMs / 2,
    },
  );

  logger?.info(
    {
      cached: enrichmentStats.cached,
      fetched: enrichmentStats.fetched,
      failed: enrichmentStats.failed,
      skipped: enrichmentStats.skipped,
      durationMs: enrichmentStats.durationMs,
    },
    "Metadata enrichment stats",
  );

  // Apply metadata to chapters
  applyMetadataToChapters(scrapedChapters, metadataMap);

  // Sort chapters by time, title, and chapter number
  const sortedChapters = sortChapters(scrapedChapters, getChapterNumber, safeParseDate);
  scrapedChapters.length = 0;
  scrapedChapters.push(...sortedChapters);
}
