# Modularization Plan

## File Size Audit

### Frontend (>200 lines = needs modularization)

| # | File | Lines | Priority | Reason |
|---|------|-------|----------|--------|
| 1 | `frontend/app/manga/[source]/[id]/[chapterNum]/page.tsx` | **1379** | 🔴 CRITICAL | Reader monolith — 30+ useState, zoom/drag/night/preload all in one component |
| 2 | `frontend/app/page.tsx` | **809** | 🔴 HIGH | Homepage — 6+ sections, multiple queries, infinite scroll, recommendations |
| 3 | `frontend/app/manga/[source]/[id]/MangaDetailClient.tsx` | **806** | 🔴 HIGH | Detail page — hero, chapters, recs, search, virtualization, CTA |
| 4 | `frontend/components/Nav.tsx` | **492** | 🟡 MEDIUM | Nav — desktop+mobile, dropdown, search modal, theme toggle, auth |
| 5 | `frontend/app/search/page.tsx` | **441** | 🟡 MEDIUM | Search — debounce, autocomplete, filters, history, results grid |
| 6 | `frontend/app/history/page.tsx` | **369** | 🟡 MEDIUM | History — grouped display, multi-select bulk delete |
| 7 | `frontend/components/SearchModal.tsx` | **267** | 🟢 LOW | Search overlay — mostly self-contained |
| 8 | `frontend/app/stats/page.tsx` | **244** | 🟢 LOW | Stats — computed from history, charts |
| 9 | `frontend/app/leaderboard/page.tsx` | **226** | 🟢 LOW | Leaderboard — 3 tabs, ranked lists |

### Backend (>400 lines = needs modularization)

| # | File | Lines | Priority | Reason |
|---|------|-------|----------|--------|
| 10 | `backend/api/reader.ts` | **687** | 🔴 HIGH | All reader routes in one file — 8+ handlers |
| 11 | `backend/shared/scrapers/orchestrator.ts` | **508** | 🟡 MEDIUM | Scrape orchestration + enrichment + sorting |
| 12 | `backend/shared/scrapers/shared.ts` | **379** | 🟢 LOW | Shared utils — already cohesive |

### Files Already OK (<200 lines, no action needed)

| File | Lines | Status |
|------|-------|--------|
| `frontend/components/MangaCard.tsx` | 194 | ✅ Fine |
| `frontend/lib/api.ts` | 177 | ✅ Fine |
| `frontend/lib/history.ts` | 177 | ✅ Fine |
| `frontend/components/ErrorView.tsx` | 135 | ✅ Fine |
| `frontend/app/latest/page.tsx` | 131 | ✅ Fine |
| `frontend/lib/stats.ts` | 112 | ✅ Fine |
| `frontend/app/genres/page.tsx` | 94 | ✅ Fine |
| `frontend/app/login/page.tsx` | 76 | ✅ Fine |
| `frontend/app/favorites/page.tsx` | 75 | ✅ Fine |
| All `frontend/app/api/reader/*/route.ts` | 14-30 each | ✅ Fine (thin proxies) |
| All `frontend/lib/*.ts` | 14-37 each | ✅ Fine |
| `backend/api/cron.ts` | ~300 | ✅ Fine |
| `backend/shared/schemas.ts` | ~340 | ✅ Borderline |
| `backend/shared/domain.ts` | ~360 | ✅ Borderline |

---

## Modularization Plan

### 1. Reader Page (1379 lines → 6 files)

**Current:** Single monolith with zoom, drag-scroll, night mode, preload, settings, bubble, header, bottom nav.

**Target structure:**
```
frontend/app/manga/[source]/[id]/
└── [chapterNum]/
    ├── page.tsx              ← Thin orchestrator (~200 lines) — state, effects, composition
    ├── ReaderHeader.tsx      ← Sticky header + settings panel (~150 lines)
    ├── ImageStrip.tsx        ← Image rendering + zoom/pan/drag handlers (~400 lines)
    ├── FloatingBubble.tsx    ← iOS-style assistive touch (~250 lines)
    ├── ReaderBottomNav.tsx   ← Prev/next chapter + chapter end UI (~80 lines)
    └── ReaderSkeleton.tsx    ← Loading skeleton (extracted from inline) (~20 lines)
```

**State ownership:** All state stays in `page.tsx` (orchestrator). Components receive props only.

| New File | Contains | Props from Parent |
|----------|----------|-------------------|
| `ReaderHeader.tsx` | Back button, chapter title, settings gear, settings dropdown (bg/brightness/night), keyboard hints | `chapterNum, mangaTitle, mangaHref, chromeHidden, settingsOpen, setSettingsOpen, settingsRef, bgColor, setBgColor, brightness, setBrightness, nightMode, setNightMode` |
| `ImageStrip.tsx` | Image rendering, skeleton/loader per image, retry logic, all zoom/pan/pinch/drag handlers, brightness filter | `images, loadedImages, retryKeys, brightness, bgColor, zoomLevel, zoomOrigin, zoomedImageIdx, panOffset, chromeHidden, nightMode + all refs + setters` |
| `FloatingBubble.tsx` | Draggable bubble button, expanded menu (prev/next chapter, scroll up/down, detail link) | `prevChapter, nextChapter, buildChapterUrl, scrollToNextImage, scrollToPrevImage, mangaHref, chromeHidden` |
| `ReaderBottomNav.tsx` | "Chapter X selesai", back to detail, prev/next buttons, gradient fade | `chapterNum, mangaHref, prevChapter, nextChapter, buildChapterUrl, chromeHidden` |
| `ReaderSkeleton.tsx` | Inline skeleton loader (currently `SkeletonLoader` function) | none |

---

### 2. Homepage (809 lines → 5 files)

**Current:** Single `"use client"` component with 6+ sections, 3+ queries, infinite scroll.

**Target structure:**
```
frontend/app/
├── page.tsx              ← Thin server component shell or client orchestrator (~150 lines)
├── HomeClient.tsx        ← Client orchestrator (~200 lines)
└── components/
    ├── sections/
    │   ├── SedangDibaca.tsx    ← Currently reading section (~80 lines)
    │   ├── BaruDiupdate.tsx    ← Latest updates horizontal scroll (~80 lines)
    │   ├── Populer.tsx         ← Popular section (~60 lines)
    │   ├── GenrePopuler.tsx    ← Genre pills (~50 lines)
    │   └── KamuMungkinSuka.tsx ← Recommendations (~80 lines)
    └── SectionCard.tsx         ← Reusable horizontal scroll card (already extracted)
```

**Alternative (simpler):** Keep as single client page but extract section components inline:
```
frontend/app/page.tsx             ← Orchestrator with queries (~250 lines)
frontend/components/sections/     ← Section components
```

---

### 3. MangaDetailClient (806 lines → 5 files)

**Current:** Single component with hero, chapters, recommendations, search, virtualization, CTA.

**Target structure:**
```
frontend/app/manga/[source]/[id]/
├── page.tsx               ← Server component (generateMetadata) — stays as-is (~50 lines)
├── MangaDetailClient.tsx  ← Client orchestrator (~200 lines)
├── DetailHero.tsx         ← Cover + title + info + share (~100 lines)
├── ChapterList.tsx        ← Search + filter + pagination + virtualization (~250 lines)
├── Serupa.tsx             ← Genre-based recommendations (~80 lines)
└── ContinueReadingCTA.tsx ← Floating "Lanjutkan Baca" button (~50 lines)
```

---

### 4. Nav (492 lines → 3 files)

**Current:** Desktop nav, mobile hamburger, dropdown "Lainnya", search modal trigger, theme toggle.

**Target structure:**
```
frontend/components/
├── Nav.tsx              ← Thin shell (~80 lines) — mobile/desktop switch
├── NavDesktop.tsx       ← Desktop: logo, links, dropdown, auth, theme, search (~200 lines)
├── NavMobile.tsx        ← Mobile: hamburger, menu overlay, dropdown, auth (~200 lines)
```

---

### 5. Search Page (441 lines → 3 files)

**Target structure:**
```
frontend/app/search/
├── page.tsx              ← Orchestrator (~100 lines)
├── SearchFilters.tsx     ← Sort + status + source filters (~60 lines)
├── SearchResults.tsx     ← Results grid + autocomplete (~150 lines)
└── SearchHistory.tsx     ← Recent searches display (~80 lines)
```

---

### 6. Backend Reader (687 lines → 5 files)

**Current:** All reader routes in one file — `handleLatest`, `handleSearch`, `handleManga`, `handlePages`, `handlePopular`, `handleFilters`, `handleGenres`, `handleGenreManga`, `handleRandom`, `handleHealth`, `handleDebug`.

**Target structure:**
```
backend/api/reader/
├── index.ts             ← Route switch + types (~80 lines)
├── latest.ts            ← handleLatest (~100 lines)
├── search.ts            ← handleSearch (~80 lines)
├── manga.ts             ← handleManga (~80 lines)
├── pages.ts             ← handlePages + tryFetchPages (~120 lines)
├── genres.ts            ← handleGenres + handleGenreManga (~80 lines)
└── misc.ts              ← handlePopular + handleFilters + handleRandom + handleHealth + handleDebug (~150 lines)
```

---

### 7. Backend Orchestrator (508 lines → 3 files)

**Target structure:**
```
backend/shared/scrapers/
├── orchestrator.ts          ← Core orchestration logic (~200 lines)
├── orchestrator-helpers.ts  ← Already exists — enrichment + filtering
└── orchestrator-enrich.ts   ← Metadata enrichment + deduplication (~200 lines)
```

---

## Execution Order

| Phase | Target | Est. Files Changed | Risk |
|-------|--------|-------------------|------|
| **Phase 1** | Reader page split | 7 (6 new + 1 rewrite) | HIGH — most features live here |
| **Phase 2** | MangaDetailClient split | 5 (4 new + 1 rewrite) | MEDIUM — complex chapter list logic |
| **Phase 3** | Homepage split | 6 (5 new + 1 rewrite) | LOW — mostly rendering sections |
| **Phase 4** | Nav split | 3 (2 new + 1 rewrite) | LOW — self-contained |
| **Phase 5** | Search page split | 4 (3 new + 1 rewrite) | LOW — well-isolated features |
| **Phase 6** | Backend reader split | 7 (6 new + 1 rewrite) | MEDIUM — route handler extraction |
| **Phase 7** | Backend orchestrator split | 3 (1 new + 2 modified) | LOW — already has helpers file |

---

## Guidelines

1. **Each extracted component = one responsibility** — if it needs more than ~150 lines, split further
2. **Props only, no prop drilling >2 levels** — use context for truly global state (theme, auth)
3. **Keep `"use client"` only where needed** — extracted components that need hooks/events get it; pure display doesn't
4. **No new dependencies** — this is purely structural refactoring
5. **Build must pass after each phase** — `npx tsc --noEmit` in frontend/ and backend/
6. **No behavior changes** — modularization only, zero feature regression
