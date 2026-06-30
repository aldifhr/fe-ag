"use client";
import React from "react";
import Link from "next/link";
import { useState } from "react";
import { proxyCover } from "@/lib/api";

interface Props {
  title: string;
  cover: string | null;
  id: string;
  status?: string | number | null;
  rating?: string | number | null;
}

const STATUS_COLORS: Record<string, string> = {
  Ongoing: "#22c55e",
  Completed: "#3b82f6",
  Hiatus: "#f59e0b",
  Cancelled: "#ef4444",
};

function MangaCard({ title, cover, id, status, rating }: Props) {
  const [imgErr, setImgErr] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const statusLabel =
    status != null
      ? typeof status === "number"
        ? [1].includes(status)
          ? "Ongoing"
          : [2].includes(status)
            ? "Completed"
            : [3].includes(status)
              ? "Hiatus"
              : null
        : status
      : null;

  const statusColor = statusLabel ? STATUS_COLORS[statusLabel] || "#888" : "";

  const ratingNum = rating != null && rating !== "" ? Number(rating) : null;
  const hasRating = ratingNum !== null && !isNaN(ratingNum) && ratingNum > 0;

  return (
    <div className="group flex flex-col rounded-lg overflow-hidden bg-(--color-surface) border border-(--color-border) hover:border-(--color-border-hover) transition-colors duration-200">
      <Link href={`/manga/${encodeURIComponent(id)}`} className="block">
        {/* Cover */}
        <div className="aspect-3/4 relative overflow-hidden bg-(--color-surface)">
          {cover && !imgErr ? (
            <img
              src={proxyCover(cover)}
              alt={title}
              referrerPolicy="no-referrer"
              className="relative w-full h-full object-cover transition-[filter,transform] duration-300 group-hover:scale-[1.03]"
              style={{
                filter: imgLoaded ? "none" : "blur(10px)",
                transform: imgLoaded ? "none" : "scale(1.1)",
              }}
              onError={() => setImgErr(true)}
              onLoad={() => setImgLoaded(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-(--color-surface) text-(--color-text-muted) text-sm p-3 text-center leading-relaxed">
              {title}
            </div>
          )}
        </div>

        {/* Title */}
        <div className="px-3 py-2.5">
          <h3 className="text-[13px] font-medium leading-snug line-clamp-2 text-(--color-text) group-hover:text-(--color-text-secondary) transition-colors duration-150">
            {title}
          </h3>
        </div>
      </Link>

      {/* Rating + Status badges */}
      <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap mt-auto">
        {hasRating && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded text-amber-500 bg-amber-500/10">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {ratingNum!.toFixed(1)}
          </span>
        )}
        {statusLabel && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded text-(--color-text-muted) bg-(--color-surface-hover)">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: statusColor }}
            />
            {statusLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export default React.memo(MangaCard);
