import { HomeClient } from "./HomeClient";
import type { SearchResult } from "@/lib/api";

async function fetchServerData() {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BACKEND_URL || "http://localhost:3001";

  try {
    const latestRes = await fetch(`${base}/api/reader/latest?source=all&page=1&sort=latest`, {
      signal: AbortSignal.timeout(15000),
    });

    const latest = latestRes.ok ? await latestRes.json() : null;

    return {
      initialLatest: (latest?.results ?? null) as SearchResult[] | null,
    };
  } catch {
    return { initialLatest: null };
  }
}

export default async function HomePage() {
  const { initialLatest } = await fetchServerData();
  return (
    <HomeClient
      initialLatest={initialLatest ?? undefined}
    />
  );
}
