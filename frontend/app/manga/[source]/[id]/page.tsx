"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getMangaDetail, MangaDetail } from "@/lib/api";
import Link from "next/link";

export default function MangaDetailPage() {
  const params = useParams<{ source: string; id: string }>();
  const source = params.source;
  const id = params.id;

  const [data, setData] = useState<MangaDetail | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let result;
        if (source === "ikiru") {
          result = await getMangaDetail("", "ikiru", decodeURIComponent(id));
        } else {
          const mangaId = id.includes("://") ? (id.match(/\/(\d+)\/?$/) || id.match(/(\d+)/))?.[1] ?? id : id;
          result = await getMangaDetail(mangaId, "shinigami");
        }
        if (!cancelled) setData(result);
      } catch (err: unknown) {
        if (!cancelled) setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [source, id]);

  if (errorMsg || !data) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-xl font-bold mb-2">{errorMsg ? "Manga not found" : "Loading..."}</h1>
        <p className="text-[var(--muted)]">{errorMsg || "Fetching manga details..."}</p>
        <a href="/" className="text-[var(--accent)] hover:underline mt-4 inline-block">&larr; Back to home</a>
      </div>
    );
  }

  const { manga, chapters } = data;

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-8 mb-10">
        <div className="w-48 shrink-0">
          {manga.cover ? (
            <img src={manga.cover} alt={manga.title} className="w-full rounded-lg shadow-lg" />
          ) : (
            <div className="w-full aspect-[3/4] bg-[var(--card)] rounded-lg flex items-center justify-center text-[var(--muted)]">
              No Cover
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold mb-2">{manga.title}</h1>
          <span className="inline-block px-2 py-0.5 text-xs rounded bg-[var(--accent)]/20 text-[var(--accent)] capitalize mb-4">
            {manga.source}
          </span>
          {manga.genres?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {[...new Set(manga.genres)].map((g, i) => (
                <span key={`${g}-${i}`} className="px-2 py-0.5 text-xs rounded bg-[var(--border)] text-[var(--muted)]">
                  {g}
                </span>
              ))}
            </div>
          )}
          {manga.status && (
            <p className="text-sm text-[var(--muted)] mb-3">Status: {manga.status}</p>
          )}
          {manga.description && (
            <p className="text-sm leading-relaxed text-[var(--muted)]">{manga.description}</p>
          )}
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Chapters</h2>
      {chapters.length === 0 ? (
        <p className="text-[var(--muted)]">No chapters available.</p>
      ) : (
        <div className="grid gap-2">
          {chapters.map((ch) => (
            <Link
              key={`${ch.id}`}
              href={`/manga/${source}/${encodeURIComponent(id)}/${ch.number}?baseUrl=${encodeURIComponent(manga.url || "")}&chapterId=${encodeURIComponent(ch.id || "")}`}
              className="flex items-center justify-between px-4 py-3 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            >
              <span className="text-sm">{ch.title}</span>
              {ch.createdAt && (
                <span className="text-xs text-[var(--muted)]">{new Date(ch.createdAt).toLocaleDateString()}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
