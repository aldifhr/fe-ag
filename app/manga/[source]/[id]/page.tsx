import type { Metadata } from "next";
import { MangaDetailClient } from "./MangaDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ source: string; id: string }>;
}): Promise<Metadata> {
  const { source, id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const title = `Manga — Manhwa Reader`;
  return {
    title,
    openGraph: {
      title,
      description: `Baca manga di Manhwa Reader`,
      type: "website",
    },
  };
}

export default function MangaPage() {
  return <MangaDetailClient />;
}
