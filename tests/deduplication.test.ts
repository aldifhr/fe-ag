import { describe, it, expect, vi } from "vitest";
import { prepareDispatchQueue } from "../lib/services/dispatch/deduplication.js";
import type { ChapterItem } from "../lib/types/index.js";

// Mock Supabase to avoid network timeout
vi.mock("../lib/supabase.js", () => ({
  supabase: {
    rpc: async () => ({ data: null, error: null }),
    from: (table: string) => ({
      select: () => ({
        in: async () => {
          if (table === "title_last_chapters") {
            return { data: [{ title_key: "test manga", chapter_number: 10 }], error: null };
          }
          return { data: [], error: null };
        },
        order: () => ({ limit: async () => ({ data: [], error: null }) }),
      }),
      upsert: async () => ({ error: null }),
    }),
  },
}));

describe("Deduplication Logic", () => {
  it("should select the preferred (earlier) version for duplicates", async () => {
    const now = new Date();
    const chapters: ChapterItem[] = [
      {
        title: "Test Manga",
        titleKey: "test manga",
        chapter: "Chapter 12",
        url: "https://ikiru.wtf/manga/test-manga-12",
        updatedTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        source: "ikiru",
      },
      {
        title: "Test Manga (Official)",
        titleKey: "test manga",
        chapter: "Chapter 12",
        url: "https://shinigami.asia/manga/test-manga-12",
        updatedTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        source: "shinigami",
      },
    ];

    const result = await prepareDispatchQueue(chapters);
    expect(result.queuedMeta.length).toBe(1);
    expect(result.queuedMeta[0].item.source).toBe("shinigami");
  });

  it("should filter out chapters older or equal to last dispatched chapter", async () => {
    const now = new Date();
    const chapters: ChapterItem[] = [
      {
        title: "Test Manga",
        titleKey: "test manga",
        chapter: "Chapter 9",
        url: "https://ikiru.wtf/manga/test-manga-9",
        updatedTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        source: "ikiru",
      },
      {
        title: "Test Manga",
        titleKey: "test manga",
        chapter: "Chapter 11",
        url: "https://ikiru.wtf/manga/test-manga-11",
        updatedTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        source: "ikiru",
      },
    ];

    const result = await prepareDispatchQueue(chapters);
    expect(result.queuedMeta.length).toBe(1);
    expect(result.queuedMeta[0].item.chapter).toBe("Chapter 11");
  });
});
