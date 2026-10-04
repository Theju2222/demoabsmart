"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Loader from "@/components/loader/Loader";
import {
  resetNavProgress,
  startNavProgress,
  stopNavProgress,
  subscribeNavProgress,
} from "@/hooks/useNavClick";

// Full-screen centered spinner shown while a navigation is being prepared —
// replaces an earlier slim top progress bar with the same trigger logic.
//
// Two things stall a click here with no visible feedback: a handler that
// awaits an API call before router.push (banner/See-All category redirects
// resolve an id -> slug first), and the App Router itself blocking on the new
// route's RSC payload after push. Both read as "my click did nothing" for
// 1-2s, so users click again. This overlay covers both windows: handlers
// start it synchronously on click via useNavClick, and it clears when the
// route actually changes.
const NavigationProgress = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => subscribeNavProgress(setActive), []);

  // Catches every in-app link click app-wide — the logo, the header nav, the
  // bottom bar, product cards, footer links. Those are plain <Link>s with no
  // onClick, so useNavClick never sees them, yet they stall exactly the same
  // way: the App Router blocks on the new route's RSC payload and the page
  // just sits there for 1-2s. Listening on the document in the CAPTURE phase
  // means nothing has to be wired per component and a handler that calls
  // stopPropagation can't hide the click from us.
  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      // Modified clicks open a new tab — this page isn't going anywhere.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const element = event.target as HTMLElement | null;
      // Buttons and form controls nested INSIDE a link (product cards wrap the
      // whole tile in an <a>, with Add-to-cart and the wishlist heart layered
      // on top) don't navigate — their handlers preventDefault and do their own
      // thing. Without this the card's own <a> was found by closest() below and
      // every add-to-cart flashed the full-screen navigation loader, which then
      // sat there until the 8s safety timeout because no route change ever came
      // to clear it.
      if (
        element?.closest?.(
          "button, input, select, textarea, label, [role='button'], [data-no-nav-progress]",
        )
      ) {
        return;
      }
      const anchor = element?.closest?.("a");
      const href = anchor?.getAttribute("href");
      if (!href || anchor?.target === "_blank") return;
      // Same-page anchors and non-navigating schemes never change the route.
      if (/^(#|mailto:|tel:|javascript:)/i.test(href)) return;
      // External destinations leave the app, so the bar would never clear.
      if (/^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)) {
        return;
      }
      // Clicking the page you're already on produces no route change, so
      // nothing would ever clear the bar.
      const target = new URL(href, window.location.href);
      if (
        target.pathname === window.location.pathname &&
        target.search === window.location.search
      ) {
        return;
      }
      startNavProgress();
      // Safety net: if the navigation is cancelled (a guard redirects, the
      // route fails, or the click turned out not to navigate at all), nothing
      // else would ever clear the overlay. Kept short — a full-screen loader
      // stuck over a page that isn't going anywhere is worse than a spinner
      // that clears slightly before a genuinely slow route lands.
      setTimeout(stopNavProgress, 3000);
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, []);

  // Note on programmatic navigation (router.push from a click handler rather
  // than a <Link>): it leaves no anchor for the capture above to find, and
  // hooking history.pushState does NOT help — Next calls that only AFTER the
  // RSC payload lands, which is the END of the stall, not the start. Those
  // call sites opt in explicitly via useNavClick instead (see Header's
  // bottom-nav handlers), because a blanket "any button click might
  // navigate" listener would flicker the bar on every drawer, modal and
  // filter toggle in the app.

  // The route changed — the navigation this overlay was tracking has landed.
  useEffect(() => {
    resetNavProgress();
  }, [pathname, searchParams]);

  // Delayed show, instant hide: most navigations that DO have this overlay's
  // safety nets in place resolve well under a blink, so showing immediately
  // would flash the spinner on every ordinary click. A route change genuinely
  // stuck for 150ms+ is exactly the "did my click register?" window this
  // exists to cover.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors the module-level progress subscription, an external system
      setVisible(false);
      return;
    }
    const id = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(id);
  }, [active]);

  if (!visible) return null;

  // Reuses the app's existing full-screen loader (the same Lottie animation
  // shown during boot/auth) rather than a bespoke spinner, so navigation
  // feedback looks like the rest of the app instead of a one-off.
  return <Loader screen="full" />;
};

export default NavigationProgress;
