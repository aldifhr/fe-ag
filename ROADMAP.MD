# Code Optimization Roadmap

> Auto-generated audit. Sorted LOW → HIGH. Last updated: 2026-06-28

---

## LOW Priority

### Frontend

| # | Issue | File | Fix |
|---|-------|------|-----|
| L1 | `toggleFav` uses `stopImmediatePropagation` (overly aggressive) | `MangaCard.tsx:69` | Replace with `stopPropagation()` |
| L2 | ~30 lines commented-out Clerk auth code | `Nav.tsx:142-163, 347-369` | Delete, add one-line comment |
| L3 | `timeAgo` double-converts timestamps (string→Date→getTime) | `page.tsx:710` | Unify time type to number or string |
| L4 | Status normalization duplicated in page.tsx list view vs MangaCard | `page.tsx:679-695` | Extract `normalizeStatus()` utility |
| L5 | `new Date().toISOString()` called in render loop (always same value) | `stats/page.tsx:190` | Compute once before map |
| L6 | Reader images alt text is generic "Halaman N" | `reader page:1060, 1133` | Acceptable for now |
| L7 | Login page error state doesn't clear on new input | `login/page.tsx:14` | Add `onChange={() => setError("")}` |
| L8 | Reader page has no `<title>` / metadata | `reader page` | Set `document.title` via useEffect |
| L9 | Cover image height inconsistency in history page | `history/page.tsx:301 vs 309` | Match dimensions |
| L10 | `cleanDescription` called twice in MangaDetailClient | `MangaDetailClient.tsx:430, 432` | Compute once, reuse |
| L11 | `getStoredMeta` re-created + reads localStorage every render | `reader page:42-56` | Move to useMemo/useState init |
| L12 | Latest page lacks SEO metadata (`document.title` in useEffect only) | `latest/page.tsx:45` | Add generateMetadata or accept client-only |

### Backend

| # | Issue | File | Fix |
|---|-------|------|-----|
| L25 | CORS allows PUT/DELETE but API only uses GET/POST | `index.ts:90` | Narrow methods |
| L26 | Correlation ID middleware runs on static file responses | `index.ts:103-111` | Move static serving above middleware |
| L27 | `AdaptiveConcurrencyLimiter` counter halving creates slow drift | `optimizer.ts:271-275` | Use sliding window |
| L28 | Duplicate `// Required` comment in env.ts | `env.ts:5-6` | Remove duplicate |
| L29 | `normalizeText` uses stale `spaces` count after transformation | `shared.ts:196-215` | Recalculate after transform |
| L30 | `"links"` action in cronQuerySchema is dead (no handler) | `schemas.ts:7` | Remove from enum |
| L31 | `IkiruProvider.search` ignores `options` parameter | `ikiru/index.ts:195-197` | Forward or remove |
| L32 | Hardcoded Discord admin channel ID | `cron.ts:26` | Move to env config |
| L33 | Error fallback in orchestrator hardcodes `ikiru`/`shinigami` keys | `orchestrator.ts:494-502` | Use `providers.map(p => p.id)` |
| L34 | Scrapling bridge truncates URLs inconsistently | `scrapling-bridge.ts:65` | Consistent truncation |
| L35 | `TrackedError` interface defined but never used | `index.ts:20-23` | Remove |
| L36 | `tryFetchPages` parses arbitrary HTML with no size guard | `reader.ts:277-336` | Add maxContentLength check |
| L37 | `MangaProvider.getMetrics()` return type has unused fields | `base.ts:63-68` | Match actual implementation |
| L38 | `scrapeUpdates` shadows module logger from options destructure | `ikiru.ts:119` | Use or remove |

---

## MEDIUM Priority

### Frontend

| # | Issue | File | Fix |
|---|-------|------|-----|
| M1 | `items` array + sort recreated every render (no useMemo) | `page.tsx:153-157` | Wrap in `useMemo([initialData, extraItems, sort])` |
| M2 | Leaderboard fires all 3 queries regardless of active tab | `leaderboard/page.tsx:28-44` | Add `enabled: activeTab === "..."` |
| M3 | MangaCard not memoized — used in large lists, re-renders cascade | `MangaCard.tsx` | Wrap with `React.memo` |
| M4 | Search page duplicate history loading (mount + debouncedQuery) | `search/page.tsx:140-150` | Remove redundant mount effect |
| M5 | Suggestion fetch wasted when full search fires 100ms later | `search/page.tsx:110-130` | Only fetch suggestions when query < 2 chars |
| M6 | Infinite scroll pattern duplicated across Home + Latest pages | `page.tsx:173-198`, `latest/page.tsx:73-98` | Extract `useInfiniteScroll` hook or use `useInfiniteQuery` |
| M7 | Reader keyboard scroll reimplements `scrollToNextImage`/`scrollToPrevImage` | `reader page:514-537 vs 436-458` | Call existing functions from keyboard handler |
| M8 | `getMangaDetail` called twice for history recording if detail fetch is slow | `reader page:217-266` | Use ref to track in-flight fetch |
| M9 | `fadeIn` keyframe referenced but never defined in CSS | `reader page:1356, 1374, 1392` | Add `@keyframes fadeIn` to globals.css |
| M10 | Dynamic import of `getLatest` is unnecessary (already in static imports) | `MangaDetailClient.tsx:161` | Add to existing static import |
| M11 | Genre Populer section uses hardcoded slug list (breaks if renamed) | `page.tsx:332-345` | Sort by API count, take top 12 |
| M12 | ErrorView has hardcoded dark-mode colors (broken in light mode) | `ErrorView.tsx:52-143` | Replace with CSS variables |
| M13 | SearchModal has hardcoded dark-mode colors | `SearchModal.tsx:112-115, 151` | Replace with CSS variables |
| M14 | Server-side fetch not passed to client (duplicate fetch) | `manga/[source]/[id]/page.tsx:4-19, 54-56` | Pass server data as initialData prop |
| M15 | Stats page has no `<title>` metadata | `stats/page.tsx` | Add generateMetadata or document.title |
| M16 | Homepage entirely "use client" (misses SSR opportunity) | `page.tsx:1` | Split to server component + HomeClient |
| M17 | SkeletonGrid copy-pasted across 4+ files | `page.tsx`, `latest/`, `search/`, `genres/[slug]/` | Extract shared SkeletonGrid component |

### Backend

| # | Issue | File | Fix |
|---|-------|------|-----|
| B10 | Unused export: `getIkiruLatestUpdates` | `ikiru/api.ts:105-109` | Remove or wire to consumer |
| B11 | Unused export: `fetchRandomShinigamiManga` | `secondary/api.ts:218-236` | Remove |
| B12 | Duplicate `extractSlugFromUrl` implementations | `ikiru/index.ts:21` vs `scraping.ts:140` | Use shared version |
| B13 | `scrapeOptions` construction duplicated in QStash + non-QStash paths | `cron.ts:75-92, 150-167` | Extract `buildScrapeOptions(query)` |
| B14 | `r.title!` non-null assertion on optional field | `secondary/api.ts:192` | Use `r.title ?? "Unknown"` |
| B15 | `ScrapeCacheManager` TTL completely ignored — cache never expires | `optimizer.ts:125-145` | Store TTL with entry, check in `get()` |
| B16 | Test mode env Proxy re-parses Zod schema every property access | `env.ts:167-187` | Cache parsed result per test run |
| B17 | `handleRandom` assumes 50 pages exist | `reader.ts:546` | Dynamic page count or document caveat |
| B18 | `handleGenres`/`handleGenreManga` lack try/catch for non-Axios errors | `reader.ts:493-541` | Wrap in try/catch |
| B19 | Leading underscore params (`_preferredIkiru`) that ARE used | `ikiru/index.ts:55-63` | Remove underscore prefixes |
| B20 | Massive inline type annotation for `all` array in `handleLatest` | `reader.ts:45` | Extract `LatestResultItem` interface |
| B21 | `chapters.sort()` mutates in-place but looks non-mutating | `reader.ts:213` | Use `[...chapters].sort(...)` |
| B22 | `cron-task.ts` returns HTTP 200 for failed tasks | `cron-task.ts:100-101` | Return 507 with Upstash-Retry: 0 |
| B23 | `getCookie()` is async but does no async work | `shared.ts:173-176` | Make synchronous |
| B24 | `DISCORD_BOT_TOKEN` required even for reader-only mode | `env.ts:7` | Make `.optional()` |

---

## HIGH Priority

### Frontend

| # | Issue | File | Fix |
|---|-------|------|-----|
| H1 | MangaCard reads localStorage on every render (50+ cards = 50+ JSON.parse) | `MangaCard.tsx:33` | React.memo + shared favorite context or storage event |
| H2 | `SectionCard` defined inside HomePage — remounts every render | `page.tsx:215-262` | Move outside HomePage component |
| H3 | `getContinueReading()` called on every render (JSON.parse of full history) | `MangaDetailClient.tsx:70` | Wrap in useMemo or useState init |
| H4 | `getReadChapters()` re-parses full history on every chapter toggle | `MangaDetailClient.tsx:636` | Compute read status update locally |
| H5 | Reader page is 1573-line monolith with 30+ useState hooks | `reader page` | Split into ReaderToolbar, ImageStrip, PagedViewer, FloatingBubble |
| H6 | `loadedImages` Set creates new reference per image load → 50+ re-renders | `reader page:1080-1084` | Boolean `allLoaded` flag or ref + DOM toggle |
| H7 | 200+ inline anonymous functions per render (touch/wheel per image) | `reader page:928-1050` | Extract memoized ImageItem component |
| H8 | **Security**: `siteAuth.ts` hash comparison uses non-constant-time `===` | `siteAuth.ts:33` | Use `crypto.subtle.timingSafeEqual` |
| H9 | **Bug**: `descriptionFilter` regex `\b` anchors never match `<p>`/`</p>` | `descriptionFilter.ts:14-17` | Remove `\b` anchors, use simple `.replace()` |

### Backend

| # | Issue | File | Fix |
|---|-------|------|-----|
| B1 | `handleLatest` fetches Shinigami + Ikiru sequentially when `source=all` | `reader.ts:47-125` | `Promise.all` for parallel fetch |
| B2 | `handleSearch` fetches sources sequentially | `reader.ts:148-167` | `Promise.all` for parallel fetch |
| B3 | `getIkiruSeries` double-fetch when first call fails (metadata fallback re-calls same API) | `reader.ts:226-232` | Skip `fetchIkiruMetadata` if `getIkiruSeries` already failed |
| B4 | `ScrapeCacheManager.set` ignores TTL — cache never expires | `optimizer.ts:137-145` | Store TTL, check in `get()` (same as M15) |
| B5 | `initializeScrapeOptimizer` destroys existing cache state on re-init | `optimizer.ts:314-316` | Implement `reset()` method instead of object replacement |
| B6 | Dead `existingCookies` variable and branches in scrapling-bridge | `scrapling-bridge.ts:39, 55-57, 109` | Remove dead variable and references |
| B7 | `writeCronStatus` fire-and-forget with no `.catch()` | `storage.ts:33-37` | Add `.catch()` or use await+try/catch |
| B8 | `handlePages` tries URL fallbacks sequentially (slow) | `reader.ts:444-453` | `Promise.allSettled` for parallel, return first with results |
| B9 | Cover extraction logic duplicated 6+ times | `reader.ts:54,75,534,564`, `api.ts:230` | Extract `pickCover(row)` + `pickTime(row)` helpers |

---

## Execution Order (Recommended)

**Phase 1 — Quick Wins (< 30 min total, high impact)**
- H9: Fix descriptionFilter regex (bug)
- H8: Fix timing-safe comparison (security)
- H2: Move SectionCard outside HomePage
- M9: Add `@keyframes fadeIn` to globals.css
- M3: Wrap MangaCard in React.memo
- B6: Remove dead `existingCookies` code
- B23: Make `getCookie()` synchronous
- B14: Fix `r.title!` non-null assertion

**Phase 2 — Performance (1-2 hours)**
- B1+B2: Parallelize `handleLatest`/`handleSearch` with `Promise.all`
- B8: Parallelize URL fallback in `handlePages`
- H1+H3+H4: Fix localStorage read cascade (MangaCard, MangaDetailClient)
- M2: Leaderboard query gating by active tab
- B15: Fix ScrapeCacheManager TTL
- B5: Fix optimizer re-init destroying cache

**Phase 3 — Refactors (2-4 hours)**
- H5+H6+H7: Split reader page into sub-components + memoize ImageItem
- M6: Extract infinite scroll hook
- M17: Extract shared SkeletonGrid
- B9: Extract pickCover/pickTime helpers
- B13: Extract buildScrapeOptions
- M14: Pass server data as initialData to MangaDetailClient

**Phase 4 — Theme + SSR (optional, 2+ hours)**
- M12+M13: Fix hardcoded dark-mode colors in ErrorView/SearchModal
- M16: Split homepage to server component
- M11: Dynamic genre list from API
