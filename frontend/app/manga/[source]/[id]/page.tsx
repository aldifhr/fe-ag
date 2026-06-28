import type { Metadata } from "next";
import { MangaDetailClient } from "./MangaDetailClient";

async function getManga(id: string, source: string) {
  try {
    // Use the same API route the client uses (proxies to backend)
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.BACKEND_URL || "http://localhost:3001";
    const res = await fetch(
      `${base}/api/reader/manga?source=${source}&id=${encodeURIComponent(id)}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ source: string; id: string }>;
}): Promise<Metadata> {
  const { source, id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const data = await getManga(id, source);
  if (!data?.manga) {
    return { title: "Manga Tidak Ditemukan" };
  }
  const m = data.manga;
  return {
    title: `${m.title} — Manhwa Reader`,
    description:
      m.description?.substring(0, 160) || `Baca ${m.title} di Manhwa Reader`,
    openGraph: {
      title: m.title,
      description:
        m.description?.substring(0, 200) || `Baca ${m.title} di Manhwa Reader`,
      images: m.cover ? [{ url: m.cover, width: 600, height: 800 }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description:
        m.description?.substring(0, 200) || `Baca ${m.title} di Manhwa Reader`,
      images: m.cover ? [m.cover] : [],
    },
  };
}

export default async function MangaPage({
  params,
}: {
  params: Promise<{ source: string; id: string }>;
}) {
  const { source, id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const data = await getManga(id, source);
  return <MangaDetailClient initialData={data ?? undefined} />;
}
