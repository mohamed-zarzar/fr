import { useEffect, type RefObject } from 'react';

/**
 * When `sentinel` intersects `root` (scroll container), call `onLoadMore` if allowed.
 */
export function useInfiniteScrollSentinel(
  rootRef: RefObject<HTMLElement | null>,
  sentinelRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  canLoadMore: boolean,
  isFetchingMore: boolean,
  onLoadMore: () => void,
): void {
  useEffect(() => {
    const root = rootRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit && canLoadMore && !isFetchingMore) onLoadMore();
      },
      { root, rootMargin: '80px', threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [rootRef, sentinelRef, enabled, canLoadMore, isFetchingMore, onLoadMore]);
}
