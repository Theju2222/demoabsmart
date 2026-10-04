// Shapes match the real `GET /customer/spin_wheel` (wheel state) and
// `POST /customer/spin_wheel/spin` (spin action) response bodies.
//
// Unlike the earlier demo JSON, the live API is fully GENERIC — a segment is
// just {label, icon_url, color, text_color}, no fixed "coupon"/"cashback"/
// "free_delivery" type and no structured discount/cashback breakdown. The
// wheel and result modal render whatever label/icon each segment carries;
// they don't special-case reward "kinds" anymore.

// Theme shape as of the campaign's own theme-rework: text_color, wheel_bg and
// use_brand_theme are GONE (a segment's own text_color / the fixed neutrals
// this app falls back to cover what text_color did); everything else below is
// new. border_color's job also narrowed — it used to double as the colour for
// the divider lines/inner ring/disc edge AND the wheel's outer rim; now
// line_color owns the former and border_color is the rim ring only.
export interface SpinWheelTheme {
  /** Backdrop behind the whole stage, the cabinet and the backing panel — the
   * one colour those three used to derive independently from
   * var(--primary-color). Falls back to that brand mix when unset. */
  bg_color?: string;
  /** Campaign title, first line ("Daily" in "Daily Reward"). */
  title_color?: string;
  /** Campaign title, second line ("Reward"). */
  title_color_2?: string;
  /** The top pointer's fill. */
  pointer_color?: string;
  /** The wheel's outer rim ring ONLY now — dividers/inner ring/disc edge
   * moved to line_color. */
  border_color?: string;
  /** Dividers between wedges, the inner ring and the centre disc's edge —
   * split out from border_color, which is now the rim ring alone. */
  line_color?: string;
  /** The SPIN key's own colour — the cap, lip and cradle shades all derive
   * from this instead of var(--primary-color) once it's set. */
  button_color?: string;
  /** The key's label. Defaults to "SPIN"; capped at 12 chars — this is a
   * fixed-width cap face, not a text field that reflows. */
  button_text?: string;
  /** The SPIN label's own text colour. Unset falls back to a dark mix of
   * button_color (or --primary-color), matching the label exactly as before
   * this field existed. */
  button_text_color?: string;
  segment_fill?: string;
  /** Centre-disc image. Empty string (not just absent) means a plain disc —
   * that's a real "no icon" choice from the campaign, not a loading state, so
   * it must not fall back to a placeholder glyph. */
  hub_icon_url?: string;
  /** The cabinet's chase-light bulbs (the row of dots down each side of the
   * stand) — its own field in the admin panel, independent of
   * button_color/bg_color/pointer_color. Unset falls back to
   * var(--primary-color), matching the dots exactly as before this field
   * existed. */
  light_color?: string;
}

export interface SpinWheelCampaign {
  id: number;
  name: string;
  theme?: SpinWheelTheme;
}

export interface SpinWheelSegment {
  index: number;
  id: number;
  label: string;
  display_mode?: string;
  color: string;
  text_color?: string;
  icon_url?: string;
}

export interface SpinWheelSpins {
  spins_per_day: number;
  used_today: number;
  remaining_today: number;
  max_spins_per_user?: number;
  used_lifetime?: number;
  remaining_lifetime?: number | null;
  can_spin: boolean;
  // Ready-to-show sentence when can_spin is false, e.g. "You have used all
  // your spins for today." — safe to render as-is for any reason this app
  // doesn't localize.
  reason?: string | null;
  // Machine-readable slug for the SAME reason, e.g.
  // "spin_wheel_daily_limit_reached" — match on THIS, not `reason`, to pick a
  // localized message; `reason` is the sentence, not a stable key.
  reason_key?: string | null;
  next_spin_at?: string | null;
  next_spin_at_label?: string | null;
  /** Server-computed seconds remaining as of THIS response's fetch time — use
   * this over `next_spin_at` for the countdown deadline: it's a relative
   * delta, so it's immune to the client's clock being wrong/skewed, unlike
   * parsing the absolute `next_spin_at` timestamp against `Date.now()`. */
  next_spin_in_seconds?: number | null;
}

export interface SpinWheelData {
  is_available: number; // 0 | 1
  requires_login: number; // 0 | 1
  message?: string;
  campaign: SpinWheelCampaign;
  segments: SpinWheelSegment[];
  spins: SpinWheelSpins;
  currency?: string;
  currency_code?: string;
  decimal_point?: number;
}

// A won promo code (result: "win", reward_type has a coupon attached — e.g.
// "free_delivery", a %/flat discount code, etc.). `discount`/
// `max_discount_amount` are 0 for a free_delivery code (no percentage/cap to
// show) — render those fields only when discount_type isn't "free_delivery".
export interface SpinWheelPromoCode {
  id: number;
  promo_code: string;
  title: string;
  discount_type: string;
  discount: number;
  max_discount_amount: number;
  minimum_order_amount: number;
  start_date: string;
  end_date: string;
  start_date_label: string;
  end_date_label: string;
}

// A won wallet credit (result: "win", reward_type "wallet"/"cashback" style).
// Shape inferred from promo_code's sibling position — amount/currency are the
// only fields actually rendered; extra ones pass through untyped via [key].
export interface SpinWheelWalletReward {
  amount: number;
  [key: string]: any;
}

// POST /customer/spin_wheel/spin response body (confirmed against a real
// payload — a "win" landing on a free_delivery promo_code segment). The
// landed segment itself is NOT a full SpinWheelSegment here — only
// segment_id/segment_index are sent, so the wheel looks the rest (color,
// icon_url, label) up from the GET-cached `segments[]` by id to animate to
// it; the result MODAL uses this response's own title/message/promo_code/
// wallet directly rather than reusing the segment's label.
// GET /customer/spin_wheel/rewards response (confirmed via a live call) — the
// user's own won-rewards HISTORY, not a fresh spin result. Each row's
// promo_code is a lighter shape than SpinWheelPromoCode (no `id`/`title`) —
// kept separate rather than reusing that type.
export interface SpinWheelRewardPromoCode {
  promo_code: string;
  discount_type: string;
  discount: number;
  max_discount_amount: number;
  minimum_order_amount: number;
  start_date: string;
  end_date: string;
  end_date_label: string;
}

export interface SpinWheelReward {
  id: number;
  /** "wallet" | "promo_code" | "free_delivery" — promo_code is non-null only
   * for "promo_code"/"free_delivery" rows, null for a plain "wallet" win. */
  reward_type: string;
  label: string;
  campaign_name?: string;
  icon_url?: string;
  /** Wallet credit amount for "wallet" rows; the promo's own discount value
   * (e.g. 10 for 10%) for "promo_code" rows — read promo_code.discount for
   * the coupon's actual discount instead of this when promo_code is set. */
  amount: number;
  currency?: string;
  currency_code?: string;
  won_at: string;
  won_at_label: string;
  promo_code: SpinWheelRewardPromoCode | null;
}

export interface SpinWheelRewardsSummary {
  spins: number;
  wins: number;
  wallet_won: number;
  coupons_won: number;
  free_deliveries_won: number;
}

export interface SpinWheelRewardsData {
  rewards: SpinWheelReward[];
  summary: SpinWheelRewardsSummary;
}

export interface SpinWheelSpinResult {
  segment_id: number;
  segment_index: number;
  /** "win" | "lose" (a "No Luck" segment lands as a non-"win" result — exact
   * non-win string not yet confirmed, treat any value !== "win" as a loss). */
  result: string;
  /** Backend-defined reward kind for a win — e.g. "free_delivery", "wallet",
   * a discount-coupon type. Purely informational; the UI branches on whether
   * `promo_code` / `wallet` is present rather than this string. */
  reward_type?: string;
  label?: string;
  title?: string;
  message?: string;
  promo_code?: SpinWheelPromoCode | null;
  wallet?: SpinWheelWalletReward | null;
  /** Same row shape as a rewards[] entry from GET /customer/spin_wheel/rewards
   * — null on a loss. Not yet consumed anywhere: the UI still branches on
   * promo_code/wallet above, which this doesn't replace. Typed now so a
   * future read of it doesn't need an `any`. */
  reward?: SpinWheelReward | null;
  spins?: SpinWheelSpins;
  currency?: string;
  currency_code?: string;
  decimal_point?: number;
}
