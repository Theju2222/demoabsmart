"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { setPendingPromoCode } from "@/redux/slices/cartSlice";
import {
  RiFileCopyLine,
  RiWallet3Line,
  RiCoupon3Line,
  RiCheckboxCircleFill,
} from "react-icons/ri";
import {
  FiGift,
  FiTruck,
  FiArrowRight,
  FiCheck,
  FiCalendar,
  FiClock,
  FiScissors,
} from "react-icons/fi";
import { GoTrophy } from "react-icons/go";
import { PiSpinnerBallThin } from "react-icons/pi";
import { t } from "@/utils/translation";
import useCurrency from "@/hooks/useCurrency";
import { formatCurrency } from "@/utils/helperFunction";
import useZoneHref from "@/hooks/useZoneHref";
import { useSpinWheelRewards } from "@/hooks/useSpinWheelRewards";
import useInViewFetch from "@/hooks/useInViewFetch";
import type { SpinWheelReward } from "@/types/spinWin";

interface SpinWinRewardsContentProps {
  latitude?: number | string;
  longitude?: number | string;
  /** Called before a Shop Now navigation — a modal caller closes itself here;
   * a page caller (no surrounding overlay to close) can leave this a no-op. */
  onBeforeNavigate?: () => void;
}

// Per reward_type accent. Every card uses the SAME white/ink value panel
// (plain white ground, tinted icon circle, colored value text) — this hex is
// the one thing that differs per type, driving the icon tint, the value
// text, the Use pill and the code chip.
//
// Deliberately NOT a solid gradient-filled panel: coupons dominate a typical
// rewards list, so a filled panel per card turned the whole page into a wall
// of the tenant's brand color. The white panel keeps every card light no
// matter how many of one type stack up.
//
// Every reward type uses the tenant's own --primary-color (this template
// ships per client) — only the icon differs per type, the color itself no
// longer encodes which kind of reward it is.
interface RewardPalette {
  solid: string;
  chipBg: string;
  chipBorder: string;
  icon: React.ReactNode;
}

const THEME_PALETTE_BASE = {
  solid: "var(--primary-color)",
  chipBg: "color-mix(in srgb, var(--primary-color) 6%, transparent)",
  chipBorder: "color-mix(in srgb, var(--primary-color) 35%, transparent)",
};

const COUPON_PALETTE: RewardPalette = {
  ...THEME_PALETTE_BASE,
  icon: <RiCoupon3Line size={20} />,
};

const FREE_DELIVERY_PALETTE: RewardPalette = {
  ...THEME_PALETTE_BASE,
  icon: <FiTruck size={20} />,
};

const WALLET_PALETTE: RewardPalette = {
  ...THEME_PALETTE_BASE,
  icon: <RiWallet3Line size={20} />,
};

const FALLBACK_PALETTE: RewardPalette = {
  ...THEME_PALETTE_BASE,
  icon: <FiGift size={20} />,
};

const paletteFor = (rewardType: string): RewardPalette => {
  if (rewardType === "free_delivery") return FREE_DELIVERY_PALETTE;
  if (rewardType === "wallet") return WALLET_PALETTE;
  if (rewardType === "promo_code") return COUPON_PALETTE;
  return FALLBACK_PALETTE;
};

// Status pill copy/colors. Expiring is "within 3 days of end_date" — near
// enough that nudging the user is useful, far enough that it isn't noise.
const EXPIRING_SOON_DAYS = 3;

const RewardCard = ({
  reward,
  palette,
  onBeforeNavigate,
}: {
  reward: SpinWheelReward;
  palette: RewardPalette;
  onBeforeNavigate?: () => void;
}) => {
  const { currency, decimals } = useCurrency();
  const router = useRouter();
  const zoneHref = useZoneHref();
  const dispatch = useDispatch();
  const [copied, setCopied] = React.useState(false);
  // Date.now() can't run during render (React Compiler purity rule) — seeded
  // once via a lazy useState initializer instead. "Expiring soon" is a
  // days-out threshold, not a live clock, so staleness across re-renders
  // (until the card next mounts) is fine.
  const [now] = React.useState(() => Date.now());
  const promo = reward.promo_code;

  // The value panel's big number, split into value + unit so each can be
  // sized separately (a huge "₹" or "%" beside the digits looks wrong).
  //
  // A "percentage" row with discount: 0 (seen live — only max_discount_amount
  // set) falls back to that cap as a flat amount instead of a meaningless 0%.
  let value = "";
  let unit = "";
  if (reward.reward_type === "wallet") {
    value = formatCurrency(reward.amount, currency, decimals);
    unit = t("cash") || "CASH";
  } else if (promo?.discount_type === "free_delivery") {
    value = t("free") || "Free";
    unit = t("delivery") || "DELIVERY";
  } else if (promo?.discount_type === "flat") {
    value = formatCurrency(promo.discount, currency, decimals);
    unit = t("off") || "OFF";
  } else if (promo && promo.discount > 0) {
    value = `${promo.discount}%`;
    unit = t("off") || "OFF";
  } else if (promo && promo.max_discount_amount > 0) {
    value = formatCurrency(promo.max_discount_amount, currency, decimals);
    unit = t("off") || "OFF";
  }

  // A code past its own end_date can't be applied — no copy/use actions for
  // it (avoids sending the user to checkout with a code that'll be rejected).
  const endDate = promo ? new Date(promo.end_date) : null;
  const isExpired = !!endDate && endDate < new Date();
  const canUseCode = !!promo && !isExpired;
  const daysLeft = endDate
    ? Math.ceil((endDate.getTime() - now) / 86_400_000)
    : null;
  const isExpiringSoon =
    !isExpired && daysLeft != null && daysLeft <= EXPIRING_SOON_DAYS;

  // Status pill — one per card, top-end corner. A wallet win is already
  // settled ("Credited"); a coupon is Expiring / Expired / Active.
  let status: {
    label: string;
    className: string;
    style?: React.CSSProperties;
    icon?: React.ReactNode;
  };
  if (reward.reward_type === "wallet") {
    status = {
      label: t("credited") || "Credited",
      className: "",
      style: {
        backgroundColor: "color-mix(in srgb, var(--primary-color) 10%, transparent)",
        color: "var(--primary-color)",
      },
      icon: <RiCheckboxCircleFill size={11} />,
    };
  } else if (isExpired) {
    status = {
      label: t("expired") || "Expired",
      className: "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400",
      icon: <FiClock size={10} />,
    };
  } else if (isExpiringSoon) {
    status = {
      label: t("expiring") || "Expiring",
      className: "bg-red-50 text-red-500 dark:bg-red-500/15",
      icon: <FiClock size={10} />,
    };
  } else {
    status = {
      label: t("active") || "Active",
      className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15",
      icon: <span className="h-1.5 w-1.5 rounded-full bg-current" />,
    };
  }

  const handleCopyCode = () => {
    if (!promo) return;
    navigator.clipboard
      .writeText(promo.promo_code)
      .then(() => {
        setCopied(true);
        toast.success(t("copied") || "Copied");
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => toast.error(t("something_went_wrong")));
  };

  // Copy the code AND jump straight to products — the whole "saw it, grabbed
  // it, ordering" flow in one tap instead of copy-then-separately-navigate.
  // Stashes the code in redux; the cart auto-applies (and validates) it as
  // soon as it has items — see usePendingCouponAutoApply.
  const handleUse = () => {
    if (!promo) return;
    dispatch(setPendingPromoCode(promo.promo_code));
    navigator.clipboard?.writeText(promo.promo_code).catch(() => {});
    toast.success(
      t("coupon_saved_for_cart") || "Coupon saved — it'll apply in your cart",
    );
    onBeforeNavigate?.();
    router.push(zoneHref("/products"));
  };

  return (
    <div
      // md:flex-row (was sm:). This card sits in a 2-column grid beside a
      // fixed profile sidebar (SpinWinRewardsTab) — the grid's own breakpoint
      // is viewport-width-based, so at a mid-size viewport the sidebar can
      // eat enough width that each grid COLUMN is well under 640px even
      // though the viewport itself is well past `sm`. That narrow column
      // still got forced into the side-by-side layout, cramming the value
      // panel + details until the title truncated and the code/Use buttons
      // overlapped. md: pushes the threshold high enough that this only
      // kicks in once the column has genuinely earned it.
      className={`flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.18)] ring-1 ring-black/[0.04] transition-shadow hover:shadow-[0_2px_4px_rgba(16,24,40,0.05),0_16px_32px_-16px_rgba(16,24,40,0.28)] dark:bg-zinc-900 dark:ring-white/10 md:flex-row ${
        isExpired ? "opacity-65" : ""
      }`}
    >
      {/* VALUE PANEL — one NEUTRAL slate tint for every reward type, not a
          per-type pastel. Tinting each panel with its own accent gave a
          stacked list three different washed-out pastels fighting each other;
          a single neutral ground lets the accent live only where it carries
          meaning (the icon and the face value) and keeps the column cohesive.
          Two punched notches plus a dashed perforation between them at the
          seam give it a torn-coupon-stub silhouette. */}
      <div className="relative flex shrink-0 items-center justify-center gap-3 bg-slate-50 px-4 py-3 dark:bg-zinc-800/60 md:w-[120px] md:flex-col md:gap-2 md:px-1.5 md:py-5">
        {/* notches — same color as the card body so they read as bites taken
            out of the seam between panel and details. Side-stub silhouette
            only makes sense once the panel IS a side stub (sm+); below that
            it's a plain top strip, so the cut/perforation marks stay hidden. */}
        <span className="absolute -end-[7px] -top-[7px] hidden h-[14px] w-[14px] rounded-full bg-white dark:bg-zinc-900 sm:block" />
        <span className="absolute -bottom-[7px] -end-[7px] hidden h-[14px] w-[14px] rounded-full bg-white dark:bg-zinc-900 sm:block" />
        {/* perforation — dashed tear line between the two notches, inset from
            each so it doesn't collide with the punched circles. A 1px-wide
            span with a dashed border-inline-end (not a bare `border-e`
            utility, which needs an explicit width class alongside it to
            actually paint) — renders as a vertical dashed rule regardless of
            LTR/RTL. */}
        <span className="absolute end-0 top-[10px] bottom-[10px] hidden w-px border-e border-dashed border-black/20 dark:border-white/20 sm:block" />
        {/* Scissor mark — the classic "cut here" cue on a coupon perforation,
            sat in a small notch of its own so it breaks the dashed line
            cleanly instead of overlapping a dash. */}
        <span className="absolute -end-[10px] top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-slate-50 text-slate-400 rtl:-scale-x-100 dark:bg-zinc-800/60 dark:text-zinc-500 sm:flex">
          <FiScissors size={11} className="rotate-90" />
        </span>

        <span
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_6px_rgba(16,24,40,0.10)] dark:bg-zinc-800 sm:h-[52px] sm:w-[52px]"
          style={{ color: palette.solid }}
        >
          {reward.icon_url ? (
            <span className="relative block h-6 w-6 sm:h-7 sm:w-7">
              <Image
                src={reward.icon_url}
                alt=""
                fill
                sizes="28px"
                className="object-contain"
                unoptimized
              />
            </span>
          ) : (
            <span className="[&>svg]:h-5 [&>svg]:w-5 sm:[&>svg]:h-6 sm:[&>svg]:w-6">
              {palette.icon}
            </span>
          )}
        </span>

        <span className="relative flex flex-col items-center gap-0.5">
          <span
            className="text-[20px] font-black leading-none tracking-tight sm:text-[24px]"
            style={{ fontVariantNumeric: "tabular-nums", color: palette.solid }}
          >
            {value}
          </span>
          {unit && (
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
              {unit}
            </span>
          )}
        </span>
      </div>

      {/* DETAILS — title + status pill, meta line, code strip, validity. */}
      <div className="@container flex min-w-0 flex-1 flex-col justify-center gap-2.5 px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold leading-tight textColor">
              {reward.label}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] SecondaryTextColor">
              <FiCalendar size={11} className="shrink-0 opacity-70" />
              {reward.won_at_label}
              {promo?.minimum_order_amount ? (
                <>
                  <span className="opacity-40">•</span>
                  <span className="whitespace-nowrap">
                    {t("minimum_order") || "Min order"}{" "}
                    <span className="font-semibold textColor">
                      {formatCurrency(
                        promo.minimum_order_amount,
                        currency,
                        decimals,
                      )}
                    </span>
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold ${status.className}`}
            style={status.style}
          >
            {status.icon}
            {status.label}
          </span>
        </div>

        {/* Stacks on a narrow card (@container) so the full code shows
            instead of truncating beside the Use button. */}
        {promo && canUseCode && (
          <div className="flex flex-col items-stretch gap-2 @[300px]:flex-row">
            <button
              type="button"
              onClick={handleCopyCode}
              className="group/code flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 transition-colors hover:brightness-[0.97]"
              style={{
                borderColor: palette.chipBorder,
                backgroundColor: palette.chipBg,
              }}
            >
              <span
                className="truncate text-[12.5px] font-extrabold uppercase tracking-[0.08em]"
                style={{ color: palette.solid }}
              >
                {promo.promo_code}
              </span>
              {copied ? (
                <FiCheck size={13} className="shrink-0 text-emerald-500" />
              ) : (
                <RiFileCopyLine
                  size={13}
                  className="shrink-0 opacity-50 transition-opacity group-hover/code:opacity-80"
                  style={{ color: palette.solid }}
                />
              )}
            </button>

            <button
              type="button"
              onClick={handleUse}
              className="group/cta flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-bold text-white shadow-sm transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: palette.solid }}
            >
              {t("use") || "Use"}
              <FiArrowRight
                size={12}
                className="transition-transform group-hover/cta:translate-x-0.5"
              />
            </button>
          </div>
        )}

        {promo && (
          <p
            className={`truncate text-[11px] ${
              isExpired
                ? "font-semibold text-[#DB3D26]"
                : "SecondaryTextColor"
            }`}
          >
            {isExpired
              ? `${t("expired") || "Expired"} · ${promo.end_date_label}`
              : `${t("valid_till") || "Valid till"} ${promo.end_date_label}`}
          </p>
        )}

        {reward.reward_type === "wallet" && (
          <p className="truncate text-[11px] SecondaryTextColor">
            {t("cashback_added_to_wallet") || "Added to your wallet"}
          </p>
        )}
      </div>
    </div>
  );
};

// Shared body — hero summary bar + reward grid. No chrome of its own:
// SpinWinRewardsTab wraps it as a normal ProfileDashboard tab panel (sidebar
// stays visible, only this swaps in), so the "My Rewards" page and any other
// future embedding share one implementation instead of drifting.
// Filter chips — "reward_type" narrows the list to one kind. Values must
// match the API's own reward_type strings exactly (see getSpinWheelRewards).
const FILTERS: { value: string; key: string; fallback: string }[] = [
  { value: "", key: "all_rewards", fallback: "All" },
  { value: "promo_code", key: "coupons", fallback: "Coupons" },
  { value: "wallet", key: "wallet_credit", fallback: "Wallet" },
  { value: "free_delivery", key: "free_delivery", fallback: "Free Delivery" },
];

const SpinWinRewardsContent = ({
  latitude,
  longitude,
  onBeforeNavigate,
}: SpinWinRewardsContentProps) => {
  const { currency, decimals } = useCurrency();
  const [activeFilter, setActiveFilter] = React.useState("");
  const {
    rewards,
    summary,
    isLoading,
    isLoadingMore,
    isError,
    hasMore,
    loadMore,
  } = useSpinWheelRewards({
    latitude,
    longitude,
    rewardType: activeFilter || undefined,
  });

  // Sentinel-based, not whole-page-height-based: this tab renders inside the
  // profile dashboard page, with other content and a footer below it — a
  // whole-page scroll percentage lands wherever 70% of EVERYTHING falls,
  // often well past this list's own end. A sentinel at the list's own last
  // row fires independent of what's below it.
  const loadMoreSentinelRef = useInViewFetch({
    enabled: hasMore && !isLoadingMore && !isLoading,
    onLoadMore: loadMore,
  });

  return (
    <div className="bg-[color-mix(in_srgb,var(--primary-color)_4%,#fff)] p-3 sm:p-4 dark:bg-zinc-950">
      {/* Filter chips — narrows the list to one reward_type via the API's own
          param, not a client-side filter, so it works together with
          pagination instead of just hiding already-loaded rows. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setActiveFilter(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
                isActive
                  ? "text-white"
                  : "bg-white text-stone-500 ring-1 ring-black/[0.06] hover:text-stone-700 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-white/10"
              }`}
              style={isActive ? { backgroundColor: "var(--primary-color)" } : undefined}
            >
              {t(f.key) || f.fallback}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        // xl:grid-cols-2 (was lg:) — same reasoning as the card's own
        // md:flex-row above: this grid sits beside a fixed sidebar, so at
        // `lg` (1024px) the two columns it produces are already too narrow
        // for the card's side-by-side layout. xl (1280px) is where there's
        // actually enough room left over.
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[124px] animate-pulse rounded-2xl bg-white dark:bg-zinc-900"
            />
          ))}
        </div>
      ) : isError ? (
        <p className="py-10 text-center text-sm text-[#DB3D26]">
          {t("something_went_wrong") || "Something went wrong"}
        </p>
      ) : rewards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white py-14 text-center dark:bg-zinc-900">
          <span className="flex h-16 w-16 items-center justify-center rounded-full primaryLightBack primaryColor">
            <FiGift size={26} />
          </span>
          <p className="mt-1 text-base font-bold textColor">
            {activeFilter
              ? t("no_rewards_in_filter") || "No rewards of this kind yet"
              : t("no_rewards_yet") || "No rewards yet"}
          </p>
          <p className="max-w-[280px] text-xs SecondaryTextColor">
            {t("no_rewards_yet_desc") ||
              "Spin the wheel to win coupons, wallet cash and free delivery."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {rewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                palette={paletteFor(reward.reward_type)}
                onBeforeNavigate={onBeforeNavigate}
              />
            ))}
          </div>

          {/* Sits at the true end of the loaded list — this, not the whole
              page, is what useInViewFetch watches. */}
          {hasMore && <div ref={loadMoreSentinelRef} className="h-px" />}

          {/* Pure scroll-triggered pagination. No manual button: this
              spinner is just a "still loading" indicator for whichever fetch
              the sentinel already started, not something the user needs to
              tap. */}
          {isLoadingMore && (
            <div className="mt-4 flex justify-center">
              <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-black/10 border-t-[color:var(--primary-color)] dark:border-white/10" />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SpinWinRewardsContent;
