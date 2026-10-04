"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseInViewFetchOptions {
  // Gate: no more pages, or a page already in flight → never call onLoadMore.
  enabled: boolean;
  onLoadMore: () => void;
  // How far BELOW the viewport the sentinel can still be and count as "in
  // view" — lets the fetch start before the user actually scrolls the
  // sentinel into frame. Default 300px: enough runway for a typical fetch to
  // resolve before the user reaches the true end of the list.
  rootMarginPx?: number;
}

/**
 * IntersectionObserver-based "load more" trigger, keyed to a SENTINEL
 * element's own position — not the whole document's scrollHeight, unlike
 * useScrollThresholdFetch. That distinction matters on a page where the
 * paginated list is only one section among others (e.g. Wishlist inside the
 * profile dashboard, with a tall footer below it): a whole-page percentage
 * lands wherever 70% of EVERYTHING happens to fall, which can be well past
 * where the list itself ends — on a page with a big footer, that reads as
 * "only loads once you're basically at the very bottom." Watching the
 * sentinel's own viewport proximity is correct regardless of what unrelated
 * content sits above or below it.
 *
 * Returns a CALLBACK ref (not a plain ref object) — the sentinel element is
 * usually only rendered conditionally (e.g. `{hasMore && <div ref={...} />}`,
 * mounting once the first page loads), and a plain `useRef` + a one-time
 * `useEffect(() => {...}, [])` never re-runs when that later mount attaches
 * the ref — the observer would be set up against a still-null node and never
 * retried, so onLoadMore silently never fires. A callback ref runs on every
 * attach/detach, so the observer is (re)created exactly when there's a real
 * node to watch.
 */
const useInViewFetch = ({
  enabled,
  onLoadMore,
  rootMarginPx = 300,
}: UseInViewFetchOptions) => {
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  const enabledRef = useRef(enabled);
  // Latches after a fire so the same still-visible sentinel can't re-fire
  // while the triggered fetch is in flight; cleared once `enabled` flips
  // back on (fetch resolved, or a genuinely new page to get).
  const firedRef = useRef(false);
  // Last known visibility. IntersectionObserver only reports CHANGES, so a
  // sentinel that was already in view while `enabled` was false (fetch in
  // flight) never gets another event — without this, the next page waits
  // until the user scrolls the sentinel out and back in.
  const inViewRef = useRef(false);
  useEffect(() => {
    if (enabled) firedRef.current = false;
    enabledRef.current = enabled;
    if (enabled && inViewRef.current && !firedRef.current) {
      firedRef.current = true;
      onLoadMoreRef.current();
    }
  }, [enabled]);

  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      inViewRef.current = false;
      if (!node || typeof IntersectionObserver === "undefined") return;

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          inViewRef.current = !!entry?.isIntersecting;
          if (!entry?.isIntersecting) return;
          if (!enabledRef.current || firedRef.current) return;
          firedRef.current = true;
          onLoadMoreRef.current();
        },
        { rootMargin: `0px 0px ${rootMarginPx}px 0px` },
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [rootMarginPx],
  );

  return sentinelCallbackRef;
};

export default useInViewFetch;
