import { HomeClient } from "./HomeClient";
import type { SearchResult, Genre } from "@/lib/api";

async function fetchServerData() {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BACKEND_URL || "http://localhost:3001";

  try {
    const [latestRes, genresRes] = await Promise.all([
      fetch(`${base}/api/reader/latest?source=all&page=1&sort=latest`, {
        signal: AbortSignal.timeout(15000),
      }),
      fetch(`${base}/api/reader/genres`, {
        signal: AbortSignal.timeout(15000),
      }),
    ]);

    const [latest, genres] = await Promise.all([
      latestRes.ok ? latestRes.json() : null,
      genresRes.ok ? genresRes.json() : null,
    ]);

    return {
      initialLatest: (latest?.results ?? null) as SearchResult[] | null,
      initialGenres: (genres?.genres ?? null) as Genre[] | null,
    };
  } catch {
    return { initialLatest: null, initialGenres: null };
  }
}

export default async function HomePage() {
  const { initialLatest, initialGenres } = await fetchServerData();
  return (
    <HomeClient
      initialLatest={initialLatest ?? undefined}
      initialGenres={initialGenres ?? undefined}
    />
  );
}
