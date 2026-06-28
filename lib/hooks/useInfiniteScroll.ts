import { useEffect, useRef } from "react";

export function useInfiniteScroll(
  loadMore: () => void,
  opts: { enabled: boolean; rootMargin?: string } = { enabled: true },
) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    if (!opts.enabled) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreRef.current();
      },
      { rootMargin: opts.rootMargin ?? "200px" },
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [opts.enabled, opts.rootMargin]);

  return sentinelRef;
}
