"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import { t } from "@/utils/translation";
import useIsHydrated from "@/hooks/useIsHydrated";
import useZoneHref from "@/hooks/useZoneHref";
import useCountdown from "@/hooks/useCountdown";
import useSpinSound from "@/hooks/useSpinSound";
import { useSpinWheel } from "@/hooks/useSpinWheel";
import { useSpinWheelRewards } from "@/hooks/useSpinWheelRewards";
import SpinWheel from "./SpinWheel";
import SpinWinStand from "./SpinWinStand";
import SpinWinBackPanel from "./SpinWinBackPanel";
import SpinCountdown from "./SpinCountdown";
import { FiClock } from "react-icons/fi";
import {
  RiCheckboxCircleFill,
  RiEmotionSadLine,
  RiFileCopyLine,
  RiRefreshLine,
  RiShoppingBag3Line,
  RiWallet3Line,
} from "react-icons/ri";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import useCurrency from "@/hooks/useCurrency";
import { formatCurrency } from "@/utils/helperFunction";
import type { SpinWheelSegment, SpinWheelSpinResult } from "@/types/spinWin";
import Image from "next/image";
import rewardGift from "@/assets/reward-gift.png";
import confettiFall from "@/assets/confetti.json";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
const Login = dynamic(() => import("../login/Login"), { ssr: false });

// Single soft easing for the whole result card. Springs overshot and read as
// jumpy here; a slow eased tween is what makes the reveal feel calm.
const SOFT_EASE = [0.22, 0.61, 0.36, 1] as const;
const softIn = (delay: number) => ({
  initial: { y: 12, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: { duration: 0.55, delay, ease: SOFT_EASE },
});

// The CRED reference's button outline: a flat-topped hexagon that comes to a
// POINT at each end, not a rectangle with the corners nicked off. The left and
// right vertices sit at the vertical mid-line, so the diagonals run the full
// height of the button.
//
// clip-path rather than border-radius (the edges are straight), and since
// clip-path can't be stroked the rim is a SECOND clipped layer: a bright outer
// shape with the dark fill clipped to the same polygon and inset inside it.
// 9% matches the reference's own 55-of-600 point length.
const HEX =
  "polygon(9% 0%, 91% 0%, 100% 50%, 91% 100%, 9% 100%, 0% 50%)";

interface SpinWinPanelProps {
  /** Called right before navigating to "My Rewards" — the caller (e.g.
   * FloatingActionDock) closes its own wrapping dialog here, so the rewards
   * page doesn't render stacked underneath a still-open wheel dialog. */
  onNavigateAway?: () => void;
}

// Live GET /customer/spin_wheel + POST /customer/spin_wheel/spin — see
// useSpinWheel.ts for the fetch/mutation wiring and its own note on the
// POST response shape not being confirmed yet.
const SpinWinPanel = ({ onNavigateAway }: SpinWinPanelProps = {}) => {
  const user = useSelector((state: any) => state.User?.user);
  // Same city/hydration pattern ProductFilter.tsx uses: city is redux-persisted
  // and empty on the server / first client paint, so guard reads until
  // hydration settles to avoid an SSR-vs-client fetch-gate mismatch.
  const city = useSelector((state: any) => state.City);
  const isHydrated = useIsHydrated();
  const latitude = isHydrated ? city?.city?.latitude : undefined;
  const longitude = isHydrated ? city?.city?.longitude : undefined;

  const { data, isLoading, isError, spin, spinning, refetch } = useSpinWheel({
    latitude,
    longitude,
    enabled: isHydrated,
  });

  // Lifetime wallet winnings from the Spin & Win rewards summary
  // (summary.wallet_won) — NOT user.balance, which is the account's whole
  // wallet including money that never came from spinning. The badge on the
  // stand is meant to read as "what this game has paid you", so it has to
  // come from the game's own rewards endpoint. Only fetched for a signed-in
  // user; a guest has no rewards history to summarise.
  const { summary: rewardsSummary } = useSpinWheelRewards({
    latitude,
    longitude,
    enabled: isHydrated && Boolean(user?.id),
  });

  const [showLogin, setShowLogin] = useState(false);
  const [spinToken, setSpinToken] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState<SpinWheelSegment | null>(
    null,
  );
  // Rolled once per spin, in the click handler (an event, not render) — the
  // wheel needs it to land with a bit of visual variety within the slice
  // instead of always stopping dead-center, but Math.random() can't run
  // during SpinWheel's own render/memo (React Compiler purity rule).
  const [spinJitter, setSpinJitter] = useState(0);
  const [spinResult, setSpinResult] = useState<SpinWheelSpinResult | null>(
    null,
  );
  const [showResult, setShowResult] = useState(false);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [confettiToken, setConfettiToken] = useState(0);
  const [copied, setCopied] = useState(false);
  const zoneHref = useZoneHref();
  const router = useRouter();

  const { currency, decimals } = useCurrency();
  const isWin = spinResult?.result === "win";
  const promo = spinResult?.promo_code;
  const wallet = spinResult?.wallet;

  // The API commonly sends the same copy as both title and message (e.g.
  // "Better luck next time"), which renders as the line repeated twice.
  // Compare case/whitespace-insensitively before showing the message.
  const norm = (s?: string) => s?.trim().toLowerCase().replace(/[.!]+$/, "");
  const resultMessage =
    norm(spinResult?.message) === norm(spinResult?.title)
      ? undefined
      : spinResult?.message;

  const handleCopyCode = () => {
    if (!promo?.promo_code) return;
    navigator.clipboard
      .writeText(promo.promo_code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      })
      .catch(() => toast.error(t("something_went_wrong")));
  };

  // The title renders as two differently-styled lines, so the campaign's name
  // is split on its FIRST space: "Spin the Wheel" -> "Spin" / "the Wheel".
  // Anything else the API sends still works — a one-word name drops the second
  // line rather than rendering an empty one.
  const campaignTitle =
    data?.campaign?.name || t("spin_and_win") || "Spin & Win!";
  const titleSplitAt = campaignTitle.indexOf(" ");
  const titleLead =
    titleSplitAt === -1 ? campaignTitle : campaignTitle.slice(0, titleSplitAt);
  const titleRest =
    titleSplitAt === -1 ? "" : campaignTitle.slice(titleSplitAt + 1);

  const requiresLogin = data?.requires_login === 1 && !user?.id;
  const canSpin = Boolean(data?.spins?.can_spin) && !wheelSpinning && !spinning;
  const { playTick, playWin, playSpinSound, stopSpinSound } = useSpinSound();
  // Live countdown to the next allowed spin. Only meaningful once spins are
  // exhausted; the hook itself is null until mounted, so SSR never renders a
  // clock that the client would immediately disagree with.
  const outOfSpins = !requiresLogin && data?.spins?.can_spin === false;
  const nextSpinSeconds = data?.spins?.next_spin_in_seconds;
  // Prefer the server's relative seconds-delta over `next_spin_at`: it's
  // computed from server time, so it can't be thrown off by a wrong/skewed
  // client clock the way parsing an absolute timestamp against Date.now()
  // would be. Date.now() can't run during render/useMemo (React Compiler
  // purity rule), so it's captured once per actual seconds value in an
  // effect — same pattern useCountdown itself uses — rather than recomputed
  // (and drifting) on every render.
  const [nextSpinDeadline, setNextSpinDeadline] = useState<string | null>(
    null,
  );
  useEffect(() => {
    if (nextSpinSeconds == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time reset when this fetch carried no seconds-delta, not a cascading update
      setNextSpinDeadline(data?.spins?.next_spin_at ?? null);
      return;
    }
    setNextSpinDeadline(
      new Date(Date.now() + nextSpinSeconds * 1000).toISOString(),
    );
  }, [nextSpinSeconds, data?.spins?.next_spin_at]);
  const nextSpinCountdown = useCountdown(
    outOfSpins ? nextSpinDeadline : null,
  );

  const handleSpin = async () => {
    if (requiresLogin) {
      setShowLogin(true);
      return;
    }
    if (!canSpin) {
      // Not a failure — the wheel is legitimately unavailable right now
      // (daily limit reached, already spinning, etc). "something_went_wrong"
      // reads as a broken request, which this isn't. The machine-readable
      // slug is `reason_key` ("spin_wheel_daily_limit_reached") — `reason` is
      // the API's own ready-to-show sentence ("You have used all your spins
      // for today."), which is shown as-is for any key besides the one
      // confirmed/localized case, so a reason this doesn't recognize yet
      // still shows real, useful copy instead of a generic fallback.
      if (!data?.spins?.can_spin) {
        // reason_key's confirmed values, per the API's own contract:
        // spin_wheel_daily_limit_reached, spin_wheel_no_spins_left,
        // spin_wheel_order_required, login_to_continue (that last one never
        // reaches here — it's the requiresLogin branch above), or empty. Any
        // OTHER value this doesn't recognize yet still shows real, useful
        // copy via the API's own `reason` sentence rather than a generic
        // fallback.
        const reasonKey = data?.spins?.reason_key;
        toast.error(
          reasonKey === "spin_wheel_daily_limit_reached"
            ? t("daily_spin_limit_reached") ||
                "You've used today's spins — come back tomorrow"
            : reasonKey === "spin_wheel_no_spins_left"
              ? t("no_spins_left") || "No spins left"
              : reasonKey === "spin_wheel_order_required"
                ? t("spin_wheel_order_required") ||
                  "Place an order to unlock a spin"
                : data?.spins?.reason ||
                    t("spin_not_available_now") ||
                    "Spin isn't available right now",
          { toastId: "spin-win-blocked" }
        );
      }
      return;
    }
    try {
      const { segment, result } = await spin();
      setSelectedSegment(segment);
      setSpinResult(result);
      setSpinJitter(Math.random() - 0.5);
      setWheelSpinning(true);
      setSpinToken((tkn) => tkn + 1);
      playSpinSound();
    } catch {
      // Mutation failure (network/4xx) — nothing to animate, just leave the
      // wheel idle. The mutation itself already surfaces via isError-style
      // handling wherever the app's global API error toast is wired.
    }
  };

  const handleSpinAnimationComplete = () => {
    setWheelSpinning(false);
    stopSpinSound();
    if (spinResult?.result === "win") {
      // Confetti starts a beat before the card, so the burst is already
      // falling by the time the card rises through it.
      setConfettiToken((tkn) => tkn + 1);
      playWin();
      setTimeout(() => setShowResult(true), 250);
    } else {
      setShowResult(true);
    }
  };

  // "Spin Again" — swap the result view back out for the wheel, same spot,
  // no dialog.
  const handleSpinAgain = () => {
    setShowResult(false);
  };

  if (!isHydrated || isLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-sm font-medium text-white/80">
          {t("something_went_wrong") || "Something went wrong"}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-full primaryBackColor px-4 py-2 text-xs font-bold text-white"
        >
          {t("retry") || "Retry"}
        </button>
      </div>
    );
  }

  if (data.is_available !== 1) {
    return (
      <div className="flex flex-col items-center gap-2 p-10 text-center">
        <p className="text-sm font-medium text-white/80">
          {data.message || t("spin_win_unavailable") || "Spin & Win isn't available right now"}
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-4 lg:gap-6">
      {/* Confetti plays OVER the card (pointer-events-none, so the card
          stays clickable underneath) and fades itself out. Uses the falling
          confetti asset, NOT colorful-confetti.json — that one is a radial
          ray blast that blew out the whole card. */}
      {confettiToken > 0 && (
        <motion.div
          key={confettiToken}
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 4,
            times: [0, 0.04, 0.75, 1],
            ease: "easeInOut",
          }}
        >
          <Lottie
            className="h-full w-full"
            animationData={confettiFall}
            loop={false}
            rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
          />
        </motion.div>
      )}

      <div className="relative z-10 flex justify-center">
        {/* Stage: the wheel and the result swap in the SAME spot — no
            dialog, no dark backdrop, exactly like the reference markup's
            #spinView / #resultView toggle. */}
        {/* The whole assembly — wheel, stand and backing panel — is sized in
            percentages of this stage, so widening it scales everything up
            together and keeps the layout identical. */}
        {/* No min-h and no max-h. A min-h floor doesn't shrink for a small
            viewport (caused the earlier "bahu moti" oversized bug); a max-h
            ceiling paired with overflow-hidden CUT content instead — the
            maxWidth-from-height calc only budgeted for the wheel+stand's own
            aspect ratio, not the title above it or the wallet badge below, so
            both got clipped the moment the assembly was tall enough to hit
            the cap. Height is natural now (no overflow-hidden either); only
            WIDTH is capped, so the column can never render oversized, and it
            simply takes whatever height its real content needs. */}
        <div
          className="relative mx-auto flex w-full flex-col items-center justify-center gap-3.5 rounded-[32px] p-5"
          // theme.bg_color RE-POINTS --primary-color for this whole stage
          // subtree, rather than being threaded into every individual
          // component. The cabinet (SpinWinStand), the backing panel
          // (SpinWinBackPanel), the wallet badge and the result card's own
          // face/panel all already derive their colours from
          // color-mix(in srgb, var(--primary-color) ...) — overriding the
          // variable here re-themes all of them at once with no per-component
          // prop, and falls through to the site's real brand colour for any
          // campaign that doesn't set one.
          style={{
            // Width-only cap: 560px keeps the assembly at a readable, sane
            // physical size (768px read as "bahu moti", 420px as too small)
            // on any viewport wide enough for it, and 92vw shrinks it on a
            // narrow one. No vh term any more — mixing a viewport-HEIGHT
            // limit into the width calc was what clipped the title/badge
            // (see comment above).
            maxWidth: "min(560px, 92vw)",
            ...(data.campaign?.theme?.bg_color
              ? ({
                  "--primary-color": data.campaign.theme.bg_color,
                } as React.CSSProperties)
              : {}),
          }}
        >
          {/* Decorative stage backdrop — deep violet gradient, center
              spotlight, streaks, bokeh and gold sparkles, all CSS (no image
              asset). Its palette is fixed rather than brand-derived; see the
              note at the top of that file. It's absolutely positioned and
              aria-hidden/pointer-events-none; everything below stays above it
              via its own z-10. */}

          {/* mode="wait" so the outgoing view finishes fading before the
              incoming one starts — otherwise the wheel and the result card
              cross-fade on top of each other and the swap reads as a snap. */}
          <AnimatePresence mode="wait">
          {!showResult && (
            <motion.div
              key="wheel"
              className="relative z-10 flex w-full flex-col items-center gap-7"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.4, ease: SOFT_EASE }}
            >
              {/* Title above the wheel. No pill/background — the title
                  itself carries the theme color, and a text-shadow keeps it
                  legible over arbitrary page art instead of a solid fill. */}
              <div className="flex flex-col items-center gap-1.5 px-5 text-center">
                {/* Game-show lockup: first word white with a violet glow, the
                    rest gold. The campaign name is API copy of any length, so
                    it's split on the FIRST space rather than assuming the two
                    lines of "Spin the Wheel" — a single-word name just renders
                    the white line and skips the gold one. */}
                <h2 className="spinTitle">
                  {/* theme.title_color / title_color_2 override the CSS
                      class's own brand-derived default when the campaign
                      sends one — inline style wins over the stylesheet rule
                      without needing a second class per campaign. */}
                  <span
                    className="spinTitle__lead block"
                    style={
                      data.campaign?.theme?.title_color
                        ? ({
                            // Washed toward white, NOT toward transparent:
                            // the lockup sits on a dark stage, so a
                            // transparent fill reads darker rather than
                            // lighter and the outline stops separating from
                            // it. A pale tint of the same hue is what makes
                            // the full-strength border ring visible.
                            color: `color-mix(in srgb, ${data.campaign.theme.title_color} 35%, #fff)`,
                            // Border is the API colour AS SENT, not a
                            // derived shade — the reference lockup's ring is
                            // the theme's own title_color at full strength.
                            "--spinTitle-border-color":
                              data.campaign.theme.title_color,
                          } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {titleLead}
                  </span>
                  {titleRest && (
                    <span
                      className="spinTitle__rest block"
                      style={(() => {
                        // Same treatment as the lead line: pale tint of the
                        // colour as fill, the colour itself as the border —
                        // title_color_2 when sent, else the lead's colour.
                        const c =
                          data.campaign?.theme?.title_color_2 ||
                          data.campaign?.theme?.title_color;
                        return c
                          ? ({
                              color: `color-mix(in srgb, ${c} 35%, #fff)`,
                              "--spinTitle-border-color": c,
                            } as React.CSSProperties)
                          : undefined;
                      })()}
                    >
                      {titleRest}
                    </span>
                  )}
                </h2>
                {/* Live countdown to the next spin, once they're out. The API's
                    own `next_spin_at_label` is the fallback for a browser that
                    couldn't parse the timestamp (the hook returns null then). */}
                {/* Only the FALLBACKS live here. The live clock itself is
                    rendered down on the cabinet, in place of the SPIN key —
                    showing it here as well meant the same countdown twice on
                    one screen. These two cases have no digits to tile (the
                    clock has run out, or the browser couldn't parse the
                    timestamp and the hook returned null), so they stay chips
                    and stay under the title. */}
                {outOfSpins &&
                  (nextSpinCountdown?.finished ||
                    (!nextSpinCountdown && data.spins?.next_spin_at_label)) && (
                    <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-bold text-white tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
                      <FiClock size={12} />
                      {nextSpinCountdown?.finished
                        ? t("spin_available_now") || "Spin available — refresh"
                        : `${t("next_spin_at") || "Next spin"}: ${data.spins?.next_spin_at_label}`}
                    </p>
                  )}
              </div>

              {/* Wheel + its console share one gap-less column: the stand's
                  own negative top margin tucks it under the wheel's bezel, so
                  a gap between them here would undo that overlap. */}
              <div className="relative flex w-full flex-col items-center">
                {/* Backing panel — the cabinet face the wheel is mounted on.
                    Absolutely positioned behind the column (z-0, wheel and
                    stand both sit above it) and sized to the column rather
                    than to a fixed height: the wheel is fluid, so a set height
                    would either crop it or leave a gap below on another
                    viewport. It stops short of the bottom because the stand
                    takes over there. */}
                {/* roundedAll: the panel now extends BELOW the stand's bottom
                    edge, so its own bottom corners are visible and need the
                    same radius as the top — the square-bottom variant was for
                    when it stopped exactly at the cabinet's top seam. */}
                <SpinWinBackPanel roundedAll={false} width="72%" />

                {/* w-[94%] (up from 88%): the backing panel is full-width,
                    and 88% left noticeably more panel showing on each side
                    than the reference — the panel should read as a narrow
                    frame around the wheel, not a wide mat under it.
                    Wraps the STAND too now, not just the wheel: they used to
                    sit at different widths (wheel 88%/94% of the column,
                    stand a separate 100%), so the stand's cabinet stuck out
                    past the panel's own edges instead of matching the
                    wheel's inset. */}
                {/* Wheel and stand get SEPARATE wrappers: the cabinet is
                    meant to read as a broad console the (narrower) wheel
                    stands in, so sharing one width made it look undersized. */}
                <div className="relative z-10 w-[80%]">
                <SpinWheel
                  segments={data.segments}
                  selectedSegment={selectedSegment}
                  jitter={spinJitter}
                  spinning={wheelSpinning}
                  spinToken={spinToken}
                  onSpinComplete={handleSpinAnimationComplete}
                  canSpin={requiresLogin || canSpin}
                  theme={data.campaign?.theme}
                  onTick={playTick}
                />
                </div>

                {/* The ONLY spin trigger — the wheel's centre hub used to be a
                    second one, but it's decorative now. A guest can press it:
                    handleSpin opens the login sheet rather than failing.
                    z-[5], BELOW the wheel's z-10: the stand's own negative top
                    margin tucks its arched top under the wheel, and at an
                    equal z-index it came later in the DOM and painted OVER the
                    wheel instead — the cabinet covered the wheel's bottom
                    edge. Still above the backing panel's z-0.
                    w-[80%] matches the wheel's wrapper exactly — the cabinet
                    and the wheel have to share side edges, and a w-full
                    wrapper here put them on different vertical lines. */}
                {/* No z-index of its own: the stand renders its side wings on
                    a z-[-1] layer that has to fall BEHIND the backing panel
                    (z-0), and any z-index here would trap that layer in this
                    wrapper's own stacking context. Without one, the cabinet
                    still paints above the panel by DOM order, and the wheel's
                    z-10 still wins over the cabinet. */}
                <div className="relative w-[80%]">
                <SpinWinStand
                  onSpin={handleSpin}
                  canSpin={requiresLogin || canSpin}
                  disabled={wheelSpinning || spinning}
                  // Drives the stand's chase lights. wheelSpinning (the
                  // animation) rather than `spinning` (the pending mutation),
                  // so the bulbs run for exactly as long as the wheel turns.
                  spinning={wheelSpinning}
                  // theme.button_text overrides the localized default when the
                  // campaign sends one — max 12 chars per the API's own note,
                  // since this is a fixed-width cap face, not a field that
                  // reflows around a long string.
                  label={
                    data.campaign?.theme?.button_text?.slice(0, 12) ||
                    t("spin") ||
                    "Spin"
                  }
                  buttonColor={data.campaign?.theme?.button_color}
                  buttonTextColor={data.campaign?.theme?.button_text_color}
                  lightColor={data.campaign?.theme?.light_color}
                  // Out of spins the tile row REPLACES the key on the cabinet,
                  // rather than the key sitting there disabled. Passed as a
                  // node so the stand doesn't need to know how a countdown
                  // looks.
                  countdown={
                    outOfSpins &&
                    nextSpinCountdown &&
                    !nextSpinCountdown.finished ? (
                      <SpinCountdown countdown={nextSpinCountdown} compact />
                    ) : null
                  }
                />
                </div>
              </div>

              {/* Wallet balance badge — a coin sitting ON the top edge of a
                  dark pill, per the reference. Below the stand rather than
                  pinned to the stage corner, and now a real button: tapping it
                  takes the user straight to My Rewards, where the balance it's
                  showing actually lives. Only for a signed-in user: a guest
                  has no balance to show, and a "₹0.00" chip reads as a broken
                  fetch rather than an empty wallet. */}
              {user?.id && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateAway?.();
                    router.push("/profile/spin-win-rewards");
                  }}
                  className="group relative z-10 mt-2 flex flex-col items-center transition active:scale-[0.97]"
                >
                  {/* The coin overlaps the pill below it, so it's given a
                      negative bottom margin rather than being absolutely
                      placed — that keeps the two centred on each other
                      whatever the balance string's width turns out to be. The
                      coin stays LARGE and only dips a third of itself behind
                      the pill, per the reference; a small coin sunk deep just
                      read as a bump. */}
                  <span
                    className="relative z-[1] -mb-[11px] flex h-[34px] w-[34px] items-center justify-center rounded-full p-[3px] transition group-hover:brightness-110"
                    style={{
                      // The coin's RIM: a darker ring, lit at the top and
                      // shaded at the bottom. A single flat gradient with a
                      // black outline read as a sticker — a real coin has a
                      // raised rim around a recessed face, which is two
                      // rings, not one.
                      // Brand-derived rather than gold: the template ships
                      // white-label, so a fixed hue would be wrong for every
                      // client but one. The mixes keep the original's
                      // lightness steps.
                      background:
                        "linear-gradient(180deg, color-mix(in srgb, var(--primary-color) 55%, #fff) 0%, var(--primary-color) 55%, color-mix(in srgb, var(--primary-color) 70%, #0A0A0A) 100%)",
                      boxShadow:
                        "0 3px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.7)",
                    }}
                  >
                    <span
                      className="flex h-full w-full items-center justify-center rounded-full text-[15px] font-black leading-none"
                      style={{
                        // The face, lit from the top-left and shaded at the
                        // bottom-right so it reads as slightly domed.
                        background:
                          "radial-gradient(circle at 34% 28%, color-mix(in srgb, var(--primary-color) 12%, #fff) 0%, color-mix(in srgb, var(--primary-color) 38%, #fff) 42%, color-mix(in srgb, var(--primary-color) 82%, #fff) 78%, var(--primary-color) 100%)",
                        boxShadow:
                          "inset 0 -2px 4px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.55)",
                        color:
                          "color-mix(in srgb, var(--primary-color) 55%, #0A0A0A)",
                      }}
                    >
                      {currency}
                    </span>
                  </span>
                  <span
                    // relative z-0 so the coin's own z-[1] actually wins:
                    // without a stacking position here the pill came later in
                    // the DOM and its rim glow painted straight over the coin.
                    className="relative z-0 rounded-full px-4 pb-1 pt-[13px] text-[15px] font-extrabold tabular-nums leading-none text-white"
                    style={{
                      // Near-black body with a lit brand rim, same as before
                      // but the rim (and its glow) now follow the client's
                      // colour.
                      background:
                        "linear-gradient(180deg, color-mix(in srgb, var(--primary-color) 14%, #0A0A0A) 0%, color-mix(in srgb, var(--primary-color) 8%, #060606) 100%)",
                      boxShadow:
                        "0 0 0 2px var(--primary-color), 0 0 20px -2px color-mix(in srgb, var(--primary-color) 70%, transparent), 0 6px 14px rgba(0,0,0,0.55)",
                    }}
                  >
                    {formatCurrency(
                      Number(rewardsSummary?.wallet_won || 0),
                      currency,
                      decimals,
                    )}
                  </span>
                  <span className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
                    {t("my_rewards") || "My Rewards"}
                  </span>
                </button>
              )}

            </motion.div>
          )}

          {/* Result — swaps the wheel out entirely, same spot. */}
            {showResult && (
              <motion.div
                key="result"
                // The reference's card is a stack of REAL 3D layers, each
                // pushed forward on Z inside a shared perspective — not a set
                // of gradients faking depth. That's the whole trick: the
                // extruded body sits behind, the black frame on top of it, the
                // coloured face above that and the recessed panel above that
                // again, so the edges genuinely occlude one another.
                //
                // This element is the FRAME: a black slab with a bright
                // gradient border, and the extruded body behind it is its own
                // absolutely-positioned layer at a negative Z.
                //
                // No overflow-hidden: the CTA row deliberately hangs past the
                // card's bottom edge and clipping cut it in half.
                className="relative z-10 w-full max-w-[340px] rounded-[30px] p-[3px] text-center"
                style={{
                  // The rim stays IN the brand colour and never runs up to
                  // white: near-white stops at the bottom read as a glassy
                  // highlight rather than as a lit edge, and washed the card's
                  // corners out completely.
                  background:
                    // The padding-box fill shows through the 3px padding as a
                    // black ring between the rim and the face — that dark
                    // separation is what makes the rim read as a separate
                    // piece rather than an outline drawn on the face.
                    "linear-gradient(#0a0909, #0a0909) padding-box, linear-gradient(180deg, color-mix(in srgb, var(--primary-color) 95%, #fff) 0%, var(--primary-color) 45%, color-mix(in srgb, var(--primary-color) 80%, #000) 100%) border-box",
                  // Thicker than before (was 1.5px) — the reference's rim
                  // reads as a real ring, not a hairline, and the border
                  // width IS the rim's visible thickness with this
                  // padding-box/border-box gradient trick.
                  border: "4px solid transparent",
                  boxShadow: "0 30px 60px rgba(0,0,0,0.55)",
                  transformStyle: "preserve-3d",
                  transformPerspective: 900,
                }}
                // Rises and unfolds into place (a slight 3D tilt reads as the
                // card "opening" rather than just fading in).
                initial={{ scale: 0.9, y: 40, opacity: 0, rotateX: 12 }}
                animate={{ scale: 1, y: 0, opacity: 1, rotateX: 0 }}
                exit={{ scale: 0.96, y: 12, opacity: 0 }}
                transition={{ duration: 0.62, ease: SOFT_EASE }}
              >
                {/* The extruded body, BEHIND the frame and slightly lower:
                    the sliver of it showing below the card's bottom edge is
                    what gives the whole thing thickness. Dark, because it's
                    the side of the slab rather than its lit face.
                    This is the ONLY layer that carries a translateZ — it holds
                    no text, so the resampling that a Z-translated layer causes
                    doesn't matter here. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-1 -bottom-[14px] top-3 rounded-[30px]"
                  style={{
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--primary-color) 45%, #141414), color-mix(in srgb, var(--primary-color) 60%, #181818) 88%, color-mix(in srgb, var(--primary-color) 70%, #1C1C1C))",
                    transform: "translateZ(-26px)",
                  }}
                />

                {/* The coloured FACE — the lit top surface of the slab. */}
                <div
                  // overflow-visible so the CTA row can hang past the bottom
                  // edge; the decorative washes inside carry their own radius
                  // instead of relying on this to clip them.
                  className="relative rounded-[26px] p-2"
                  style={{
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--primary-color) 38%, #0E0E0E) 0%, color-mix(in srgb, var(--primary-color) 52%, #121212) 40%, color-mix(in srgb, var(--primary-color) 70%, #191919) 72%, color-mix(in srgb, var(--primary-color) 88%, #191919) 100%)",
                    boxShadow:
                      "inset 0 0 0 2px color-mix(in srgb, var(--primary-color) 30%, transparent), inset 0 -8px 0 color-mix(in srgb, var(--primary-color) 18%, transparent)",
                  }}
                >

                {/* The recessed inner PANEL — pushed forward again, and lit
                    from below like the face, with a dark lip along its top
                    edge so it reads as sunk into the face. */}
                <div
                  className="relative rounded-[22px] px-1 pb-1"
                  style={{
                    // Darker than the body at every point, and running the
                    // OPPOSITE way (dark top, slightly lighter bottom) so the
                    // two gradients meet in opposition at the seam — that
                    // contrast is what makes the well look recessed.
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--primary-color) 34%, #151515), color-mix(in srgb, var(--primary-color) 52%, #1A1A1A))",
                    boxShadow: [
                      // Shadow cast by the body's own lip onto the well below.
                      "inset 0 8px 14px -6px rgba(0,0,0,0.75)",
                      "inset 0 1px 0 rgba(0,0,0,0.6)",
                      // Bounce off the body's lit bottom edge, back up into
                      // the well — without it the well's floor sits dead
                      // against the brightest part of the body.
                      "inset 0 -2px 0 color-mix(in srgb, var(--primary-color) 85%, #fff)",
                      "inset 0 -16px 22px -14px color-mix(in srgb, var(--primary-color) 75%, #000)",
                    ].join(", "),
                    // NO translateZ here. This layer holds the card's text, and
                    // a Z-translated layer is rasterized at its own size then
                    // scaled up by the perspective — which resampled every
                    // glyph and left the copy visibly soft. The depth below it
                    // (the extruded body, the face) is decorative, so it can
                    // carry the Z; type cannot.
                  }}
                >
                {/* Soft tinted wash + corner blobs behind the hero, so the
                    card reads as celebratory without a heavy colored fill. */}
                {/* Their own clipped layer: the well itself is overflow-visible
                    now (so the CTA row can hang out of it), and these blobs sit
                    outside its box by design — without this they'd spill across
                    the page instead of glowing from behind the card's corners. */}
                {isWin && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]"
                  >
                    <span
                      className="absolute inset-x-0 top-0 h-56"
                      style={{
                        background:
                          "linear-gradient(180deg, color-mix(in srgb, var(--primary-color) 26%, transparent), transparent)",
                      }}
                    />
                    <span
                      className="absolute -left-10 -top-8 h-36 w-36 rounded-full blur-2xl"
                      style={{
                        background:
                          "color-mix(in srgb, var(--primary-color) 38%, transparent)",
                      }}
                    />
                    <span
                      className="absolute -right-12 top-10 h-40 w-40 rounded-full blur-2xl"
                      style={{
                        background:
                          "color-mix(in srgb, var(--primary-color) 28%, transparent)",
                      }}
                    />
                  </span>
                )}

                {/* Hero band — the win art is a wide (1677x938) illustration,
                    so the band is sized to it rather than to a square. Kept
                    fully INSIDE the card now: it used to hang up over the top
                    rim, but that let it spill past the card's own rounded
                    corners onto the page behind it. */}
                <div
                  className={
                    isWin
                      ? "relative z-10 flex h-[150px] items-center justify-center overflow-hidden"
                      : "relative z-10 flex h-[104px] items-end justify-center overflow-hidden"
                  }
                >
                  <motion.div
                    className="flex h-full w-full items-center justify-center"
                    initial={{ scale: 0.82, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.7, delay: 0.08, ease: SOFT_EASE }}
                  >
                    {isWin ? (
                      // The segment actually landed on, per its own icon_url
                      // from GET /customer/spin_wheel — the spin response
                      // itself only carries segment_id/segment_index, so
                      // selectedSegment (resolved by id/index against the
                      // cached segments[] in useSpinWheel's own spin())
                      // carries the real per-prize art. Falls back to the
                      // generic gift illustration for a campaign that hasn't
                      // set an icon on its segments, or on the network's own
                      // failure to load one.
                      selectedSegment?.icon_url ? (
                        <Image
                          src={selectedSegment.icon_url}
                          alt=""
                          width={230}
                          height={150}
                          priority
                          // The API can point this at any host/size — an
                          // arbitrary campaign icon, not an asset this app
                          // controls the dimensions of. Next's own
                          // optimizer assumes it can re-encode/resize on
                          // its own infra, which isn't guaranteed for a
                          // third-party icon URL that may not even be on
                          // an allow-listed image host.
                          unoptimized
                          className="h-auto max-h-[130px] w-auto max-w-[180px] object-contain"
                        />
                      ) : (
                        <Image
                          src={rewardGift}
                          alt=""
                          priority
                          className="h-auto w-[230px] object-contain"
                        />
                      )
                    ) : selectedSegment?.icon_url ? (
                      // The "no luck" segment can carry its own icon_url too
                      // (e.g. a "better luck next time" graphic) — prefer it
                      // over the generic sad-face the same way a win prefers
                      // its own segment art over the stock gift image.
                      <Image
                        src={selectedSegment.icon_url}
                        alt=""
                        width={230}
                        height={150}
                        priority
                        unoptimized
                        className="h-auto max-h-[130px] w-auto max-w-[180px] object-contain"
                      />
                    ) : (
                      // A loss gets a calm, on-theme mark — the stock gift
                      // Lottie is a black-outline coupon doodle that reads as
                      // broken art here.
                      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/[0.08]">
                        <RiEmotionSadLine size={34} className="text-white/55" />
                      </span>
                    )}
                  </motion.div>
                </div>

                <div className="relative z-10 px-6 pb-6">
                  {/* Eyebrow with rule flankers, as in the reference. */}
                  <motion.div
                    className="flex items-center justify-center gap-2.5"
                    {...softIn(0.22)}
                  >
                    <span className="h-px w-5 bg-white/25" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
                      {isWin ? t("you_won") || "YOU WON" : t("oh_no") || "OH NO"}
                    </span>
                    <span className="h-px w-5 bg-white/25" />
                  </motion.div>

                  <motion.h2
                    className="mt-2 text-[27px] font-extrabold leading-tight tracking-[-0.02em] text-white"
                    {...softIn(0.3)}
                  >
                    {spinResult?.title ||
                      (isWin
                        ? t("congratulations") || "Congratulations!"
                        : t("better_luck_next_time") || "Better luck next time")}
                  </motion.h2>

                  <motion.p
                    className="mx-auto mt-1.5 max-w-[250px] text-[13px] leading-snug text-white/65"
                    {...softIn(0.36)}
                  >
                    {resultMessage ||
                      (isWin
                        ? t("reward_added_automatically") ||
                          "Added to your account automatically."
                        : t("better_luck_next_time_detail") ||
                          "No reward this time — come back and try again soon.")}
                  </motion.p>

                  {isWin && wallet && wallet.amount > 0 && (
                    // Frosted-glass ticket, not a solid paper card: a
                    // translucent white face with blur behind it, a soft
                    // top highlight along the rim instead of a hard black
                    // outline (glass catches light on one edge, an even
                    // border everywhere read as a plain outline), and a
                    // wider, softer drop so it still lifts off the dark
                    // card behind it without the previous hard-edged
                    // cartoon shadow.
                    <motion.div
                      className="relative mt-4 overflow-hidden rounded-[14px] px-4 py-4"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82))",
                        backdropFilter: "blur(18px)",
                        WebkitBackdropFilter: "blur(18px)",
                        boxShadow: [
                          "inset 0 1px 0 rgba(255,255,255,0.9)",
                          "inset 0 0 0 1px rgba(255,255,255,0.5)",
                          "0 10px 24px -8px rgba(0,0,0,0.45)",
                          "0 2px 6px rgba(0,0,0,0.25)",
                        ].join(", "),
                      }}
                      {...softIn(0.42)}
                    >
                      {/* Notches punched into the glass — tinted to the
                          brand colour like before, but softened with a
                          blur of their own so they read as part of the
                          same frosted material rather than a flat disc
                          pasted over it. */}
                      <span
                        aria-hidden
                        className="absolute -left-[13px] top-1/2 h-[26px] w-[26px] -translate-y-1/2 rounded-full"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary-color) 30%, #1A1A1A)",
                          backdropFilter: "blur(6px)",
                          WebkitBackdropFilter: "blur(6px)",
                        }}
                      />
                      <span
                        aria-hidden
                        className="absolute -right-[13px] top-1/2 h-[26px] w-[26px] -translate-y-1/2 rounded-full"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary-color) 30%, #1A1A1A)",
                          backdropFilter: "blur(6px)",
                          WebkitBackdropFilter: "blur(6px)",
                        }}
                      />
                      <p
                        className="text-[32px] font-black leading-none"
                        style={{ color: "var(--primary-color)" }}
                      >
                        +{formatCurrency(wallet.amount, currency, decimals)}
                      </p>
                      <p className="mt-2 flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-[#3C3C3C]">
                        <RiWallet3Line size={13} />
                        {t("cashback_added_to_wallet") ||
                          "Added to your wallet after this order"}
                      </p>
                    </motion.div>
                  )}

                  {isWin && promo && (
                    <motion.div className="mt-4" {...softIn(0.42)}>
                      {/* Coupon ticket — a dark translucent pill sitting ON
                          the card rather than a white ticket laid over it:
                          centred small-caps caption above a large white
                          code, a faint light rim, and nothing else at rest.
                          The scissors, the dashed tear, the stub notches and
                          the permanent copy icon are all gone — they were
                          ticket-stub language this shape doesn't use, and
                          they crowded the one thing that matters (the code).
                          Copy is revealed on hover/focus instead. */}
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="group relative block w-full rounded-[18px] px-5 py-3 text-center transition active:translate-y-[1px]"
                        style={{
                          // Darker than the card behind it, not lighter —
                          // the pill reads as a recess in the card's own
                          // surface. Brand-tinted so it stays on-palette for
                          // any white-label client.
                          background:
                            "color-mix(in srgb, var(--primary-color) 22%, rgba(0,0,0,0.55))",
                          backdropFilter: "blur(12px)",
                          WebkitBackdropFilter: "blur(12px)",
                          boxShadow: [
                            // Faint light rim — the reference's border is a
                            // soft highlight, not a drawn 1px line.
                            "inset 0 0 0 1px rgba(255,255,255,0.18)",
                            "inset 0 1px 0 rgba(255,255,255,0.14)",
                            "0 8px 20px -10px rgba(0,0,0,0.5)",
                          ].join(", "),
                        }}
                      >
                        {/* Resting state: caption + code. Fades OUT on hover
                            so the copy prompt can take the same space —
                            overlaying the two printed the copy label
                            straight over the code and made both
                            unreadable. */}
                        <span className="block transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
                            {t("couponCode") || t("coupon_code") || "Coupon Code"}
                          </span>
                          {/* The code is the hero here — large, white,
                              centred, and never truncated: it wraps on
                              character boundaries if it has to, since an
                              ellipsis would hide exactly the characters the
                              user needs. */}
                          <span className="mt-1 block break-all text-[21px] font-black uppercase leading-[1.15] tracking-[0.06em] text-white">
                            {promo.promo_code}
                          </span>
                        </span>

                        {/* Copy prompt — absolutely positioned over the
                            pill's full box so it centres on the same area
                            the code occupied, and so revealing it can't
                            change the pill's height. */}
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <RiFileCopyLine size={16} />
                          {t("copy_code") || t("copy") || "Copy"}
                        </span>
                      </button>

                      {/* Copy confirmation, inline instead of a toast that
                          covers the card. */}
                      <AnimatePresence>
                        {copied && (
                          <motion.div
                            className="flex justify-center overflow-hidden"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.28, ease: SOFT_EASE }}
                          >
                            {/* Same dark chip as the spins line — an emerald
                                tint reads as invisible on the brand-coloured
                                card behind it. */}
                            <span
                              className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold text-white"
                              style={{
                                background: "rgba(0,0,0,0.3)",
                                boxShadow:
                                  "inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 45%, #fff)",
                              }}
                            >
                              <RiCheckboxCircleFill size={13} />
                              {t("copied_to_clipboard") || "Copied to clipboard!"}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </motion.div>
                  )}

                  {/* Spins-remaining line — gives the (otherwise very sparse)
                      lose card something useful to say and nudges a retry. */}
                  {!isWin && data.spins?.spins_per_day > 0 && (
                    <motion.div className="mt-3" {...softIn(0.5)}>
                      {/* Out of spins with a live clock: the same tile row the
                          wheel view uses, in its compact size. Anything else
                          is a single line of copy, so it stays a chip. */}
                      {!data.spins.can_spin &&
                      nextSpinCountdown &&
                      !nextSpinCountdown.finished ? (
                        <SpinCountdown countdown={nextSpinCountdown} compact />
                      ) : (
                        <p
                          // Dark fill and white text: the card behind this is
                          // the brand colour at full strength, so the old light
                          // chip (bg-black/[0.04] + primary-coloured text) had
                          // almost no contrast and the line disappeared.
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold text-white"
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            boxShadow:
                              "inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 45%, #fff)",
                          }}
                        >
                          <FiClock size={12} />
                          {data.spins.can_spin
                            ? `${data.spins.remaining_today} ${t("spins_left") || "spins left"}`
                            : nextSpinCountdown?.finished
                              ? t("spin_available_now") ||
                                "Spin available — refresh"
                              : t("no_spins_left") || "No spins left today"}
                        </p>
                      )}
                    </motion.div>
                  )}

                  {/* CTAs — a win offers "Shop now" alongside another spin, so
                      the coupon can be used immediately; a loss only offers
                      the retry. */}
                  {/* Both CTAs share the badge shell: a bright clipped rim with
                      a DARK face clipped to the same polygon just inside it,
                      per the reference — the brand colour is the outline, not
                      the fill, which is what lets the badge read against the
                      card's own brand-tinted body instead of merging into it. */}
                  {/* Straddles the card's bottom edge rather than sitting
                      inside it, per the reference — the negative margin pulls
                      it half out, and both wrappers above run overflow-visible
                      so it isn't clipped there. z-20 keeps it over the rim. */}
                  <motion.div
                    // -mb is half the button's own height (~48px) PLUS the
                    // well's and the card's bottom padding below it (4 + 3),
                    // so the row's centre line lands exactly on the card's
                    // bottom rim rather than above it.
                    // Inset from the card's sides, per the reference — the
                    // badge is a narrower shape centred on the bottom rim, not
                    // a full-bleed bar whose tips meet the side borders.
                    className="relative z-20 mx-auto -mb-[50px] mt-5 flex w-full gap-2"
                    {...softIn(0.54)}
                  >
                    {/* ONE button that changes role: another spin while any
                        remain, otherwise "Shop Now". Out of spins the card
                        used to end with no action at all, which left it
                        looking unfinished and gave the user nowhere to go. */}
                    {(() => {
                      const canSpinAgain = Boolean(data.spins?.can_spin);
                      return (
                      <button
                        type="button"
                        onClick={
                          canSpinAgain
                            ? handleSpinAgain
                            : () => {
                                onNavigateAway?.();
                                router.push(zoneHref("/products"));
                              }
                        }
                        className="group relative flex flex-1 transition active:scale-[0.985] [filter:drop-shadow(0_5px_5px_rgba(0,0,0,0.5))]"
                        style={{
                          clipPath: HEX,
                          // Full-strength rim: this is the card's only action
                          // now, so it no longer steps down to a secondary
                          // treatment on a win.
                          background:
                            "linear-gradient(180deg, color-mix(in srgb, var(--primary-color) 45%, #fff), var(--primary-color))",
                        }}
                      >
                        <span
                          className="flex flex-1 items-center justify-center gap-2 py-3 whitespace-nowrap text-[13px] font-bold text-white transition group-hover:brightness-125"
                          style={{
                            clipPath: HEX,
                            // Wider on X than Y: the ends are points, so an
                            // even inset leaves the inner tip protruding past
                            // the rim's own.
                            margin: "3px 8px",
                            background:
                              "color-mix(in srgb, var(--primary-color) 18%, #0B0B0B)",
                          }}
                        >
                          {canSpinAgain ? (
                            <>
                              <RiRefreshLine size={16} />
                              {t("spin_again") || "Spin Again"}
                            </>
                          ) : (
                            <>
                              <RiShoppingBag3Line size={16} />
                              {t("shop_now") || "Shop Now"}
                            </>
                          )}
                        </span>
                      </button>
                      );
                    })()}
                  </motion.div>
                </div>
                </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Login
        showLogin={showLogin}
        setShowLogin={setShowLogin}
        setMobileActiveKey={() => {}}
      />
    </div>
  );
};

export default SpinWinPanel;
