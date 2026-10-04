"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Stands in for "the one clickable thing in this component" when a call site
// has no item key to pass.
const SINGLE_TARGET_KEY = "__single__";

// Module-level, not context: the progress bar is a single fixed-position
// element at the app root, while the handlers that start it are scattered
// across banner/slider/tab sections that would otherwise all need a provider
// threaded through SectionsRenderer's prop chain.
type Listener = (active: boolean) => void;
const listeners = new Set<Listener>();
// Concurrent navigations (a click landing while another is still resolving)
// must not let the first one to finish clear the bar out from under the
// second, so the bar follows a count, not a boolean.
let pendingCount = 0;

const emit = () => {
  const active = pendingCount > 0;
  listeners.forEach((listener) => listener(active));
};

export const subscribeNavProgress = (listener: Listener) => {
  listeners.add(listener);
  listener(pendingCount > 0);
  return () => {
    listeners.delete(listener);
  };
};

export const startNavProgress = () => {
  pendingCount += 1;
  emit();
};

export const stopNavProgress = () => {
  pendingCount = Math.max(pendingCount - 1, 0);
  emit();
};

// Arrival clears everything at once: the route changed, so every click that
// was waiting on it is done regardless of how many were counted. Decrementing
// one at a time would leave the count stuck above zero (the safety-net
// timeouts below fire much later), and the next click would start from a
// non-zero count and never clear.
export const resetNavProgress = () => {
  if (pendingCount === 0) return;
  pendingCount = 0;
  emit();
};

/**
 * Wraps a navigation click handler so the user gets immediate feedback.
 *
 * Handlers that resolve a category id to its slug await an API call BEFORE
 * router.push, so nothing at all happens on screen for the length of that
 * request — the click reads as ignored and users click again. This starts the
 * top progress bar synchronously (before the first await) and latches out
 * repeat clicks until the navigation is under way.
 *
 * `run` takes an optional key so a section rendering many clickable items
 * (banner slider, grid) can light up only the one that was actually clicked:
 * `isPending(item.id)`. Call sites with a single target can omit it.
 */
const useNavClick = () => {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  // A ref, not the state value: two clicks in the same tick would both read
  // the pre-update state and both pass the guard.
  const pendingRef = useRef(false);

  const run = useCallback(
    async (handler: () => void | Promise<void>, key?: string | number) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setPendingKey(key != null ? String(key) : SINGLE_TARGET_KEY);
      startNavProgress();
      try {
        await handler();
      } catch (error) {
        console.log("Navigation click failed", error);
        // Only a failed handler clears the spinner here. On success the click
        // stays "pending" on purpose — router.push has merely been *called*,
        // and the route change it started is the second half of the same
        // stall. Clearing now would blink the overlay off and leave the user
        // staring at an unchanged page again.
        pendingRef.current = false;
        setPendingKey(null);
        stopNavProgress();
        return;
      }
      // Safety net for handlers that never navigate (an external window.open,
      // or a branch that decides to do nothing): without it the overlay and
      // bar would hang until the next route change that may never come.
      setTimeout(() => {
        pendingRef.current = false;
        setPendingKey(null);
        stopNavProgress();
      }, 8000);
    },
    [],
  );

  // The route changed, so whatever this click was waiting for has landed.
  const pathname = usePathname();
  useEffect(() => {
    pendingRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs with the router's route change, an external system
    setPendingKey(null);
  }, [pathname]);

  const isPending = useCallback(
    (key?: string | number) =>
      pendingKey != null &&
      pendingKey === (key != null ? String(key) : SINGLE_TARGET_KEY),
    [pendingKey],
  );

  return { run, isPending, pending: pendingKey != null };
};

export default useNavClick;
