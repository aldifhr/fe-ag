import {
  loadWhitelist,
  saveWhitelist,
} from "./storage.js";
import { enrichSingleMangaMetadata } from "./metadata-enrichment.js";
import {
  DISCORD_COMPONENT_TYPE,
  DISCORD_BUTTON_STYLE,
} from "../config.js";
import {
  inferSourceFromUrl,
  normalizeSource,
  normalizeSourceUrl,
  sourceLabel,
  MARK_REASON_LABELS,
  normalizeMarkReason,
  fuzzyTitleSimilarity,
  isSameNormalizedTitle,
  normalizeTitleKey,
} from "../domain.js";
import { getLogger } from "../logger.js";
import { WhitelistEntry } from "../types.js";

const logger = getLogger({ scope: "whitelist" });

/** ==========================================
 * WHITELIST ENGINE AND DATA MANAGEMENT
 * ========================================== */

export function findWhitelistEntryIndex(
  items: WhitelistEntry[],
  { title, url = null }: { title?: string; url?: string | null } = {},
) {
  const normalizedTitle = String(title || "").trim();
  const normalizedUrl = url ? normalizeSourceUrl(url) : null;
  if (!normalizedTitle && !normalizedUrl) return -1;

  return items.findIndex((item) => {
    if (
      normalizedTitle &&
      item.title?.toLowerCase() === normalizedTitle.toLowerCase()
    )
      return true;
    if (
      normalizedUrl &&
      item.sources?.some(
        (s) => normalizeSourceUrl(s.url || "") === normalizedUrl,
      )
    )
      return true;
    return false;
  });
}

export type WhitelistQueryResult =
  | { status: "not_found"; totalCount?: number }
  | { status: "ambiguous"; matches: { item: WhitelistEntry; index: number }[]; suggested?: boolean }
  | { status: "matched"; index: number; item: WhitelistEntry; suggested?: boolean };


// --- Search Helpers ---

function findNumericMatch(items: WhitelistEntry[], query: string): number {
  const num = Number.parseInt(query, 10);
  if (Number.isInteger(num) && num >= 1 && num <= items.length) {
    return num - 1;
  }
  return -1;
}

function findExactMatches(items: WhitelistEntry[], query: string) {
  const queryKey = normalizeTitleKey(query);
  const queryCompact = queryKey.replace(/\s+/g, "");

  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (!item.title) return false;
      if (isSameNormalizedTitle(item.title, query)) return true;
      const itemCompact = normalizeTitleKey(item.title).replace(/\s+/g, "");
      return itemCompact === queryCompact;
    });
}

function findPartialMatches(items: WhitelistEntry[], query: string) {
  const queryKey = normalizeTitleKey(query);
  const queryCompact = queryKey.replace(/\s+/g, "");

  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const itemKey = normalizeTitleKey(item.title);
      return itemKey.includes(queryKey) || itemKey.replace(/\s+/g, "").includes(queryCompact);
    });
}

function findFuzzyMatches(items: WhitelistEntry[], query: string) {
  return items
    .map((item, index) => ({
      item,
      index,
      score: fuzzyTitleSimilarity(item.title, query),
    }))
    .filter((res) => res.score > 0.55)
    .sort((a, b) => b.score - a.score);
}

// --- Main Resolver ---

export function resolveWhitelistQuery(
  items: WhitelistEntry[],
  query: string,
): WhitelistQueryResult {
  const trimmedQuery = String(query || "").trim();
  if (!trimmedQuery) throw new Error("Query required");

  const list = Array.isArray(items) ? items : [];

  // 1. Numeric Match
  const numericIndex = findNumericMatch(list, trimmedQuery);
  if (numericIndex !== -1) return { status: "matched", index: numericIndex, item: list[numericIndex] };

  // 2. Exact/Normalized Match
  const exact = findExactMatches(list, trimmedQuery);
  if (exact.length > 1) return { status: "ambiguous", matches: exact };
  if (exact.length === 1) return { status: "matched", index: exact[0].index, item: exact[0].item };

  // 3. Partial Match
  const partial = findPartialMatches(list, trimmedQuery);
  if (partial.length > 1) return { status: "ambiguous", matches: partial, suggested: true };
  if (partial.length === 1) return { status: "matched", index: partial[0].index, item: partial[0].item, suggested: true };

  // 4. Fuzzy Match
  const fuzzy = findFuzzyMatches(list, trimmedQuery);
  if (fuzzy.length > 1) {
    if (fuzzy[0].score > fuzzy[1].score + 0.1) {
      return { status: "matched", index: fuzzy[0].index, item: fuzzy[0].item, suggested: true };
    }
    return {
      status: "ambiguous",
      suggested: true,
      matches: fuzzy.slice(0, 5).map(f => ({ item: f.item, index: f.index })),
    };
  }
  if (fuzzy.length === 1) return { status: "matched", index: fuzzy[0].index, item: fuzzy[0].item, suggested: true };

  return { status: "not_found", totalCount: list.length };
}

export function resolveWhitelistSource({
  url = null,
  source = "ikiru",
}: {
  url?: string | null;
  source?: string;
} = {}) {
  const normalizedSource = normalizeSource(source);
  const normalizedUrl = url ? normalizeSourceUrl(url) : undefined;
  const inferredSource = inferSourceFromUrl(normalizedUrl);

  if (inferredSource === "ikiru") return "ikiru";
  if (normalizedSource === "shinigami") return "shinigami";
  return inferredSource || normalizedSource;
}

async function persistWhitelistItems(
  items: WhitelistEntry[],
  { saveWhitelistFn = saveWhitelist }: { saveWhitelistFn?: typeof saveWhitelist } = {},
) {
  await saveWhitelistFn(items);
}

export async function addWhitelistEntry(
  { title, url = null, source = "ikiru" }: { title: string; url?: string | null; source?: string },
  {
    loadWhitelistFn = loadWhitelist,
    saveWhitelistFn = saveWhitelist,
  }: {
    loadWhitelistFn?: typeof loadWhitelist;
    saveWhitelistFn?: typeof saveWhitelist;
  } = {},
): Promise<{ 
  status: string; 
  whitelist: WhitelistEntry[]; 
  source: string; 
  title: string;
  enrichmentPromise?: Promise<any>;
}> {
  const normalizedTitle = String(title || "").trim();
  const normalizedUrl = url ? normalizeSourceUrl(url) : null;
  const effectiveSource = resolveWhitelistSource({
    url: normalizedUrl,
    source,
  });
  const titleKey = normalizeTitleKey(normalizedTitle);

  const whitelist = await loadWhitelistFn();

  const existingIndex = findWhitelistEntryIndex(whitelist, {
    title: normalizedTitle,
    url: normalizedUrl,
  });
  let fuzzyExisting: WhitelistEntry | null = null;

  if (existingIndex === -1 && !normalizedUrl) {
    for (const item of whitelist) {
      if (fuzzyTitleSimilarity(item.title, normalizedTitle) >= 0.8) {
        fuzzyExisting = item;
        break;
      }
    }
  }

  const activeIndex =
    existingIndex !== -1
      ? existingIndex
      : fuzzyExisting
        ? whitelist.indexOf(fuzzyExisting)
        : -1;

  if (activeIndex !== -1) {
    const existing = whitelist[activeIndex];

    // Prevent duplicate URLs even if source name is different (e.g. was 'ikiru')
    const sameUrlSource = (existing.sources || []).find(
      (s) => normalizedUrl && normalizeSourceUrl(s.url || "") === normalizedUrl
    );

    if (sameUrlSource) {
      if (normalizeSource(sameUrlSource.source) === effectiveSource) {
        return { status: "exists", whitelist, source: effectiveSource, title: normalizedTitle };
      }
      
      sameUrlSource.source = effectiveSource;
      await persistWhitelistItems(whitelist, { saveWhitelistFn });
      return { status: "added", whitelist, source: effectiveSource, title: normalizedTitle };
    }

    const hasSource = (existing.sources || []).some(
      (s) => normalizeSource(s.source) === effectiveSource && !s.url && !normalizedUrl
    );

    if (hasSource) {
      return {
        status: "exists",
        whitelist,
        source: effectiveSource,
        title: normalizedTitle,
      };
    }

    existing.sources = existing.sources || [];
    existing.sources.push({
      url: url ?? null,
      source: effectiveSource,
      mark: null,
    });

    await persistWhitelistItems(whitelist, { saveWhitelistFn });
    return {
      status: "added",
      whitelist,
      source: effectiveSource,
      title: normalizedTitle,
    };
  }

  whitelist.push({
    title: normalizedTitle,
    sources: [{ url: url ?? null, source: effectiveSource, mark: null }],
  });
  await persistWhitelistItems(whitelist, { saveWhitelistFn });

  let enrichmentPromise: Promise<any> | undefined;

  // TRIGGER BACKGROUND METADATA ENRICHMENT
  if (normalizedUrl && effectiveSource) {
    enrichmentPromise = enrichSingleMangaMetadata(
      titleKey,
      normalizedTitle,
      effectiveSource,
      normalizedUrl
    );
  }

  return {
    status: "added",
    whitelist,
    source: effectiveSource,
    title: normalizedTitle,
    enrichmentPromise
  };
}

export async function removeWhitelistEntry(
  query: string,
  {
    loadWhitelistFn = loadWhitelist,
    saveWhitelistFn = saveWhitelist,
  }: {
    loadWhitelistFn?: typeof loadWhitelist;
    saveWhitelistFn?: typeof saveWhitelist;
  } = {},
) {
  const items = await loadWhitelistFn();
  const trimmed = String(query || "").trim();

  if (/^https?:\/\//i.test(trimmed)) {
    const normUrl = normalizeSourceUrl(trimmed);
    const index = items.findIndex((item) =>
      item.sources?.some((s) => normalizeSourceUrl(s.url || "") === normUrl),
    );

    if (index !== -1) {
      const item = items[index];
      const sourceIndex = item.sources.findIndex(
        (s) => normalizeSourceUrl(s.url || "") === normUrl,
      );
      const removedSource = item.sources[sourceIndex];

      item.sources.splice(sourceIndex, 1);

      let removedEntirely = false;
      if (item.sources.length === 0) {
        items.splice(index, 1);
        removedEntirely = true;
      }

      await persistWhitelistItems(items, { saveWhitelistFn });
      return {
        status: "removed_source",
        items,
        item,
        removedSource,
        removedEntirely,
      };
    }
  }

  const resolved = resolveWhitelistQuery(items, trimmed);
  if (resolved.status === "ambiguous")
    return { status: "ambiguous", items, matches: resolved.matches };
  if (resolved.status === "not_found") return { status: "not_found", items };

  const removedItem = items[resolved.index];
  items.splice(resolved.index, 1);

  await persistWhitelistItems(items, { saveWhitelistFn });

  return { status: "removed", items, item: removedItem };
}

export async function removeWhitelistEntryIdentity(
  { title, source = null, url = null }: { title: string; source?: string | null; url?: string | null },
  {
    loadWhitelistFn = loadWhitelist,
    saveWhitelistFn = saveWhitelist,
  }: {
    loadWhitelistFn?: typeof loadWhitelist;
    saveWhitelistFn?: typeof saveWhitelist;
  } = {},
) {
  const items = await loadWhitelistFn();
  const normalizedTitle = normalizeTitleKey(String(title || "").trim());

  const index = items.findIndex(
    (item) => normalizeTitleKey(item.title) === normalizedTitle,
  );
  if (index === -1) return { status: "not_found", items };

  const item = items[index];

  if (url) {
    const normUrl = normalizeSourceUrl(url);
    const sourceIndex =
      item.sources?.findIndex(
        (s) => normalizeSourceUrl(s.url || "") === normUrl,
      ) ?? -1;
    if (sourceIndex === -1) return { status: "not_found", items };

    const removedSource = item.sources[sourceIndex];
    item.sources.splice(sourceIndex, 1);

    let removedEntirely = false;
    if (!item.sources.length) {
      items.splice(index, 1);
      removedEntirely = true;
    }

    await persistWhitelistItems(items, { saveWhitelistFn });
    return {
      status: "removed_source",
      items,
      item,
      removedSource,
      removedEntirely,
    };
  }

  if (source) {
    const normSource = normalizeSource(source);
    const sourceIndex =
      item.sources?.findIndex(
        (s) => normalizeSource(s.source || "") === normSource,
      ) ?? -1;
    if (sourceIndex === -1) return { status: "not_found", items };

    const removedSource = item.sources[sourceIndex];
    item.sources.splice(sourceIndex, 1);

    let removedEntirely = false;
    if (!item.sources.length) {
      items.splice(index, 1);
      removedEntirely = true;
    }

    await persistWhitelistItems(items, { saveWhitelistFn });
    return {
      status: "removed_source",
      items,
      item,
      removedSource,
      removedEntirely,
    };
  }

  const removedItem = items.splice(index, 1)[0];

  await persistWhitelistItems(items, { saveWhitelistFn });

  return { status: "removed", items, item: removedItem };
}

export async function clearWhitelist() {
  const items = await loadWhitelist();
  await persistWhitelistItems([]);
  return { status: "cleared", count: items.length };
}

export async function markWhitelistEntry(
  query: string,
  reason: string | null,
  {
    loadWhitelistFn = loadWhitelist,
    saveWhitelistFn = saveWhitelist,
  }: {
    loadWhitelistFn?: typeof loadWhitelist;
    saveWhitelistFn?: typeof saveWhitelist;
  } = {},
) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) throw new Error("Query required");

  const normalizedReason = normalizeMarkReason(reason);
  const items = await loadWhitelistFn();
  const resolved = resolveWhitelistQuery(items, normalizedQuery);

  if (resolved.status === "ambiguous")
    return { status: "ambiguous", items, matches: resolved.matches };
  if (resolved.status === "not_found") return { status: "not_found", items };

  const item = items[resolved.index];
  if (item.sources)
    item.sources.forEach((s) => {
      s.mark = normalizedReason;
    });

  await persistWhitelistItems(items, { saveWhitelistFn });
  return {
    status: "updated",
    items,
    item: items[resolved.index],
    reason: normalizedReason,
  };
}

/** ==========================================
 * UI AND DISCORD PRESENTATION
 * ========================================== */

function formatRelativeIndo(isoString: string | null) {
  if (!isoString) return { text: null, isHibernating: false };
  const date = new Date(isoString);
  const diffMs = new Date().getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  let text;
  if (diffDay > 0) text = `${diffDay} days ago`;
  else if (diffHour > 0) text = `${diffHour} hours ago`;
  else if (diffMin > 0) text = `${diffMin} minutes ago`;
  else text = "Just now";

  return { text, isHibernating: diffDay >= 14 };
}

export function formatMarkedTitle(item: any) {
  const title = String(item?.title || "").trim();
  const reason = normalizeMarkReason(item?.mark || item?.sources?.[0]?.mark);
  if (!reason) return title;
  return `${title} [${MARK_REASON_LABELS[reason] || reason}]`;
}

export async function buildWhitelistListResponse(
  page = 1,
  pageSize = 10,
  { search = null, filter = null }: { search?: string | null; filter?: string | null } = {},
) {
  let whitelist = await loadWhitelist();

  if (search)
    whitelist = whitelist.filter((item) =>
      item.title?.toLowerCase().includes(search.toLowerCase()),
    );
  if (filter)
    whitelist = whitelist.filter((item) =>
      item.sources?.some((s) => s.mark === filter?.toLowerCase()),
    );

  const totalPage = Math.ceil(whitelist.length / pageSize) || 1;
  const safePage = Math.min(Math.max(1, page), totalPage);
  const start = (safePage - 1) * pageSize;
  const slice = whitelist.slice(start, start + pageSize);

  // Redis removed; update times no longer available
  const updateTimes: (string | null)[] = slice.map(() => null);

  const lines = slice.map((item, i) => {
    const sourceIcons = (item.sources || [])
      .map((s) => `[${sourceLabel(s.source)}]`)
      .join(" ");
    const { text, isHibernating } = formatRelativeIndo(updateTimes[i] as string);
    return `${start + i + 1}. **${formatMarkedTitle(item)}**${isHibernating ? " 💤" : ""} ${sourceIcons}${text ? ` _(Update: ${text})_` : ""}`;
  });

  const content =
    whitelist.length === 0
      ? `Whitelist kosong.`
      : `📚 **Daftar Whitelist (${whitelist.length})**${search ? ` | Cari: "${search}"` : ""}${filter ? ` | Status: ${MARK_REASON_LABELS[filter] || filter}` : ""}\n*Halaman ${safePage}/${totalPage}*\n\n${lines.join("\n")}`;

  const components =
    whitelist.length === 0
      ? []
      : [
        {
          type: DISCORD_COMPONENT_TYPE.ACTION_ROW,
          components: [
            {
              type: DISCORD_COMPONENT_TYPE.BUTTON,
              style: DISCORD_BUTTON_STYLE.PRIMARY,
              label: "Previous",
              custom_id: `list:${safePage - 1}${search ? `:${search.slice(0, 30)}` : ""}${filter ? `|${filter.slice(0, 20)}` : ""}`,
              disabled: safePage <= 1,
            },
            {
              type: DISCORD_COMPONENT_TYPE.BUTTON,
              style: DISCORD_BUTTON_STYLE.SECONDARY,
              label: `Hal ${safePage}`,
              custom_id: "noop",
              disabled: true,
            },
            {
              type: DISCORD_COMPONENT_TYPE.BUTTON,
              style: DISCORD_BUTTON_STYLE.PRIMARY,
              label: "Next",
              custom_id: `list:${safePage + 1}${search ? `:${search.slice(0, 30)}` : ""}${filter ? `|${filter.slice(0, 20)}` : ""}`,
              disabled: safePage >= totalPage,
            },
          ],
        },
      ];

  return { content, components, items: whitelist };
}

export function buildAddSuccessMessage({ title, source, total }: { title: string; source: string; total: number }) {
  return `Berhasil menambah **${title}** dari **${sourceLabel(source)}**.\nTotal Whitelist: **${total}**`;
}

export function buildAddExistsMessage({ title, source }: { title: string; source: string }) {
  return `**${title}** sudah ada di whitelist dari sumber **${sourceLabel(source)}**.`;
}
