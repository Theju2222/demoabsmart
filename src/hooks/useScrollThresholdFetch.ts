"use client";

import { useEffect, useRef } from "react";

interface UseScrollThresholdFetchOptions {
  // Fraction of the scrollable page that must be consumed before the next page
  // is requested. 0.7 = fire once the user has scrolled through 70% of the
  // current content, leaving ~30% still ahead of them to read while it loads.
  threshold?: number;
  // Gate: no more pages, or a page already in flight → never call onLoadMore.
  enabled: boolean;
  onLoadMore: () => void;
}

// Scroll-position based "load more" trigger.
//
// Replaces a bottom-of-list IntersectionObserver sentinel: a sentinel can only
// fire when the user is essentially AT the end of the content (rootMargin can
// pull it up a fixed number of pixels, but not by a fraction of the page), so
// the fetch started too late and the user hit a hard stop while waiting. A
// percentage is content-length independent — a 3-section page and a 30-section
// page both start loading with the same 30% of runway left.
//
// Duplicate-request protection is layered:
//   - `enabled` is driven by hasNextPage && !isFetchingNextPage upstream, so a
//     fetch in flight can't queue another,
//   - the handler is rAF-throttled, so one scroll gesture produces one check
//     per frame rather than one per scroll event,
//   - `firedRef` latches after a fire and only unlatches once `enabled` flips
//     back on with new content measured in, so the tail of the same gesture
//     (still past 70% while the request resolves) can't re-fire.
// TanStack Query itself dedupes anything that slips past all three, per key.
const useScrollThresholdFetch = ({
  threshold = 0.7,
  enabled,
  onLoadMore,
}: UseScrollThresholdFetchOptions) => {
  // Kept in refs so the scroll listener is attached once and never re-bound
  // mid-gesture (re-binding on every render dropped events on fast scrolls).
  const onLoadMoreRef = useRef(onLoadMore);
  const enabledRef = useRef(enabled);
  const firedRef = useRef(false);
  // Re-runs the SAME check the scroll/resize listener uses, but callable from
  // any effect below — not just the listener's own initial call at mount.
  const checkRef = useRef<() => void>(() => {});

  // Written in an effect, not during render: the listener below only reads it
  // from a scroll callback, which always runs after commit, so there is no
  // window where it could see a stale callback.
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    // A newly-enabled window means either the previous fetch resolved (new
    // content is now measurable) or there is a fresh page to get — either way
    // the latch is spent and the next threshold crossing may fire again.
    if (enabled) firedRef.current = false;
    enabledRef.current = enabled;
    // Re-check immediately on this transition, not just on the next real
    // scroll/resize event. Without this, landing on a page whose first fetch
    // resolves into content shorter than the viewport (or where the initial
    // mount-time check ran too early, before `enabled` was true) never
    // triggers the next page until the user happens to scroll — the fix
    // this hook exists for otherwise silently regresses to "scroll away and
    // back to wake it up".
    checkRef.current();
  }, [enabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;

    const check = () => {
      frame = 0;
      if (!enabledRef.current || firedRef.current) return;

      const doc = document.documentElement;
      const scrolled = window.scrollY || doc.scrollTop || 0;
      const viewport = window.innerHeight || doc.clientHeight || 0;
      const total = doc.scrollHeight || 0;
      const scrollable = total - viewport;

      // Content shorter than the viewport can never reach any percentage —
      // treat it as already past the threshold so the next page still loads.
      if (scrollable <= 0) {
        firedRef.current = true;
        onLoadMoreRef.current();
        return;
      }

      if (scrolled / scrollable >= threshold) {
        firedRef.current = true;
        onLoadMoreRef.current();
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(check);
    };

    checkRef.current = check;

    // Run once on mount/enable: the user may already be past the threshold
    // (restored scroll position, or a short page) with no scroll event coming.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [threshold]);
};

export default useScrollThresholdFetch;
