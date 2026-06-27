"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getChapterPages } from "@/lib/api";
import Link from "next/link";

export default function ReaderPage() {
  const params = useParams<{ source: string; id: string; chapterNum: string }>();
  const searchParams = useSearchParams();
  const source = params.source;
  const id = decodeURIComponent(params.id);
  const chapterNum = params.chapterNum;
  const baseUrl = searchParams.get("baseUrl") || "";

  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fitMode, setFitMode] = useState<"width" | "height">("width");

  useEffect(() => {
    let cancelled = false;

    async function fetchPages() {
      setLoading(true);
      setError(null);

      try {
        let chapterUrl = "";
        if (source === "ikiru") {
          chapterUrl = id;
        } else if (baseUrl) {
          chapterUrl = `${baseUrl.replace(/\/$/, "")}/chapter-${chapterNum}`;
        } else {
          chapterUrl = `https://shinigami.asia/manga/${id.split("/").pop()}/chapter-${chapterNum}`;
        }

        const data = await getChapterPages(chapterUrl);
        if (!cancelled) {
          setImages(data.images);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load chapter");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPages();
    return () => { cancelled = true; };
  }, [source, id, chapterNum, baseUrl]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link
          href={`/manga/${source}/${encodeURIComponent(id)}`}
          className="text-sm text-(--accent) hover:underline"
        >
          &larr; Back
        </Link>
        <button
          onClick={() => setFitMode(fitMode === "width" ? "height" : "width")}
          className="text-xs px-3 py-1 rounded bg-(--card) border border-(--border) text-(--muted)"
        >
          Fit {fitMode === "width" ? "height" : "width"}
        </button>
      </div>

      <h1 className="text-lg font-bold mb-4 text-center">Chapter {chapterNum}</h1>

      {loading && <p className="text-(--muted) text-center py-12">Loading...</p>}

      {error && (
        <div className="text-center py-12">
          <p className="text-red-400 mb-2">Gagal: {error}</p>
          <p className="text-sm text-(--muted)">Coba buka manual: {baseUrl}/chapter-{chapterNum}</p>
        </div>
      )}

      {!loading && !error && images.length === 0 && (
        <p className="text-(--muted) text-center py-12">
          No images found. Site mungkin block scraper atau URL salah.
        </p>
      )}

      <div className="flex flex-col items-center gap-4">
        {images.map((src, i) => (
          <div key={i} className="w-full max-w-4xl">
            <p className="text-xs text-(--muted) text-center mb-1">
              Page {i + 1} / {images.length}
            </p>
            <img
              src={src}
              alt={`Page ${i + 1}`}
              className="rounded-lg"
              style={{ width: fitMode === "width" ? "100%" : "auto", height: fitMode === "height" ? "100vh" : "auto" }}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
