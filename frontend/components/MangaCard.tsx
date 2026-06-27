"use client";
import Link from "next/link";
import { useState } from "react";

interface Props {
  title: string;
  cover: string | null;
  source: string;
  id: string;
  chapter?: string;
}

export default function MangaCard({ title, cover, source, id, chapter }: Props) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <Link href={`/manga/${source}/${encodeURIComponent(id)}`} className="manga-card group">
      <div className="aspect-[3/4] bg-[var(--border)] relative overflow-hidden">
        {cover && !imgErr ? (
          <img
            src={cover}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={() => setImgErr(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--muted)] text-sm p-2 text-center">
            {title}
          </div>
        )}
        {chapter && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
            <span className="text-xs text-white">Ch. {chapter}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium line-clamp-2 leading-tight">{title}</h3>
        <span className="text-xs text-[var(--muted)] mt-1 block capitalize">{source}</span>
      </div>
    </Link>
  );
}
