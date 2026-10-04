"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageview } from "@/utils/gtag";

/**
 * App Router replacement for _app.js's routeChangeComplete handler. There is
 * no "navigation started" event to mirror routeChangeStart — see
 * useAppNavigate.ts for how the visible loader is driven instead. This only
 * covers the completion side: firing a GA pageview once the URL has actually
 * changed, the same job routeChangeComplete did.
 */
export default function NavigationEvents() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The initial load's page_view is already fired by the GA init script's
  // onReady (see AppContent) — skip this effect's first run so it only
  // reports actual client-side route changes, not the first paint too.
  const isFirstRun = useRef(true);
  // Separate from isFirstRun: that ref is consumed (flipped false) by the
  // pageview effect below on this same first commit, so reusing it here would
  // also fire the scroll-to-top reset on the very first page load.
  const isFirstScrollRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname || "/";
    pageview(url);
  }, [pathname, searchParams]);

  // `experimental.scrollRestoration` (next.config.mjs) restores scroll by
  // history key BEFORE the new page's content has finished laying out — on a
  // page shorter than wherever the previous page was scrolled to, the browser
  // resolves that stale position against the new (still-settling) document
  // height and lands far down, often right at the footer. Same class of bug
  // HomeLayout.tsx already works around for its own tab switches with an
  // explicit scrollTo; this applies the same fix to every real route change.
  // Keyed on pathname only — a searchParams-only change (a filter, ?tab=) is
  // the same page and must not reset the scroll a user is mid-browsing at.
  useEffect(() => {
    if (isFirstScrollRun.current) {
      isFirstScrollRun.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}
