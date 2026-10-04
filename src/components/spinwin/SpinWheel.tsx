"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent } from "framer-motion";
import Image from "next/image";
import { FiVolume2, FiVolumeX } from "react-icons/fi";
import { FaStar } from "react-icons/fa";
import SpinWheelPointer from "./SpinWheelPointer";
import type { SpinWheelSegment, SpinWheelTheme } from "@/types/spinWin";

interface SpinWheelProps {
  segments: SpinWheelSegment[];
  selectedSegment: SpinWheelSegment | null;
  /** -0.5..0.5, rolled by the caller ONCE per spin (in the click handler, not
   * render — Math.random() can't run inside this component's render/memo
   * under the React Compiler's purity rule). Scaled against segmentAngle
   * below to land somewhere other than dead-center in the slice. */
  jitter?: number;
  spinning: boolean;
  /** Bumped by the parent on every spin to retrigger the rotate animation. */
  spinToken: number;
  onSpinComplete: () => void;
  /** Only greys the hub dome out when false — the hub is decorative now, the
   * stand's SPIN key is the sole trigger. */
  canSpin: boolean;
  /** campaign.theme from the API — pointer/border color, kept optional since
   * a client may not set one (falls back to the gold styling below). */
  theme?: SpinWheelTheme;
  /** Ratchet click, fired once per segment the pointer crosses. */
  onTick?: () => void;
  muted?: boolean;
  onToggleMuted?: () => void;
}

// Extra full turns before landing, so the wheel always feels like it's
// building speed rather than just rotating straight to the target slice.
const EXTRA_TURNS = 6;
const BULB_COUNT = 24;

// PALETTE: brand-derived. The template ships white-label, so the wheel's own
// fallback colours (used whenever the campaign's API theme leaves a slot
// empty) are mixes of var(--primary-color) rather than the reference's fixed
// gold/green. Each mix keeps the step it replaces: lighter than primary =
// mixed toward #fff, darker = mixed toward #0A0A0A. Pure white/near-white
// specular highlights, black shadows and the disabled greys are state colours
// and stay fixed.
const P = "var(--primary-color)";
const mixLight = (n: number) => `color-mix(in srgb, ${P} ${n}%, #fff)`;
const mixDark = (n: number) => `color-mix(in srgb, ${P} ${n}%, #0A0A0A)`;
// The bezel's machined ring, alternating light/dark stops of one hue. Replaces
// the signature gold ramp (#E7B23A / #FFF0B8 / #E0A21C / #FFE07A / #C98A12)
// stop for stop, in the same order and with the same light-dark alternation.
const BEZEL_BASE = mixLight(60);
const BEZEL_HI = mixLight(22);
const BEZEL_LO = mixDark(88);
const BEZEL_HI_2 = mixLight(38);
const BEZEL_LO_2 = mixDark(72);
// The bezel's inner bottom shade — a deep warm tone of the bezel itself (was
// rgba(146,94,4,0.5)), so it follows primary too.
const BEZEL_INNER_SHADE = `color-mix(in srgb, ${mixDark(60)} 50%, transparent)`;
// The dark socket each bulb is seated in: two very dark tones of the bezel
// hue (was #5a4515 -> #2b1f08).
const SOCKET_LIT = mixDark(34);
const SOCKET_DEEP = mixDark(18);
// The bulbs' own glow. The bulb face itself stays #FFFBEA — a lit filament is
// near-white in any brand — but the halo around it carries the hue (was
// rgba(255,236,150,0.9)).
const BULB_GLOW = `color-mix(in srgb, ${mixLight(14)} 90%, transparent)`;
// The hub dome, lightest-to-darkest (was #35C97C -> #10935A -> #0B6B41).
const HUB_HI = mixLight(45);
const HUB_MID = mixDark(92);
const HUB_LO = mixDark(66);

const SpinWheel = ({
  segments,
  selectedSegment,
  jitter = 0,
  spinning,
  spinToken,
  onSpinComplete,
  canSpin,
  theme,
  onTick,
  muted,
  onToggleMuted,
}: SpinWheelProps) => {
  const segmentAngle = 360 / (segments.length || 1);

  // Ticks are driven off the ACTUAL animated rotation rather than a timer of
  // our own: framer owns the easing curve, so reading its value is the only
  // way the clicks stay locked to the wheel as it slows down. One click per
  // segment boundary the pointer crosses.
  const rotation = useMotionValue(0);
  const lastTickSegment = useRef(0);
  useMotionValueEvent(rotation, "change", (deg) => {
    if (!onTick || !spinning) return;
    const crossed = Math.floor(deg / segmentAngle);
    if (crossed !== lastTickSegment.current) {
      lastTickSegment.current = crossed;
      onTick();
    }
  });
  useEffect(() => {
    if (spinning) lastTickSegment.current = Math.floor(rotation.get() / segmentAngle);
  }, [spinning, spinToken, rotation, segmentAngle]);

  // Angle (from 12 o'clock, clockwise) that the pointer must land on to sit
  // in the middle of the selected segment's slice.
  const targetRotation = useMemo(() => {
    if (!selectedSegment) return 0;
    const index = segments.findIndex((s) => s.id === selectedSegment.id);
    if (index === -1) return 0;
    const sliceCenter = index * segmentAngle + segmentAngle / 2;
    // Rotate the wheel so that slice center ends up under the fixed top
    // pointer (0deg). `jitter` (-0.5..0.5, rolled by the caller per spin)
    // keeps every spin from looking pixel-identical while still landing
    // solidly inside the slice.
    return 360 * EXTRA_TURNS - sliceCenter - jitter * (segmentAngle * 0.4);
  }, [selectedSegment, segments, segmentAngle, jitter]);

  // Where the wheel sits when not spinning. Starts on the CENTRE of the first
  // slice (rotation 0 put a divider under the pointer), then keeps whatever
  // angle the last spin landed on instead of snapping back to 0 — the snap
  // was what left the pointer resting on a line between two segments.
  const [landedRotation, setLandedRotation] = useState<number | null>(null);
  const restRotation = landedRotation ?? 360 - segmentAngle / 2;

  const conicGradient = useMemo(() => {
    if (segments.length === 0) return undefined;
    const stops = segments.map((s, i) => {
      const from = i * segmentAngle;
      const to = from + segmentAngle;
      return `${s.color} ${from}deg ${to}deg`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [segments, segmentAngle]);

  // More segments -> a narrower slice at any given radius, so the label/icon
  // block has to shrink to fit or it visually bleeds into the neighboring
  // slice (the reported bug: "No Luck" and "Wallet Amount" overlapping on an
  // 8-segment wheel). Scaled relative to a 6-segment wheel — this wheel's
  // icon/font sizes were originally tuned against — rather than to an
  // absolute segment count, so 4-5 segments stay at their existing (already
  // correct) size instead of getting needlessly enlarged.
  const REFERENCE_SEGMENT_COUNT = 6;
  const densityScale = Math.min(
    1,
    REFERENCE_SEGMENT_COUNT / (segments.length || REFERENCE_SEGMENT_COUNT),
  );

  // How wide the label block is allowed to be, derived from the wedge's OWN
  // geometry rather than a flat constant. A wedge is a triangle: its width at
  // radius r is 2*r*tan(halfAngle), so the same pixel width that fits a 4-slice
  // wheel overflows a 7-slice one — which is the bug where a long label ran out
  // past its own colour into the neighbouring slice.
  //
  // LABEL_RADIUS is the radius of the label's INNERMOST point — where its
  // wedge is narrowest and therefore what actually constrains the width — as a
  // fraction of the wheel's radius.
  //
  // The block is positioned mt-[9%] from the top of the wheel's box, so its
  // top edge sits at radius 0.5 - 0.09 = 0.41 of the WIDTH = 0.82 of the
  // RADIUS. The icon takes the first ~17cqw of that, putting the text's own
  // top edge nearer 0.45. Measuring at 0.42 keeps the estimate on the safe
  // side of wherever the text actually lands. (An earlier 0.55 measured from
  // the wrong reference and came out far too wide — the origin of the bug
  // where a long label ran past its own wedge into the neighbouring slice.)
  const LABEL_RADIUS = 0.42;
  // Extra margin so glyphs never touch the divider line.
  const SAFE = 0.8;
  const halfAngleRad = (segmentAngle / 2) * (Math.PI / 180);
  // *100 because cqw is a percentage of the wheel's WIDTH (= 2 radii), so a
  // fraction-of-radius becomes that same fraction of 50cqw.
  const labelMaxWidth = Math.min(
    34,
    2 * LABEL_RADIUS * Math.tan(halfAngleRad) * SAFE * 50,
  );

  const pointerColor = theme?.pointer_color;
  // The wheel's outer RIM ring only, now — dividers/inner ring/disc edge moved
  // to their own line_color below. Previously border_color did both jobs.
  const borderColor = theme?.border_color;
  // Dividers between wedges, the inner ring, and the centre disc's edge.
  const lineColor = theme?.line_color;
  // The bezel's own conic-gradient (multiple light/dark stops of one hue) is
  // what gives it a machined, 3D edge — a flat outline in border_color read
  // as a separate ring stacked outside the wheel instead of part of it. When
  // the API sends a border_color, recolor those SAME stops to that hue
  // (mixing with white/black for the light/dark stops) so the machined look
  // survives; no border_color falls back to the site's own brand colour, mixed
  // the same way (see BEZEL_* above) rather than to a fixed gold.
  const bezelGradient = borderColor
    ? `conic-gradient(from 180deg, ${borderColor}, color-mix(in srgb, ${borderColor} 55%, #fff), color-mix(in srgb, ${borderColor} 80%, #000), color-mix(in srgb, ${borderColor} 60%, #fff), color-mix(in srgb, ${borderColor} 85%, #000), color-mix(in srgb, ${borderColor} 55%, #fff), ${borderColor})`
    : `conic-gradient(from 180deg, ${BEZEL_BASE}, ${BEZEL_HI}, ${BEZEL_LO}, ${BEZEL_HI_2}, ${BEZEL_LO_2}, ${BEZEL_HI}, ${BEZEL_BASE})`;
  // "glossy" (default, matches the wheel's original look) shows the sheen/
  // shading overlay below; "flat" drops it so each slice reads as its plain
  // configured color with no highlight.
  const isGlossy = theme?.segment_fill !== "flat";

  if (segments.length === 0) return null;

  return (
    // z-10 so the wheel paints OVER the console stand that follows it in the
    // panel (the stand's top edge is deliberately tucked under the bezel).
    // The stand is left at the default z rather than pushed negative: behind
    // this component's stacking context, its SPIN button sat under the
    // wheel's full square box — transparent corners included — and stopped
    // receiving clicks.
    <div className="relative z-10 mx-auto flex w-full max-w-[700px] flex-col items-center">
      {/* No glow layer here — the surrounding panel already casts its own halo
          behind the wheel, and stacking a second one just muddied it. */}
      {/* container-type: inline-size makes this the reference box for the
          cqw units below (icon/label sizing) — they scale with THIS
          element's own rendered width, i.e. the wheel's actual on-screen
          size, not the viewport. */}
      {onToggleMuted && (
        <button
          type="button"
          onClick={onToggleMuted}
          aria-label={muted ? "Unmute spin sounds" : "Mute spin sounds"}
          aria-pressed={muted}
          className="absolute right-0 top-0 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition hover:bg-black/40 active:scale-95"
        >
          {muted ? <FiVolumeX size={15} /> : <FiVolume2 size={15} />}
        </button>
      )}

      <div
        className="relative z-10 flex aspect-square w-full items-center justify-center"
        style={{ containerType: "inline-size" }}
      >
        {/* theme.pointer_color now drives the bulb/mount BACKGROUND fill;
            the centre dot stays a fixed creamy white with the theme's
            border_color as its ring, per the latest reference. */}
        <SpinWheelPointer backgroundColor={pointerColor} spinning={spinning} />

        {/* bezel — layered gradients give it a machined, 3D edge. Recolored to
            theme.border_color (see bezelGradient above) when the API sends
            one, gold otherwise — the color rides THE BEZEL ITSELF now, not a
            separate outline stacked outside it. */}
        <div
          // The three-layer bezel shadow moved OUT of a Tailwind arbitrary
          // value and into this style object: its inner bottom shade is now a
          // brand mix, and a color-mix() contains commas, which a
          // shadow-[...] arbitrary value can't carry.
          className="absolute inset-0 rounded-full p-[18px]"
          style={{
            background: bezelGradient,
            boxShadow: `0 20px 40px -16px rgba(0,0,0,0.45), inset 0 2px 4px rgba(255,255,255,0.85), inset 0 -3px 6px ${BEZEL_INNER_SHADE}`,
          }}
        >
          {/* bulbs ride a full-size ring so their radius scales with the wheel */}
          {Array.from({ length: BULB_COUNT }).map((_, i) => {
            const angle = (360 / BULB_COUNT) * i;
            return (
              <span
                key={i}
                className="pointer-events-none absolute inset-0"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                {/* dark socket disc so the bulb reads as a lamp seated in the
                    bezel rather than a dot floating loose on the bezel's face.
                    Its two dark tones are brand mixes now, so the gradient
                    moved from a bg-[...] arbitrary value into a style object —
                    color-mix() contains commas, which Tailwind's arbitrary
                    syntax can't carry. */}
                <span
                  className="absolute left-1/2 top-[4.5px] h-[10px] w-[10px] -translate-x-1/2 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.4)]"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, ${SOCKET_LIT}, ${SOCKET_DEEP})`,
                  }}
                />
                {/* The bulb face stays the fixed near-white #FFFBEA — a lit
                    filament reads white whatever the brand hue is — but its
                    halo is brand-tinted, so that shadow also moves inline. */}
                <span
                  className="absolute left-1/2 top-[6px] h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-[#FFFBEA]"
                  style={{ boxShadow: `0 0 6px 2px ${BULB_GLOW}` }}
                />
              </span>
            );
          })}

          {/* wheel face */}
          <motion.div
            key={spinToken}
            className="relative h-full w-full rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.18)]"
            // Each spin remounts (key) from the previous resting angle, not 0,
            // so there's no visual jump; target is ≥5 full turns ahead of it.
            style={{
              background: conicGradient,
              // Promote to its own compositor layer and disable backface
              // rendering — without these the sub-pixel slice edges shimmer
              // and flash white while the wheel is spinning fast.
              willChange: "transform",
              backfaceVisibility: "hidden",
              // Bound to our own motion value so the tick handler above can
              // read the live angle; framer still drives it via `animate`.
              rotate: rotation,
            }}
            initial={{ rotate: restRotation }}
            animate={{ rotate: spinning ? targetRotation : restRotation }}
            transition={
              spinning
                ? {
                    duration: 4.2,
                    // Single easing curve — a mismatched times/ease array pair
                    // here previously caused a visible mid-spin hitch.
                    ease: [0.15, 0.9, 0.25, 1],
                  }
                : { duration: 0 }
            }
            onAnimationComplete={() => {
              if (!spinning) return;
              // Park at the landed angle (same visual position, normalised to
              // one turn) so the pointer stays on the won slice.
              setLandedRotation(((targetRotation % 360) + 360) % 360);
              onSpinComplete();
            }}
          >
            {/* Divider lines — only when the API sends a theme.border_color.
                Real elements (not baked into the conic-gradient as thin
                angular color stops): a conic-gradient's angular width maps to
                a very different PIXEL width near the center vs the rim, so a
                gradient-stop "line" rendered visibly crooked/uneven at
                different radii. These are children of THIS SAME rotating
                motion.div (not a separate sibling layer), so they share its
                transform with zero relative motion — that shared-frame
                rotation is what avoids the white-hairline strobe an earlier
                attempt hit, not the drawing method itself.
                Thin (2px), flat fill + soft outer glow. A cross-width
                dark/light/dark gradient was tried for a "machined" look but
                didn't blend at this thinness — it rendered as two separate
                dark edges with a lighter gap between (looked like a doubled
                line per seam). */}
            {lineColor &&
              segments.map((_, i) => (
                <span
                  key={`divider-${i}`}
                  className="pointer-events-none absolute left-1/2 top-1/2 h-1/2 w-[2px] origin-top rounded-full"
                  style={{
                    // Flat fill, not a cross-width gradient — at ~2px a
                    // dark/light/dark gradient across the width didn't blend,
                    // it rendered as two separate dark edges with a lighter
                    // sliver between them (looked like a DOUBLED line, one
                    // per side). A soft outer glow gives it depth instead.
                    backgroundColor: lineColor,
                    boxShadow: `0 0 3px color-mix(in srgb, ${lineColor} 60%, transparent)`,
                    // +180: the line hangs DOWNWARD from its origin-top at the
                    // wheel's center, so rotate(0) points at 6 o'clock — but
                    // conic-gradient's 0deg boundary is at 12 o'clock. Without
                    // this the seams and the lines sat half a turn apart.
                    transform: `translateX(-50%) rotate(${i * segmentAngle + 180}deg)`,
                  }}
                />
              ))}

            {/* depth: soft highlight toward the top-left, shading at the rim —
                only for "glossy" segment_fill; "flat" skips it entirely. */}
            {isGlossy && (
              <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_50%_50%,transparent_58%,rgba(0,0,0,0.18))]" />
            )}

            {segments.map((segment, i) => {
              const rotate = i * segmentAngle + segmentAngle / 2;
              // NOTE: labels on the wheel's bottom half read upside-down —
              // rotate() is what points each block outward from the centre,
              // and past 90° that same rotation turns the text over with it.
              // Two attempts to correct it both made things worse and were
              // reverted:
              //   1. `mb-[9%] self-end` + rotate(180deg) — collapsed every
              //      bottom-half label onto the hub, all overlapping.
              //   2. rotate(180deg) alone — the block sits far off the wheel's
              //      centre, so rotating it swung it bodily across to the
              //      OPPOSITE side; all 7 labels ended up crowded in the top
              //      half with the bottom half empty.
              // A real fix needs the block re-anchored about its own position
              // (e.g. transform-origin set to the wheel's centre, or the label
              // laid out along an SVG textPath), not a plain CSS rotate.
              // Per-segment colour wins; white is the fallback now that the
              // theme no longer sends a wheel-wide text_color.
              const textColor = segment.text_color || "#ffffff";
              // API-driven per segment: "name" -> label only, "icon" -> icon
              // only, "both" -> both. Missing/unrecognized falls back to
              // "both" (the original always-show-everything behavior).
              const showIcon =
                Boolean(segment.icon_url) && segment.display_mode !== "name";
              const showLabel = segment.display_mode !== "icon";
              return (
                <div
                  key={segment.id}
                  className="absolute inset-0 flex justify-center"
                  style={{ transform: `rotate(${rotate}deg)` }}
                >
                  {/* Icon in a circular white badge (uniform look regardless
                      of the API's raw source image — some are non-square/
                      clipped oddly if rendered directly on the slice color),
                      single-line truncated label directly below it. Both
                      scale with the wheel via cqw (container query width —
                      see the cq wrapper below) so they shrink on a small
                      mobile wheel instead of overflowing a fixed size, AND
                      shrink further with densityScale as segment count rises
                      (see its definition above) — that second shrink is what
                      keeps a long label from bleeding into the next slice on
                      a 6+ segment wheel instead of just being smaller. */}
                  <div
                    className="mt-[9%] flex flex-col items-center gap-[1.5cqw] px-[2cqw]"
                    style={{
                      // Geometry-derived (see labelMaxWidth above), not a flat
                      // constant — the wedge is a triangle, so the width that
                      // fits a 4-slice wheel runs past the divider on a 7-slice
                      // one.
                      maxWidth: `${labelMaxWidth}cqw`,
                    }}
                  >
                    {showIcon && (
                      // No white disc behind the icon — it sits directly on
                      // the segment's own colour, and no drop-shadow either
                      // (removed per feedback: it read as unwanted noise).
                      <span
                        className="relative flex shrink-0 items-center justify-center"
                        style={{
                          // Icon-only segments get more room since there's no
                          // label sharing the block.
                          width: `${(showLabel ? 11 : 14) * densityScale}cqw`,
                          height: `${(showLabel ? 11 : 14) * densityScale}cqw`,
                        }}
                      >
                        <span className="relative h-full w-full">
                          <Image
                            src={segment.icon_url!}
                            alt={segment.label}
                            fill
                            sizes="60px"
                            className="object-contain"
                            unoptimized
                          />
                        </span>
                      </span>
                    )}
                    {showLabel && (
                      <span
                        // break-WORDS, not break-all: these are sentences, and
                        // break-all split them mid-word ("Win a Special ins /
                        // tant disc after"). break-words still breaks a single
                        // token too long to fit, which is the only case that
                        // actually needs it. overflow-hidden is the hard stop
                        // — line-clamp only caps the HEIGHT.
                        className="line-clamp-3 w-full overflow-hidden break-words text-center font-bold leading-[1.15]"
                        style={{
                          color: textColor,
                          fontSize: `${2.7 * densityScale}cqw`,
                        }}
                      >
                        {segment.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* hub — green SPIN dome, the sole spin trigger. Deliberately OUTSIDE
              the rotating wheel face: nested inside it, the hub (and its
              "Spin" label) rotated along with the wheel, so the text ended up
              tilted/upside-down mid-spin. */}
          {/* Decorative only — NOT a button. Spinning is triggered solely by
              the stand's own SPIN key below the wheel; the hub used to be a
              second trigger, which gave the same action two controls. */}
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div
              aria-hidden
              // overflow-visible: the outer drop-shadows need room past this
              // box's own edge, or they clip flush with it and only the inset
              // shadows show. Both children (the image span and the dome div)
              // already carry their own overflow-hidden rounded-full, so
              // nothing here actually relied on this wrapper doing the
              // clipping.
              className="flex h-[22%] w-[22%] items-center justify-center overflow-visible rounded-full p-[3px]"
              // The ring around the dome is this padding showing through —
              // takes border_color (the rim colour), same as the wheel's own
              // outer rim, per the confirmed contract. line_color is dividers
              // + inner ring only, not this.
              // Two shadows: a tight dark one right under the ring so it
              // reads as sitting PROUD of the wheel face (the previous single
              // wide soft shadow washed out against a busy segment colour
              // behind it), plus an inset rim highlight for its own depth.
              style={{
                // A gradient ring, not a flat fill — a single flat colour
                // read as a painted disc rather than a moulded metal/plastic
                // ring. Light top-left, darker bottom-right, same light
                // direction as the rest of the wheel's own 3D shading.
                background: borderColor
                  ? `linear-gradient(135deg, color-mix(in srgb, ${borderColor} 60%, #fff), ${borderColor} 45%, color-mix(in srgb, ${borderColor} 65%, #000))`
                  : "linear-gradient(135deg, #ffffff, #d8d8d8 45%, #a8a8a8)",
                boxShadow: [
                  "0 3px 6px rgba(0,0,0,0.45)",
                  "0 8px 16px rgba(0,0,0,0.3)",
                  "inset 0 1px 1px rgba(255,255,255,0.6)",
                  "inset 0 -1px 2px rgba(0,0,0,0.25)",
                ].join(", "),
              }}
            >
              {theme?.hub_icon_url ? (
                // A real campaign image for the centre. `fill` + object-cover
                // so a non-square source still fills the round dome rather
                // than letterboxing inside it — the parent (this padded
                // circle) is already sized, so fill has a box to size against
                // without this needing to know the source's own dimensions.
                <span className="relative block h-full w-full overflow-hidden rounded-full">
                  <Image
                    src={theme.hub_icon_url}
                    alt=""
                    fill
                    // Arbitrary campaign-supplied URL, not necessarily on an
                    // allow-listed image host — same reasoning as the result
                    // card's own segment-icon Image (SpinWinPanel.tsx).
                    unoptimized
                    className="object-cover"
                  />
                </span>
              ) : (
              /* Disabled state recolors the dome to gray rather than fading
                  it — a blanket opacity washed out the white ring too and read
                  as muddy over the slice colors. Uses the theme's
                  pointer_color when the API sends one, falling back to a
                  brand-derived dome (HUB_* above) otherwise — the fixed green
                  it used to fall back to was only ever right for one client. */
              <div
                key="dome"
                className="flex h-full w-full items-center justify-center rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-3px_6px_rgba(0,0,0,0.28)]"
                style={{
                  // The star is a fixed decorative glyph, not per-segment
                  // text — always white, which is what the dome's gradients
                  // are designed against. (theme.text_color, which used to
                  // feed this, is gone from the API.)
                  color: "#ffffff",
                  background: !canSpin
                    ? "radial-gradient(circle at 35% 28%, #B6BDC4, #8A929B 55%, #6B7280)"
                    : pointerColor
                      ? `radial-gradient(circle at 35% 28%, color-mix(in srgb, ${pointerColor} 80%, #fff), ${pointerColor} 55%, color-mix(in srgb, ${pointerColor} 70%, #000))`
                      : `radial-gradient(circle at 35% 28%, ${HUB_HI}, ${HUB_MID} 55%, ${HUB_LO})`,
                }}
              >
                <FaStar
                  className="h-[42%] w-[42%]"
                  // Two drops: a tight dark one that seats the star on the
                  // dome, plus a wider soft one so it doesn't read as a flat
                  // sticker against the dome's own gradient.
                  style={{
                    filter:
                      "drop-shadow(0 2px 2px rgba(0,0,0,0.45)) drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
                  }}
                />
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SpinWheel;
