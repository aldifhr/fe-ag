"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useInfiniteScroll } from "./useInfiniteScroll";

/**
 * Shared infinite-scroll pagination state machine.
 * Encapsulates page/loadingMore/hasMore/extraItems state and loadMore callback.
 */
export function usePagedFetch<T>(
  initialData: T[] | undefined,
  fetchFn: (page: number) => Promise<T[]>,
  opts: { pageSize?: number; enabled?: boolean } = {},
) {
  const { pageSize = 50, enabled = true } = opts;
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [extraItems, setExtraItems] = useState<T[]>([]);

  // Reset when initial data changes (refetch / mount / filter change)
  useEffect(() => {
    if (initialData) {
      setExtraItems([]);
      setPage(1);
      setHasMore(initialData.length >= pageSize);
    }
  }, [initialData, pageSize]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await fetchFn(nextPage);
      setExtraItems((prev) => [...prev, ...res]);
      setPage(nextPage);
      setHasMore(res.length >= pageSize);
    } catch {
      /* silent */
    }
    setLoadingMore(false);
  }, [page, loadingMore, hasMore, fetchFn, pageSize]);

  const items = useMemo(
    () => [...(initialData ?? []), ...extraItems],
    [initialData, extraItems],
  );

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: enabled && hasMore && !loadingMore,
  });

  return { items, loadMore, loadingMore, hasMore, sentinelRef };
}
