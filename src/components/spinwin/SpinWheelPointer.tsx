"use client";

import { motion } from "framer-motion";

interface SpinWheelPointerProps {
  /** theme.pointer_color — the triangle's fill. */
  backgroundColor?: string;
  /** Wobbles the pointer while the wheel is spinning. */
  spinning?: boolean;
}

// Flat-topped triangle pointer (96:61 reference proportions), corners rounded.
const W = 48;
const H = 30.5;
const CORNER_RADIUS = 5;

// Closed path through `pts` with each corner replaced by a quadratic curve
// starting/ending `r` along its two edges.
const roundedPolygonPath = (pts: [number, number][], r: number) => {
  const n = pts.length;
  const toward = (a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const d = Math.min(r, len / 2);
    return [a[0] + (dx / len) * d, a[1] + (dy / len) * d];
  };
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const start = toward(cur, prev);
    const end = toward(cur, next);
    d += `${i === 0 ? "M" : "L"} ${start[0]} ${start[1]} Q ${cur[0]} ${cur[1]} ${end[0]} ${end[1]} `;
  }
  return `${d}Z`;
};

const POINTER_PATH = roundedPolygonPath(
  [
    [0, 0],
    [W, 0],
    [W / 2, H],
  ],
  CORNER_RADIUS,
);

// PALETTE: brand-derived. The template ships white-label, so the pointer's
// fallback fill (used when the campaign's theme.pointer_color is unset) is a
// mix of var(--primary-color) rather than the reference's fixed gold — a
// hardcoded hue would only ever match one client.
const BG_FALLBACK = "color-mix(in srgb, var(--primary-color) 42%, #fff)";
// The shade anchor for the fill gradient's bottom stop. Was a fixed dark amber
// (#8A5A00) picked to sit under the gold; now it's primary driven well dark, so
// the bottom stop stays a deeper tone of whatever fill is in play.
const SHADE_ANCHOR = "color-mix(in srgb, var(--primary-color) 30%, #0A0A0A)";

const SpinWheelPointer = ({
  backgroundColor,
  spinning = false,
}: SpinWheelPointerProps) => {
  const bg = backgroundColor || BG_FALLBACK;
  // Outline is a lighter TINT of the pointer's own fill, not the wheel's rim
  // colour — a border that's just pointer_color mixed toward white reads as
  // "same colour, slightly light" rather than a mismatched trim.
  const stroke = `color-mix(in srgb, ${bg} 55%, #fff)`;

  return (
    <div
      className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2"
      // Overlaps the wheel's bezel by roughly a third of its height, so the
      // tip sits over the rim rather than floating above it.
      style={{ top: -24 }}
    >
      <motion.svg
        // Padded viewBox: the blurred shadow copy spreads past the raw path
        // bounds, and needs room on every side or it clips at the SVG's own
        // edge — which is what produced a hard rectangular cut across the
        // shadow instead of it fading out naturally.
        width={W + 20}
        height={H + 20}
        viewBox={`-10 -10 ${W + 20} ${H + 20}`}
        fill="none"
        // Swings about the top centre, so the tip sweeps side to side the way
        // a real pointer flicks over the pegs.
        style={{ originX: "50%", originY: "0%" }}
        animate={spinning ? { rotate: [-8, 8, -8] } : { rotate: 0 }}
        transition={
          spinning
            ? { duration: 0.25, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.25 }
        }
      >
        <defs>
          <linearGradient id="swpPointerFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`color-mix(in srgb, ${bg} 45%, #fff)`} />
            <stop offset="0.5" stopColor={bg} />
            <stop
              offset="1"
              stopColor={`color-mix(in srgb, ${bg} 78%, ${SHADE_ANCHOR})`}
            />
          </linearGradient>
          {/* A generous filter region — the default is a tight box around the
              shape, and a blur bleeding past a tight box gets hard-cut at its
              edge rather than fading out. That's what produced a rectangular
              patch under the pointer instead of a soft, tip-shaped shadow. */}
          <filter id="swpPointerBlur" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>
        {/* A soft, blurred dark duplicate sitting slightly below the pointer —
            the reference draws its shadow as its own filled copy of the same
            path (offset down, blurred, semi-opaque), not as a CSS drop-shadow
            filter on the coloured shape. That reads as the pointer casting a
            shadow onto the wheel behind it, rather than the whole pointer
            glowing. */}
        <path
          d={POINTER_PATH}
          transform="translate(0, 5)"
          fill="#1e0e50"
          opacity="0.55"
          filter="url(#swpPointerBlur)"
        />
        <path
          d={POINTER_PATH}
          fill="url(#swpPointerFill)"
          stroke={stroke}
          // Thin, per the reference — a heavy stroke on a shape this small
          // reads as a cartoon outline rather than a trim edge.
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </motion.svg>
    </div>
  );
};

export default SpinWheelPointer;
