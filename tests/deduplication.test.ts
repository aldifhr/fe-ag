import { describe, it, expect, vi } from "vitest";
import { prepareDispatchQueue } from "../lib/services/dispatch/deduplication.js";
import { RedisClient, ChapterItem } from "../lib/types/index.js";

// Mock Supabase to avoid network timeout in unit tests
vi.mock("../lib/supabase.js", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: async () => ({ data: [], error: null })
      })
    })
  }
}));

// Mock minimal Redis Client
const mockRedis = {
  pipeline: () => ({
    hmget: () => {},
    exec: async () => {
      return [
        [], // DISPATCH_HISTORY_KEY for primary keys (not dispatched yet)
        [], // DISPATCH_HISTORY_KEY for duplicate keys
        ["10"], // MANGA_LAST_CHAPTERS_KEY (last dispatched is chapter 10)
        []  // MANGA_LAST_UPDATES_KEY
      ];
    }
  }),
  hmget: async () => []
} as unknown as RedisClient;

describe("Deduplication Logic", () => {
  it("should select the preferred (earlier) version for duplicates", async () => {
    const now = new Date();
    const chapters: ChapterItem[] = [
      {
        title: "Test Manga",
        titleKey: "test manga",
        chapter: "Chapter 12",
        url: "https://ikiru.wtf/manga/test-manga-12",
        updatedTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 min ago
        source: "ikiru"
      },
      {
        title: "Test Manga (Official)",
        titleKey: "test manga",
        chapter: "Chapter 12",
        url: "https://shinigami.asia/manga/test-manga-12",
        updatedTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), // 1 hour ago (earlier)
        source: "shinigami"
      }
    ];

    const result = await prepareDispatchQueue(mockRedis, chapters);
    expect(result.queuedMeta.length).toBe(1);
    
    // The earlier updated time (shinigami) should be preferred (wins the source war)
    expect(result.queuedMeta[0].item.source).toBe("shinigami");
  });

  it("should filter out chapters older or equal to last dispatched chapter", async () => {
    const now = new Date();
    const chapters: ChapterItem[] = [
      {
        title: "Test Manga",
        titleKey: "test manga",
        chapter: "Chapter 9", // <= 10 (last dispatched)
        url: "https://ikiru.wtf/manga/test-manga-9",
        updatedTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 min ago
        source: "ikiru"
      },
      {
        title: "Test Manga",
        titleKey: "test manga",
        chapter: "Chapter 11", // > 10
        url: "https://ikiru.wtf/manga/test-manga-11",
        updatedTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 min ago
        source: "ikiru"
      }
    ];

    const result = await prepareDispatchQueue(mockRedis, chapters);
    expect(result.queuedMeta.length).toBe(1);
    expect(result.queuedMeta[0].item.chapter).toBe("Chapter 11");
  });
});
