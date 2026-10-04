"use client";

import React from "react";

interface SpinWinStandProps {
  onSpin: () => void;
  /** Disabled look + no click when false (out of spins / mid-spin). */
  canSpin: boolean;
  disabled?: boolean;
  label: string;
  /** Out of spins: rendered ON the cabinet IN PLACE OF the key, so the panel
   * shows the wait rather than a dead button the user can press to no effect.
   * A node, not a string — the caller owns the countdown's presentation
   * (SpinCountdown's tile row), this component just gives it the spot. */
  countdown?: React.ReactNode;
  /** Wheel is mid-spin — runs the chase animation on the stand's bulbs. */
  spinning?: boolean;
  /** theme.button_color — the key's own colour, independent of the cabinet's
   * (which follows --primary-color / theme.bg_color). Unset falls back to
   * --primary-color, matching the cabinet exactly as before this field
   * existed. */
  buttonColor?: string;
  /** theme.button_text_color — the SPIN label's own colour. Unset falls back
   * to GOLD_TEXT (a dark mix of the key's own colour), matching the label
   * exactly as before this field existed. */
  buttonTextColor?: string;
  /** theme.light_color — the chase-light bulbs' own colour, independent of
   * button_color/bg_color. Unset falls back to --primary-color, matching the
   * bulbs exactly as before this field existed. */
  lightColor?: string;
}

// PALETTE: brand-derived. The template ships white-label — every client sets
// its own --primary-color — so the cabinet and its key are built from mixes of
// that variable rather than the reference's fixed violet/gold hexes. Each
// constant below keeps the REFERENCE's relative lightness step (light cap face
// -> mid -> deeper base, over a darker lip, seated in a near-black cradle);
// only the hue now follows the client. Mix toward #fff to go lighter than
// primary, toward #0A0A0A to go darker.
// The key's own colour is theme.button_color, INDEPENDENT of the cabinet's
// --primary-color-derived palette below — the two used to share one variable,
// which was fine while nothing themed them separately, but the API now sends
// a distinct button_color from whatever the cabinet's bg_color re-points
// --primary-color to. --spinwin-button-color is set on the button's own
// wrapper from that field (see SpinWinPanel), and falls back to
// var(--primary-color) so an unthemed campaign keeps matching the cabinet
// exactly as before.
const BTN = "var(--spinwin-button-color, var(--primary-color))";
// The key's cap: three stops, lightest at the top (was #FFF0A0 -> #FFD34E ->
// #F7B32B).
const GOLD_TOP = `color-mix(in srgb, ${BTN} 18%, #fff)`;
const GOLD_MID = `color-mix(in srgb, ${BTN} 45%, #fff)`;
const GOLD_BOTTOM = `color-mix(in srgb, ${BTN} 68%, #fff)`;
// Deep, stamped-in label colour — the previous lighter value read as a tint
// floating on the cap face rather than as an engraved label, so this is a
// distinctly darker-than-primary mix (was #B5490A against the gold).
const GOLD_TEXT = `color-mix(in srgb, ${BTN} 62%, #0A0A0A)`;
// The key's underside, one step darker than the cap's base and darker again at
// the bottom (was #F08A10 / #C96A05).
const LIP_TOP = BTN;
const LIP_BOTTOM = `color-mix(in srgb, ${BTN} 78%, #0A0A0A)`;
// The cradle the key sits in: near-black with just enough brand in it to stay
// warm against the key (was #3A1D06).
const CRADLE = `color-mix(in srgb, ${BTN} 24%, #0A0A0A)`;

// The cabinet ramp, lightest (CAB_1) to darkest (CAB_5). Same five stops and
// same ordering as the reference's #9471FF -> #7856DE -> #5435AD -> #381A8A ->
// #301282: the top two sit LIGHTER than primary (mixed toward white), the
// bottom three progressively darker (mixed toward #0A0A0A), and the last two
// are deliberately close together the way the original's were.
const CAB_1 = "color-mix(in srgb, var(--primary-color) 55%, #fff)";
const CAB_2 = "color-mix(in srgb, var(--primary-color) 78%, #fff)";
const CAB_3 = "color-mix(in srgb, var(--primary-color) 72%, #0A0A0A)";
const CAB_4 = "color-mix(in srgb, var(--primary-color) 52%, #0A0A0A)";
const CAB_5 = "color-mix(in srgb, var(--primary-color) 46%, #0A0A0A)";
// The cabinet's hairline outline — the ramp's lightest tint (was
// rgba(213,190,255,0.85)), so primary washed far toward white at 0.85 alpha.
const CAB_STROKE =
  "color-mix(in srgb, color-mix(in srgb, var(--primary-color) 22%, #fff) 85%, transparent)";
// The cabinet's cast shadow: a very dark brand-tinted near-black (was
// rgba(20,4,55,0.55)).
// The plinth's outline — the same tint as CAB_STROKE but far weaker, since
// the slab sits in the cabinet's shadow and a matching hairline there read as
// a lit highlight instead of an edge.
const BASE_STROKE =
  "color-mix(in srgb, color-mix(in srgb, var(--primary-color) 30%, #fff) 30%, transparent)";
const CAB_SHADOW =
  "color-mix(in srgb, color-mix(in srgb, var(--primary-color) 22%, #0A0A0A) 55%, transparent)";

// Button geometry, in px. The face fills the button except for LIP px at the
// bottom, where the key's orange underside shows — that thin strip is its
// thickness. Pressing translates the face down by most of the lip, closing the
// strip, which is what reads as the key being pushed down.
const FACE_H = 42;
const LIP = 5;
// Gap between the socket's own outline and the key's moving parts (the lip +
// face), per the reference's own inset between its backing rect and the
// pieces sitting inside it.
const SOCKET_PAD = 3;

// The cabinet outline, in the reference's own 800x300 viewBox. The top edge
// RAMPS UP from each shoulder to a slightly crowned centre (L 330 10 …
// Q 400 -8 … L 470 10) rather than running flat — that rise is the shape's
// whole character and is why stacked rounded <div>s never matched it.
// Bottom corners rounded 50px (up from 32px) — the reference's bottom corners
// read noticeably more rounded than the shallow curve the original numbers
// produced.
const CABINET_PATH = `
  M 8 105
  Q 8 78 36 68
  L 310 10
  Q 400 -8 490 10
  L 764 68
  Q 792 78 792 105
  L 792 250
  Q 792 294 748 294
  L 52 294
  Q 8 294 8 250
  Z
`;

// The plinth the cabinet stands on — a darker slab peeking out below the
// cabinet's bottom edge, per the reference's own two-layer base. Spans the
// cabinet's FULL width (8..792) rather than sitting inset — the reference's
// footing is as wide as the box above it. Its top edge starts ABOVE where the
// cabinet's bottom corners begin their arc (y 250) rather than below it —
// a lower straight edge left a notch of background visible inside each of
// those curves. Only its lower band ever shows; the cabinet covers the rest.
const BASE_PATH = `
  M 8 240
  L 792 240
  L 792 318
  Q 792 350 760 350
  L 40 350
  Q 8 350 8 318
  Z
`;

// The recessed inner panel. Its top edge repeats the cabinet's own
// ramp-and-crown, inset — a flat-topped rect read as a sticker laid over the
// slope.
// Side/bottom inset matched to a UNIFORM ~28px band all the way round (the
// cabinet's flat edges run 8..792 / 105..275).
// Bottom corner radius is 22 = the cabinet's 50 minus that 28px inset, and
// the SAME on both axes. It used to be 26 vertical / 40 horizontal, which
// squashed the corner into an ellipse that didn't track the cabinet's own
// round corner beside it — concentric corners need radius_inner =
// radius_outer - inset.
const PANEL_PATH = `
  M 36 134
  Q 36 112 62 103
  L 322 52
  Q 400 36 478 52
  L 738 103
  Q 764 112 764 134
  L 764 244
  Q 764 266 742 266
  L 58 266
  Q 36 266 36 244
  Z
`;

// Tall vertical side supports/wings on both left and right sides.
// Single clean polygon per side matching reference M99 792 L76 834 V950 H99 Z (no double/split vertical strokes).
const LEFT_WING_PATH = "M 76 -190 L 10 -50 L 10 250 L 76 250 Z";
const RIGHT_WING_PATH = "M 724 -190 L 790 -50 L 790 250 L 724 250 Z";

// Three dots per side, seated INSIDE the recessed panel either side of the
// button — not out on the cabinet face between the panel and its outer edge.
// In viewBox units so they track the path rather than the element's box.
// Panel runs 68..732; these sit a fixed margin in from each side of it.
const DOT_ROWS = [155, 195, 235];
const DOT_COLS = { left: 74, right: 726 };

/**
 * The console beneath the wheel: a violet cabinet with an arched top edge,
 * decorative dots down each side and a gold SPIN button in the middle.
 *
 * The cabinet is an SVG path so the arched top survives; the button is real
 * DOM on top of it so it stays clickable, translatable and focusable.
 */
const SpinWinStand = ({
  onSpin,
  canSpin,
  disabled,
  label,
  countdown,
  spinning,
  buttonColor,
  buttonTextColor,
  lightColor,
}: SpinWinStandProps) => {
  // The countdown REPLACES the key, and only when the wheel is genuinely
  // unavailable — mid-spin the button is disabled too, but the key should stay
  // put rather than vanishing for four seconds and popping back.
  const showCountdown = Boolean(countdown) && !canSpin;
  return (
    <div
      // The negative margin tucks the cabinet's arched top under the wheel's
      // bezel so the wheel reads as standing IN it. NOT paired with a negative
      // z-index, which is how the overlap was first built: that put the stand
      // behind the wheel's stacking context, and since the wheel's box is a
      // full square (transparent corners included) it covered the cabinet and
      // swallowed clicks on the SPIN button. The wheel carries a positive
      // z-index of its own instead (see SpinWheel).
      // -11% was tuned against the OLD 300-tall viewBox (33px of overlap).
      // Now that the cabinet is 330 tall (same top arch, taller body below
      // it), the same PIXEL overlap is a smaller percentage of the box:
      // 33/330 ≈ 10%. -19% overshot this — it pulled the wheel down far
      // enough to also overlap the cabinet's SIDES, not just its arched top.
      // w-full, not an over-100% width: the stage this sits in is
      // overflow-hidden with its own padding, so anything wider than the
      // column gets clipped at the sides rather than reading as a wider
      // cabinet. The extra width comes from the viewBox instead — the path is
      // inset 72..728 of 800, and narrowing those margins widens the cabinet
      // within the same box.
      // Same 700px cap the wheel uses (see SpinWheel) and w-full of a wrapper
      // sized identically to the wheel's, so the cabinet's side edges land on
      // exactly the same vertical lines as the wheel's. A different cap here
      // left the two visibly misaligned down the sides.
      className={`relative -mt-[10%] w-full max-w-[700px] ${
        spinning ? "spinStandSpinning" : ""
      }`}
      // theme.light_color re-points --spinwin-light-color for this whole
      // stand subtree — the .spinStandDot rules in globals.css read that var
      // (falling back to --primary-color when unset) rather than
      // --primary-color directly, so the bulbs can take their own colour
      // independent of the button/cabinet.
      style={
        lightColor
          ? ({ "--spinwin-light-color": lightColor } as React.CSSProperties)
          : undefined
      }
    >
      {/* Side supports, in their OWN svg at a negative z-index rather than
          inside the cabinet's. They have to paint BEHIND the backing panel
          (SpinWinBackPanel, z-0) while the cabinet itself stays in front of
          it — one shared svg can't straddle another element's z-index, so
          the wings get their own layer. Same viewBox/box as the cabinet's
          svg below, so their coordinates line up with it exactly. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[-1] block w-full overflow-visible"
        viewBox="0 0 800 355"
        style={{ aspectRatio: "800 / 355" }}
      >
        <defs>
          {/* Side support / pillar (wing) gradient fill with glossy top edge */}
          <linearGradient id="spin-wing-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="color-mix(in srgb, var(--primary-color) 70%, #fff)" />
            <stop offset="40%" stopColor="color-mix(in srgb, var(--primary-color) 60%, #0A0A0A)" />
            <stop offset="100%" stopColor="color-mix(in srgb, var(--primary-color) 35%, #0A0A0A)" />
          </linearGradient>
        </defs>
        <path
          d={LEFT_WING_PATH}
          fill="url(#spin-wing-fill)"
          stroke="color-mix(in srgb, var(--primary-color) 75%, #fff)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={RIGHT_WING_PATH}
          fill="url(#spin-wing-fill)"
          stroke="color-mix(in srgb, var(--primary-color) 75%, #fff)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>

      <svg
        aria-hidden
        className="relative block w-full overflow-visible"
        viewBox="0 0 800 355"
        // The cabinet's own cast shadow. A filter, not box-shadow: that would
        // trace the SVG element's rectangular box rather than the path.
        // The path's own proportions, so the cabinet can never stretch into a
        // box the way a separately-set height let it.
        style={{
          aspectRatio: "800 / 355",
          filter: `drop-shadow(0 12px 20px ${CAB_SHADOW})`,
        }}
      >
        <defs>
          {/* Body: a flat, mostly-solid violet with only a subtle lightening
              toward the top edge — the reference cabinet reads as flat-shaded
              rather than machined/glossy, so this drops the wide multi-stop
              highlight-to-shadow ramp down to two close stops. */}
          <linearGradient id="spin-stand-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={CAB_1} />
            <stop offset="1" stopColor={CAB_2} />
          </linearGradient>
          {/* The recess, as one smooth top-to-bottom ramp through the full
              five-stop palette. No separate wash/shadow overlays on top of it
              — those stacked with the fill and crushed the bottom end. */}
          <linearGradient id="spin-stand-inner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CAB_1} />
            <stop offset="25%" stopColor={CAB_2} />
            <stop offset="50%" stopColor={CAB_3} />
            <stop offset="75%" stopColor={CAB_4} />
            <stop offset="100%" stopColor={CAB_5} />
          </linearGradient>
          {/* The plinth's own ramp — lighter at the top where it meets the
              cabinet's bottom edge, darkest at its foot, so the slab reads as
              a rounded step catching light rather than a flat bar. */}
          <linearGradient id="spin-stand-base" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={CAB_3} />
            <stop offset="1" stopColor={CAB_5} />
          </linearGradient>
          {/* Clips the inner panel to the cabinet so it can't spill past the
              arched top. */}
          <clipPath id="spin-stand-clip">
            <path d={CABINET_PATH} />
          </clipPath>
        </defs>

        {/* Plinth, painted BEFORE the body so the cabinet covers everything
            but its lower band. */}
        <path
          d={BASE_PATH}
          fill="url(#spin-stand-base)"
          // Softer than the cabinet's own CAB_STROKE: the plinth sits in
          // shadow under the cabinet, so a full-strength hairline read as a
          // highlight rather than an edge.
          stroke={BASE_STROKE}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Body */}
        <path
          d={CABINET_PATH}
          fill="url(#spin-stand-body)"
          stroke={CAB_STROKE}
          strokeWidth="3"
          strokeLinejoin="round"
        />

        <g clipPath="url(#spin-stand-clip)">
          {/* Recessed inner panel — a single fill carrying the whole
              light-to-dark ramp. No stroke (a visible outline read as a drawn
              border) and no overlay washes (they stacked on the fill and
              crushed the dark end). */}
          <path d={PANEL_PATH} fill="url(#spin-stand-inner)" />
        </g>

      </svg>

      {/* Bulbs. DOM spans rather than SVG <circle>s so the chase animation in
          globals.css can swap their background gradient — a keyframed fill on
          a circle can't express that. Positioned as percentages of the same
          800x300 viewBox the cabinet is drawn in, so they stay seated on its
          face at any width. Source order is left-top..left-bottom then
          right-top..right-bottom, which is what the :nth-of-type delays step
          through. */}
      {(Object.keys(DOT_COLS) as (keyof typeof DOT_COLS)[]).map((side) =>
        DOT_ROWS.map((cy) => (
          <span
            key={`${side}-${cy}`}
            aria-hidden
            className="spinStandDot pointer-events-none absolute z-[5] w-[3.2%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            // aspect-square via the ratio rather than a matching height
            // percentage: height % resolves against the parent's HEIGHT, so a
            // 3.2%/3.2% pair renders an ellipse on a non-square box.
            style={{
              left: `${(DOT_COLS[side] / 800) * 100}%`,
              top: `${(cy / 355) * 100}%`,
              aspectRatio: "1",
            }}
          />
        )),
      )}

      {/* Gold button, overlaid on the cabinet's inner panel. Positioned as a
          percentage of the SVG's own box so it stays centred on the panel at
          any width. Its "chunk" is a bottom box-shadow lip on the face rather
          than a wrapping element — that way :active can shorten the lip and
          drop the face by the same amount, which is what reads as a press. */}
      {/* top-[54%] centres it on the dots' own middle row (y 192 of the 355
          viewBox), i.e. on the flat part of the panel below the sloped top,
          rather than on the panel's overall bounding box — that would sit it
          high, under the slope. */}
      <div
        className="absolute left-1/2 top-[54%] w-[36%] max-w-[175px] -translate-x-1/2 -translate-y-1/2"
        // Sets --spinwin-button-color for every GOLD_*/LIP_*/CRADLE constant
        // above to pick up via BTN's own fallback chain — undefined here just
        // omits the property, so BTN's var() fallback (--primary-color)
        // applies exactly as it did before button_color existed.
        style={
          buttonColor
            ? ({ "--spinwin-button-color": buttonColor } as React.CSSProperties)
            : undefined
        }
      >
        {showCountdown ? (
          // Out of spins: the countdown takes the key's spot outright. A
          // disabled key sitting here invited a press that could never do
          // anything; the clock says why instead.
          // w-max + the centring translate so the tile row can be wider than
          // the key's own 36% without stretching the wrapper.
          <div className="absolute left-1/2 top-1/2 w-max -translate-x-1/2 -translate-y-1/2">
            {countdown}
          </div>
        ) : (
        <>
        {/* Gold push key, ported from the GIVA reference's own rectangular
            button: a plain rounded-RECT socket (not a pill — the reference's
            corner radius is a small fraction of its width), a stroked outline
            round it, an orange lip strip, and a nearly square-cornered gold
            face on top. Three layers:
              1. the SOCKET — a stroked rect the key sits inside, per the
                 reference's own `stroke` outline (the earlier pill version had
                 no socket outline at all);
              2. the orange LIP, of which only its bottom strip ever shows
                 below the face;
              3. the glossy gold FACE, which translates DOWN on press to close
                 that strip.
            `group` + group-active drives the press in CSS, so there's no press
            state to re-render. */}
        <button
          type="button"
          onClick={onSpin}
          disabled={disabled}
          aria-label={label}
          className={`group relative block w-full leading-none ${
            canSpin ? "cursor-pointer" : "cursor-not-allowed"
          }`}
          style={{
            // Aspect ratio, NOT a fixed pixel height: the wrapper's width is a
            // percentage of the cabinet, so a px height stayed put while the
            // cabinet shrank on a narrow viewport and the key read as
            // oversized. The ratio is the design's own 175x53 box, capped at
            // that height so it can't grow past the original on a wide one.
            aspectRatio: `175 / ${FACE_H + LIP + SOCKET_PAD * 2}`,
            maxHeight: FACE_H + LIP + SOCKET_PAD * 2,
            // Outer cast shadow, per the reference screenshot's soft drop
            // under the whole button — this sits on the outermost element so
            // it isn't clipped by the socket's own rounded corners.
            filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.45))",
          }}
        >
          {/* Socket — a stroked rect, per the reference's own
              `stroke="#6f65a0" stroke-width="1"` outline on its button's
              backing rect. Radius is a small fraction of the box (the
              reference's own 24-of-317 ≈ 7.5%), not the pill shape this used
              to be. */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-[12px]"
            style={{
              background: canSpin ? CRADLE : "#15181C",
              boxShadow: `inset 0 0 0 1px ${
                canSpin
                  ? `color-mix(in srgb, ${BTN} 35%, #fff)`
                  : "rgba(255,255,255,0.15)"
              }`,
            }}
          />

          <span
            className="absolute"
            style={{
              left: SOCKET_PAD,
              right: SOCKET_PAD,
              top: SOCKET_PAD,
              bottom: SOCKET_PAD,
            }}
          >
            {/* The key's underside. Only its bottom LIP px are ever visible —
                the face covers the rest — so the gradient is placed to land
                its BRIGHT orange in that strip; running it top-to-bottom over
                the whole element put the dark end exactly where it shows and
                the lip read as a shadow rather than as orange. Radius matches
                the reference's own lip rect (18-of-301.5 ≈ 6%). */}
            <span
              aria-hidden
              className={`absolute inset-x-0 bottom-0 top-[3px] rounded-[9px] transition-[transform] duration-[70ms] ${
                canSpin && !disabled ? "group-active:translate-y-[3px]" : ""
              }`}
              style={{
                background: canSpin
                  ? `linear-gradient(180deg, ${LIP_BOTTOM} 0%, ${LIP_TOP} 100%)`
                  : "linear-gradient(180deg, #3E434A 0%, #5B6169 100%)",
              }}
            />

            {/* Face — nearly square corners (the reference's own 19-of-301.5
                ≈ 6%), same radius family as the lip and socket. */}
            <span
              className={`absolute inset-x-0 top-0 flex items-center justify-center rounded-[9px] transition-[transform] duration-[70ms] ${
                canSpin && !disabled ? "group-active:translate-y-[5px]" : ""
              }`}
              style={{
                bottom: LIP,
                background: canSpin
                  ? `linear-gradient(180deg, ${GOLD_TOP} 0%, ${GOLD_MID} 45%, ${GOLD_BOTTOM} 100%)`
                  : "linear-gradient(180deg, #B6BDC4 0%, #8A929B 45%, #6B7280 100%)",
                boxShadow: canSpin
                  ? `inset 0 1.5px 0 rgba(255,255,255,0.75), inset 0 -2px 3px color-mix(in srgb, color-mix(in srgb, ${BTN} 70%, #0A0A0A) 35%, transparent)`
                  : "inset 0 1.5px 0 #D3D8DD",
                color: canSpin ? buttonTextColor || GOLD_TEXT : "#E5E7EB",
              }}
            >
              <span
                className="flex items-center justify-center px-3 font-black uppercase tracking-[1px]"
                // Scales with the cap the way the key's own box now does — a
                // fixed 21px stayed put while the cabinet shrank and the label
                // crowded the face on a narrow viewport.
                style={{
                  fontSize: "clamp(14px, 4.6vw, 21px)",
                  textShadow: "0 1px 0 rgba(255,243,176,0.5)",
                }}
              >
                {label}
              </span>
            </span>
          </span>
        </button>
        </>
        )}
      </div>
    </div>
  );
};

export default SpinWinStand;
