"use client";

/**
 * The backing panel the wheel is mounted on — a brand-coloured card that sits
 * behind the wheel and stand.
 *
 * PALETTE: brand-derived. The template ships white-label, so every client gets
 * its own --primary-color; a hardcoded hue would only ever be right for one of
 * them. Each former hex is now a color-mix of var(--primary-color) against
 * #fff (lighter) or #0A0A0A (darker), with the mix percentages chosen to
 * reproduce the original violet ramp's relative lightness steps.
 *
 * A plain <div> with CSS border-radius, NOT an SVG path. The SVG version had
 * to stretch a fixed 1000-wide viewBox to the panel's real box
 * (preserveAspectRatio="none"), which scaled the corner curves unevenly —
 * horizontal and vertical radii ended up different, so the corners read as
 * lopsided blobs instead of the reference's tight, even corner. CSS radius is
 * measured in real pixels on both axes, so it can't distort.
 *
 * Sized by top/bottom insets rather than a fixed pixel height: the wheel is
 * fluid, so a hard height stopped wherever that many pixels happened to land
 * and left a gap above the stand instead of meeting it. `bottom` is a
 * percentage of the wheel+stand column, so the panel's lower edge tracks the
 * stand's top whatever size the column renders at.
 *
 * `roundedAll` picks the corner shape: false (the default) rounds only the
 * top so the panel's bottom edge sits flush against SpinWinStand's cabinet
 * below it — a curve there showed as a mismatched seam against the cabinet's
 * straight top-of-body line.
 */
interface SpinWinBackPanelProps {
  roundedAll?: boolean;
  /** Distance from the column's bottom to the panel's lower edge, as a CSS
   * length/percentage. Negative values push it DOWN into the stand, which is
   * what makes its side edges run behind the cabinet instead of stopping at
   * the seam. */
  bottom?: string;
  /** Panel width as a CSS length/percentage of the column. */
  width?: string;
  /** Corner radius in px. The reference's corner is tight, not a big sweep. */
  radius?: number;
}

const SpinWinBackPanel = ({
  roundedAll = false,
  // Negative: the panel runs PAST the stand's own bottom edge, so its sides
  // stay visible down either side of the cabinet instead of stopping at the
  // seam. That overhang is what makes the two read as joined.
  bottom = "4%",
  // Wider than the wheel+stand column (94%) so the cabinet sits inside it and
  // the panel frames it on both sides.
  width = "100%",
  radius = 28,
}: SpinWinBackPanelProps) => (
  <div
    aria-hidden
    className="pointer-events-none absolute left-1/2 top-[-1px] z-0 -translate-x-1/2"
    style={{
      width,
      bottom,
      borderRadius: roundedAll
        ? `${radius}px`
        : `${radius}px ${radius}px 0 0`,
      // Dark at the TOP, lighter toward the bottom — the reference panel is
      // lit from below (the stand's own glow), not from above.
      // Five stops, same ordering as the original #2F1F68 -> #6345E3 ramp:
      // three close-together dark stops, then a distinct jump up to near-full
      // primary for the lit lower edge.
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--primary-color) 42%, #0A0A0A) 0%, color-mix(in srgb, var(--primary-color) 47%, #0A0A0A) 25%, color-mix(in srgb, var(--primary-color) 53%, #0A0A0A) 50%, color-mix(in srgb, var(--primary-color) 90%, #0A0A0A) 85%, var(--primary-color) 100%)",
      // The hairline edge was the ramp's lightest tint (#C4A9FF) — primary
      // washed well toward white.
      border: "1px solid color-mix(in srgb, var(--primary-color) 32%, #fff)",
      // Bottom border is the seam against the stand's cabinet on the
      // top-rounded variant — drawing it left a visible line across the join.
      borderBottomWidth: roundedAll ? "1px" : "0",
      // Soft and wide, not a tight dark drop: the reference's panel sits in a
      // diffuse halo rather than casting a hard shadow directly under itself.
      // Two layers — a close one for contact, a large low-opacity one for the
      // spread.
      // The halo was a very dark brand-tinted near-black (rgba(16,4,45,…)), so
      // it's a heavy primary->#0A0A0A mix carried into transparent for the
      // alpha; the opacities are the originals' 0.28 / 0.35.
      boxShadow:
        "0 4px 12px color-mix(in srgb, color-mix(in srgb, var(--primary-color) 22%, #0A0A0A) 28%, transparent), 0 18px 48px color-mix(in srgb, color-mix(in srgb, var(--primary-color) 22%, #0A0A0A) 35%, transparent)",
    }}
  />
);

export default SpinWinBackPanel;
