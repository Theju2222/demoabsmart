"use client";

import React, { useId } from "react";
import { t } from "@/utils/translation";
import { openSpinWheel } from "@/components/spinwin/spinWheelEvents";

// A dedicated promo card for the profile sidebar — separate from the small
// inline "More Spins, More Rewards" pill inside SpinWinRewardsContent.tsx,
// which only ever renders alongside the rewards LIST. This is the standalone
// version shown to everyone with spin & win enabled, regardless of whether
// they've ever opened My Rewards.

// The wheel's own segment hues are FIXED, not brand-derived. This is a picture
// of a prize wheel, and a prize wheel reads as one because it's rainbow — a
// wheel rendered in shades of a single client's brand colour stops looking
// like a wheel at all. Only the CARD's own chrome (the button) follows the
// tenant hue. Same reasoning the app's other illustrative art uses. (The
// Flutter card passes `hexColor: primary` into AnimatedSpinWheel; we
// deliberately keep the web art rainbow instead.)
//
// Twelve segments, matching the Flutter card's `segmentCount: 12`, so the two
// platforms show the same wheel. The eight base hues repeat round the wheel;
// 12 % 8 != 0, so no two adjacent wedges share a colour at the wrap point.
const SEGMENT_HUES = [
  "#F0508C", // pink
  "#8B3FD9", // purple
  "#3B6FE0", // blue
  "#22B3C9", // teal
  "#57C24A", // green
  "#F2C230", // yellow
  "#F09135", // orange
  "#E14B3C", // red
];

const SEGMENT_COUNT = 12;

const CX = 36;
const CY = 36;
const R_SEGMENTS = 27;

// Rim: a thick gold ring drawn as a STROKED circle rather than two stacked
// filled circles — a stroke centres on its own radius, so the segment art
// underneath can't bleed past it at the seam the way a slightly-too-small
// inner fill would let it. Widened from 5 to 7: at the old width the band
// read as a thin outline rather than the reference's chunky gold wheel body.
const R_RIM = 30;
const RIM_W = 7;

// The bolts seated in the rim, one per segment so each sits over a wedge's
// middle rather than drifting onto seams.
const BOLTS = SEGMENT_COUNT;

// Layout, mirroring the Flutter SpinWheelPromoCard: the wheel is drawn larger
// than the card and ~70% of it shows, the rest clipped past the bottom-end
// corner. Sized off the CARD's own width (@container), not the viewport: in
// the tablet sidebar the card is ~230px, and a full 150px wheel left the copy
// a few words wide. Classes below are literal so Tailwind can see them:
//   tiny   (<260px): 80px wheel tucked beside the button only; copy uses the
//                   full width (reserving a column squeezed it to ~3 words)
//   narrow (>=260px): 96px wheel, end -29px, bottom -24px, copy pe 75px
//   wide   (>=300px): 150px wheel, end -45px, bottom -37.5px, copy pe 113px

const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
const pointOn = (r: number, deg: number) => [
  CX + r * Math.cos(toRad(deg)),
  CY + r * Math.sin(toRad(deg)),
];

const SpinWheelPromoBanner = () => {
  // Per-instance gradient ids. The sidebar is mounted twice (desktop shell +
  // mobile drawer); with fixed ids every url(#…) resolved to the FIRST copy —
  // the one hidden on mobile — so the gold rim, hub and pointer outline
  // painted nothing there.
  const uid = useId().replace(/:/g, "");
  const goldId = `promoWheelGold-${uid}`;
  const hubId = `promoWheelHub-${uid}`;
  return (
  // relative + overflow-hidden: the wheel is absolutely positioned past the
  // card's bottom-right corner and CLIPPED there. paddingInlineEnd reserves
  // the column the visible part occupies so the copy never runs under it.
  <div className="@container">
  <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm cardBorder dark:bg-zinc-900 @[260px]:pe-[75px] @[300px]:pe-[113px]">
    <div className="min-w-0">
      <p className="text-[15px] font-bold leading-tight textColor">
        {t("get_free_wallet_cash") || "Get Free Wallet Cash"}
      </p>
      <p className="mt-1 text-[12px] leading-snug SecondaryTextColor">
        {t("get_free_wallet_cash_desc") ||
          "Spin the Wheel and get free wallet cash & Surprise Discounts"}
      </p>
      <button
        type="button"
        onClick={openSpinWheel}
        // Fully rounded pill, no trailing arrow — matches the reference,
        // whose CTA is a plain rounded button with the label alone.
        className="mt-3 whitespace-nowrap rounded-full px-5 py-2 text-[13px] @[300px]:px-6 font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
        style={{ backgroundColor: "var(--primary-color)" }}
      >
        {t("spin_now") || "Spin Now"}
      </button>
    </div>

    {/* Wheel — inline SVG rather than an image asset, so it stays crisp at
        any density and needs no new file.

        Anchored to the card's BOTTOM-TRAILING corner and pushed out past both
        edges, so the card's overflow-hidden clips that corner away and ~70%
        of the wheel stays visible. Negative inset-inline-end/bottom rather
        than a centred position: the clip has to come off two adjacent edges
        at once for the corner effect. Logical `end` (not `right`) so the
        wheel flips to the left edge under RTL, as the Flutter
        PositionedDirectional does. */}
    <svg
      aria-hidden
      viewBox="0 0 72 72"
      className="pointer-events-none absolute -bottom-[20px] -end-[22px] h-[80px] w-[80px] @[260px]:-bottom-[24px] @[260px]:-end-[29px] @[260px]:h-[96px] @[260px]:w-[96px] @[300px]:-bottom-[37.5px] @[300px]:-end-[45px] @[300px]:h-[150px] @[300px]:w-[150px]"
    >
      <defs>
        {/* Gold rim, lit from the top-left like the reference's. */}
        <linearGradient id={goldId} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#FFE07A" />
          <stop offset="0.45" stopColor="#F5B726" />
          <stop offset="1" stopColor="#D98E12" />
        </linearGradient>
        <linearGradient id={hubId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD84D" />
          <stop offset="1" stopColor="#F0A81E" />
        </linearGradient>
      </defs>

      {/* Segments — the only part that turns. The rim, bolts, hub and
          pointer all stay put, so it reads as the wheel spinning inside its
          housing rather than the whole illustration rotating. */}
      <g className="promoWheelSpin">
        {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
          const start = (i * 360) / SEGMENT_COUNT;
          const end = ((i + 1) * 360) / SEGMENT_COUNT;
          const [x0, y0] = pointOn(R_SEGMENTS, start);
          const [x1, y1] = pointOn(R_SEGMENTS, end);
          return (
            <path
              // Index, not the fill: with 12 wedges over 8 hues the colours
              // repeat, so a colour key would collide.
              key={i}
              d={`M${CX} ${CY} L${x0} ${y0} A${R_SEGMENTS} ${R_SEGMENTS} 0 0 1 ${x1} ${y1} Z`}
              fill={SEGMENT_HUES[i % SEGMENT_HUES.length]}
            />
          );
        })}
      </g>

      {/* Rim over the segment edges */}
      <circle
        cx={CX}
        cy={CY}
        r={R_RIM}
        fill="none"
        stroke={`url(#${goldId})`}
        strokeWidth={RIM_W}
      />

      {/* Bolts around the rim */}
      {Array.from({ length: BOLTS }).map((_, i) => {
        // Offset by half a step so each bolt sits over a segment's middle
        // rather than on a seam between two.
        const [bx, by] = pointOn(R_RIM, (i * 360) / BOLTS + 360 / BOLTS / 2);
        return (
          <circle key={i} cx={bx} cy={by} r="1.5" fill="#FFF3C4" />
        );
      })}

      {/* Hub — a light ring around the gold disc, per the reference, so the
          hub reads as a separate raised cap rather than a flat yellow hole
          punched in the middle of the segments. */}
      <circle cx={CX} cy={CY} r="12.5" fill="#FFF8E1" />
      <circle
        cx={CX}
        cy={CY}
        r="10.5"
        fill={`url(#${hubId})`}
        stroke="#C8860C"
        strokeWidth="1"
      />
      <text
        x={CX}
        y={CY + 2.6}
        textAnchor="middle"
        fontSize="7"
        fontWeight="900"
        letterSpacing="0.2"
        fill="#7A4A00"
      >
        SPIN
      </text>

      {/* Pointer — on the wheel's upper arc, 45° off vertical toward the side
          the wheel is clipped on, so it always sits over visible wheel. The
          attribute here is the LTR case (-45°, upper-left); under RTL
          .promoWheelPointer flips it to +45° in globals.css, matching the
          Flutter card's `pointerAngle` directionality check — a transform
          attribute alone can't branch on direction.
          Pale fill with a heavy gold outline (not a solid gold arrowhead),
          and it points INWARD: apex toward the hub, base out past the rim. */}
      <g className="promoWheelPointer" transform={`rotate(-45 ${CX} ${CY})`}>
        <path
          d={`M${CX} ${CY - R_RIM + 5} L${CX + 6} ${CY - R_RIM - 5} L${CX - 6} ${CY - R_RIM - 5} Z`}
          fill="#FFF3C4"
          stroke={`url(#${goldId})`}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  </div>
  </div>
  );
};

export default SpinWheelPromoBanner;
