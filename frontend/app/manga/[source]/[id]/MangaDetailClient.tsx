"use client";

import Link from "next/link";
import { MangaDetail } from "@/lib/api";
import { DetailHero } from "./DetailHero";
import { ChapterList } from "./ChapterList";
import { Serupa } from "./Serupa";
import { ContinueReadingCTA } from "./ContinueReadingCTA";
import { useMangaDetail } from "./useMangaDetail";

function Skeleton() {
  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-10">
      <div className="w-36 md:w-48 shrink-0 mx-auto md:mx-0">
        <div className="skeleton w-full aspect-3/4 rounded-lg" />
      </div>
      <div className="flex-1 min-w-0 pt-2">
        <div className="skeleton h-8 w-3/4 mb-3 rounded" />
        <div className="skeleton h-4 w-24 mb-4 rounded" />
        <div className="flex gap-2 mb-4">
          <div className="skeleton h-5 w-14 rounded" />
          <div className="skeleton h-5 w-16 rounded" />
          <div className="skeleton h-5 w-12 rounded" />
        </div>
        <div className="skeleton h-4 w-full mb-1.5 rounded" />
        <div className="skeleton h-4 w-5/6 mb-1.5 rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
      </div>
    </div>
  );
}

export function MangaDetailClient({ initialData }: { initialData?: MangaDetail }) {
  const h = useMangaDetail({ initialData });

  if (h.errorMsg) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-lg font-semibold mb-2">Manga tidak ditemukan</h1>
        <p className="text-sm text-text-muted mb-4">{h.errorMsg}</p>
        <Link
          href="/"
          className="text-[13px] text-accent hover:text-accent-hover transition-colors"
        >
          &larr; Kembali ke beranda
        </Link>
      </div>
    );
  }

  if (!h.manga) {
    return (
      <div className="min-h-[60vh]">
        <Skeleton />
      </div>
    );
  }

  return (
    <div>
      <DetailHero
        manga={h.manga}
        id={h.id}
        fav={h.fav}
        setFav={h.setFav}
        descExpanded={h.descExpanded}
        setDescExpanded={h.setDescExpanded}
      />

      <ChapterList
        source={h.source}
        id={h.id}
        mangaTitle={h.manga.title}
        mangaCover={h.manga.cover}
        mangaSource={h.manga.source}
        mangaUrl={h.manga.url}
        filteredChapters={h.filteredChapters}
        sortedChapters={h.sortedChapters}
        lastRead={h.lastRead}
        chapterSearch={h.chapterSearch}
        setChapterSearch={h.setChapterSearch}
        chapterSort={h.chapterSort}
        setChapterSort={h.setChapterSort}
        chapterPage={h.chapterPage}
        setChapterPage={h.setChapterPage}
        chapterJump={h.chapterJump}
        setChapterJump={h.setChapterJump}
        jumpError={h.jumpError}
        setJumpError={h.setJumpError}
        readChapters={h.readChapters}
        setReadChapters={h.setReadChapters}
        showAllChapters={h.showAllChapters}
        setShowAllChapters={h.setShowAllChapters}
      />

      <Serupa recommendations={h.recommendations} />

      <ContinueReadingCTA
        continueReading={h.continueReading}
        source={h.source}
        id={h.id}
      />
    </div>
  );
}
