"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSelector } from "react-redux";
import { FaArrowUp } from "react-icons/fa";
import { BiSupport } from "react-icons/bi";
import { LuX } from "react-icons/lu";
import { RiCloseFill } from "react-icons/ri";
import { cn } from "@/lib/utils";
import { t } from "@/utils/translation";
import useIsRtl from "@/hooks/useIsRtl";
import useIsHydrated from "@/hooks/useIsHydrated";
import useCountdown from "@/hooks/useCountdown";
import { useSpinWheel } from "@/hooks/useSpinWheel";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import SpinWinPanel from "@/components/spinwin/SpinWinPanel";
import { OPEN_SPIN_WHEEL_EVENT } from "@/components/spinwin/spinWheelEvents";
import SupportChat from "@/components/chat/support/SupportChat";
import spinningWheelAnimation from "@/assets/spinning_wheel.json";
import { getPrimaryLottieRgb, recolorAnimation } from "@/utils/lottieColor";

// Lottie is client-only (touches window) — same lazy pattern as CartDrawer.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// Single bottom-corner action dock, replacing the previously separate
// BackToTop / SupportChatWidget / SpinWinFloatingButton mounts (each with its
// own fixed position and row-offset math to keep from overlapping).
//
//   - Guest: Spin & Win + Back to Top. Spin & Win is shown to everyone —
//     the real API lets a guest fetch wheel state (requires_login/can_spin
//     gate the SPIN action itself, not visibility of the wheel), so hiding
//     the button entirely would contradict how the backend models this.
//     SpinWinPanel is what shows the login prompt when a guest actually taps
//     SPIN.
//   - Logged in: Spin & Win + Support + Back to Top. Support genuinely IS
//     account-scoped (a guest has no ticket history), so it alone stays
//     gated on login.
//   - Spin & Win (+ Support when present) share one rounded pill so they read
//     as a single control cluster; Back to Top is always its own circle.
//
// Mount ONCE, globally (see Layout.tsx) — it owns Back to Top's scroll
// listener and both the spin dialog and support slide-over's open state
// itself, so it fully replaces the 3 old components rather than wrapping them.
const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const FloatingActionDock = () => {
  const rtl = useIsRtl();
  const userId = useSelector((s: any) => s.User?.user?.id);
  const setting = useSelector((s: any) => s.Setting?.setting);
  const spinWheelAvailable = setting?.spin_wheel_available == 1;

  const [scrollVisible, setScrollVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [spinOpen, setSpinOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  // Wheel state for the dock's own countdown badge. This shares SpinWinPanel's
  // react-query key (["spin-wheel", lat, lng, userId]), so opening the panel reuses
  // this cache entry rather than firing a second request — and the dock stays
  // in step with it after a spin, since the panel invalidates that same key.
  const isHydrated = useIsHydrated();
  const city = useSelector((s: any) => s.City?.city);
  const latitude = isHydrated ? city?.latitude : undefined;
  const longitude = isHydrated ? city?.longitude : undefined;
  const { data: spinData } = useSpinWheel({
    latitude,
    longitude,
    enabled: isHydrated && spinWheelAvailable,
  });
  // Only counts down once spins are actually exhausted; a guest is prompted to
  // log in instead, so their can_spin:false isn't a wait.
  const outOfSpins =
    spinData?.requires_login !== 1 && spinData?.spins?.can_spin === false;
  const nextSpinCountdown = useCountdown(
    outOfSpins ? spinData?.spins?.next_spin_at : null,
  );

  // spinning_wheel.json's baked black outlines/pointer are pure black —
  // repaint just those with the live tenant primary color, same pattern as
  // CartDrawer's giftLottie. The wheel's own rainbow segment colors and white
  // accents are untouched ("black" mode only targets pure black).
  const spinLottie = useMemo(
    () => recolorAnimation(spinningWheelAnimation, getPrimaryLottieRgb(), "black"),
    [],
  );

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      setScrollVisible(scrollTop > 400);
      setScrollProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Lets anything on the page open the wheel without prop-drilling this
  // dock's state to it — the rewards page's "Spin Now" is on its own route,
  // so it can't reach `spinOpen` any other way.
  useEffect(() => {
    const openWheel = () => setSpinOpen(true);
    window.addEventListener(OPEN_SPIN_WHEEL_EVENT, openWheel);
    return () => window.removeEventListener(OPEN_SPIN_WHEEL_EVENT, openWheel);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const isLoggedIn = Boolean(userId);
  const hiddenTranslateClass = rtl ? "-translate-x-full" : "translate-x-full";

  return (
    <>
      <div
        className={cn(
          "fixed z-40 flex flex-col items-center",
          "bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6",
          rtl ? "start-4 md:start-6" : "end-4 md:end-6",
        )}
      >
        {/* Cluster: Spin & Win (everyone) + Support (logged-in only) share one
            pill so they read as a single control group.
            Back to Top sits below it but OUT of flow, so the pill rests on the
            bottom edge while it's hidden and lifts by exactly its slot height
            when it appears — a transform, so the shift animates on the
            compositor instead of relayouting the dock every frame. */}
        <div
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-full p-1.5",
            "transition-transform duration-300 ease-out will-change-transform",
            scrollVisible ? "-translate-y-14" : "translate-y-0",
          )}
          style={{
            background:
              "color-mix(in srgb, var(--primary-color) 8%, transparent)",
            boxShadow:
              "0 12px 28px -14px color-mix(in srgb, var(--primary-color) 55%, transparent)",
          }}
        >
          {spinWheelAvailable && (
            <div className="relative">
              <DockButton
                label={t("spin_and_win") || "Spin & Win"}
                onClick={() => setSpinOpen(true)}
                rtl={rtl}
                // Outline (white circle) so the primary-colored Lottie glyph
                // reads clearly — a primary-on-primary filled circle would wash
                // the icon out.
                variant="outline"
              >
                <Lottie
                  animationData={spinLottie}
                  loop
                  autoplay
                  className="h-11 w-11"
                />
              </DockButton>

              {/* Time until the next spin, so the wait is visible without
                  opening the wheel. Hidden once it reaches zero — the wheel is
                  playable again at that point and the badge would be stale. */}
              {nextSpinCountdown && !nextSpinCountdown.finished && (
                <span
                  className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-[1px] text-[9px] font-bold leading-tight text-white tabular-nums shadow-sm"
                  style={{ backgroundColor: "var(--primary-color)" }}
                >
                  {nextSpinCountdown.label}
                </span>
              )}
            </div>
          )}

          {isLoggedIn && (
            <DockButton
              label={t("support") || "Support"}
              onClick={() => setSupportOpen(true)}
              rtl={rtl}
              variant="outline"
            >
              <BiSupport size={20} />
            </DockButton>
          )}
        </div>

        {/* Back to Top — its own circle, pinned to the dock's bottom edge and
            OUT of flow so it reserves no space while hidden (the pill above
            simply rests on the bottom edge instead). */}
        <div
          className={cn(
            "absolute bottom-0 transition-[transform,opacity] duration-300 ease-out will-change-transform",
            scrollVisible
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-4 scale-50 opacity-0",
          )}
        >
          <DockButton
            label={t("back_to_top") || "Back to Top"}
            onClick={scrollToTop}
            rtl={rtl}
            variant="filled"
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <circle
                cx="24"
                cy="24"
                r={RING_RADIUS}
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2.5"
              />
              <circle
                cx="24"
                cy="24"
                r={RING_RADIUS}
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - scrollProgress)}
                style={{ transition: "stroke-dashoffset 0.1s linear" }}
              />
            </svg>
            <FaArrowUp size={16} className="relative" />
          </DockButton>
        </div>
      </div>

      {/* Spin & Win dialog — transparent, no card surface behind it. Only the
          wheel itself (and its own dark title pill) should be visible, not a
          white/dark dialog box. */}
      <Dialog open={spinWheelAvailable && spinOpen} onOpenChange={setSpinOpen}>
        {/* Rendered as a SIBLING of DialogContent, not inside it. Radix's
            DialogContent carries translate-x/y-[-50%] to centre itself, and a
            transform on an ancestor creates a new containing block for any
            descendant `fixed` element — so a close button placed inside it
            was positioned relative to the DIALOG's box, not the viewport's.
            On a page wider than the dialog that put it well inside the page,
            behind the sticky site header (which sits at a lower z-index but
            was never actually being competed with — the button just wasn't
            reaching the corner it was told to). Outside DialogContent, this
            `fixed` isn't inside that transformed box, so end-4/top-4 resolve
            against the real viewport corner. Guarded on the same `open`
            condition as the dialog itself, since it's no longer inside the
            portal that used to mount/unmount it for free. */}
        {spinWheelAvailable && spinOpen && (
          <button
            type="button"
            onClick={() => setSpinOpen(false)}
            aria-label={t("close")}
            className="primaryBackColor fixed end-4 top-4 z-[71] flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg transition hover:opacity-90"
          >
            <RiCloseFill size={18} />
          </button>
        )}
        <DialogContent
          // No overflow-hidden: the dialog is transparent and its box can be
          // shorter than the artwork inside it, so clipping cut content off.
          className="w-full sm:max-w-3xl rounded-[28px] p-0 gap-0 border-0 shadow-none bg-transparent"
          // Stronger dim than the app-wide default (bg-black/40) — the
          // dialog itself is transparent, so the wheel needs a darker
          // backdrop behind it to read as focused rather than floating over
          // a barely-dimmed page.
          overlayClassName="bg-black/70"
          title={t("spin_and_win") || "Spin & Win"}
        >
          <SpinWinPanel onNavigateAway={() => setSpinOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Support slide-over — same shell SupportChatWidget used, now driven
          by this dock's own open state. */}
      <div
        className={cn(
          "fixed inset-0 z-[70] transition",
          supportOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          type="button"
          aria-label={t("close") || "Close"}
          className={cn(
            "absolute inset-0 cursor-default bg-black/40 backdrop-blur-[1px] transition-opacity duration-300",
            supportOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setSupportOpen(false)}
        />
        <div
          className={cn(
            "absolute top-0 h-full w-full sm:w-[420px] bg-white dark:bg-zinc-900 shadow-2xl flex flex-col overscroll-contain transition-transform duration-300 ease-out",
            rtl ? "left-0" : "right-0",
            supportOpen ? "translate-x-0" : hiddenTranslateClass,
          )}
        >
          <button
            type="button"
            onClick={() => setSupportOpen(false)}
            aria-label={t("close") || "Close"}
            className={cn(
              "absolute top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30",
              rtl ? "left-3" : "right-3",
            )}
          >
            <LuX size={18} />
          </button>
          {supportOpen && (
            <div className="flex h-full flex-col [&>div]:h-full [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
              <SupportChat />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// One dock circle + its hover-label speech bubble, matching the reference's
// pill-with-tail tooltip. `variant="filled"` is the solid primary-color
// circle (Spin & Win, Back to Top); `variant="outline"` is the white/outlined
// circle (Support) — mirrors the reference image's mixed styling.
const DockButton = ({
  label,
  onClick,
  rtl,
  variant,
  children,
}: {
  label: string;
  onClick: () => void;
  rtl: boolean;
  variant: "filled" | "outline";
  children: React.ReactNode;
}) => (
  <div className="group relative">
    <span
      className={cn(
        "pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100",
        rtl
          ? "left-full ml-3 -translate-x-2 group-hover:translate-x-0"
          : "right-full mr-3 translate-x-2 group-hover:translate-x-0",
      )}
      style={{
        background:
          "linear-gradient(135deg, var(--primary-color), color-mix(in srgb, var(--primary-color) 70%, #000))",
      }}
    >
      {label}
      {/* speech-bubble tail pointing at the button */}
      <span
        className={cn(
          "absolute top-1/2 h-2 w-2 -translate-y-1/2 rotate-45",
          rtl ? "-left-1" : "-right-1",
        )}
        style={{ background: "var(--primary-color)" }}
      />
    </span>

    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform duration-200 hover:scale-110 active:scale-95",
        variant === "filled"
          ? "text-white"
          : "bg-white text-[var(--primary-color)] ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10",
      )}
      style={
        variant === "filled"
          ? {
              background:
                "linear-gradient(135deg, var(--primary-color), color-mix(in srgb, var(--primary-color) 70%, #000))",
            }
          : undefined
      }
    >
      {children}
    </button>
  </div>
);

export default FloatingActionDock;
