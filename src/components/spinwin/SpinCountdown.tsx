"use client";

import { t } from "@/utils/translation";
import type { Countdown } from "@/hooks/useCountdown";

/**
 * "Next Spin In" over three dark digit tiles, split by colons.
 *
 * The hook already exposes hours/minutes/seconds separately, so this renders
 * them as their own tiles rather than slicing the pre-formatted `label` —
 * a single "09:13:19" string in one pill read as a stopwatch, not as a wait.
 *
 * The tiles are fixed-width and tabular-nums so the row can't jitter as the
 * digits tick: a proportional "1" is narrower than a "0", which made the
 * colons shuffle every second.
 */
interface SpinCountdownProps {
  countdown: Countdown;
  /** Smaller variant for tight spots (e.g. inside the stand's button). */
  compact?: boolean;
}

const Tile = ({ value, compact }: { value: number; compact?: boolean }) => (
  <span
    // Near-black and rimless, per the reference — an inset brand ring read as
    // a bordered chip rather than as a solid block of unlit display.
    className={`flex items-center justify-center rounded-[14px] font-extrabold tabular-nums text-white ${
      compact ? "h-11 w-[52px] text-[22px]" : "h-[54px] w-[62px] text-[27px]"
    }`}
    style={{
      background: "#111014",
      boxShadow: "0 3px 8px rgba(0,0,0,0.45)",
    }}
  >
    {String(value).padStart(2, "0")}
  </span>
);

const Colon = ({ compact }: { compact?: boolean }) => (
  <span
    aria-hidden
    className={`font-extrabold text-white ${
      compact ? "text-[18px]" : "text-[22px]"
    }`}
  >
    :
  </span>
);

const SpinCountdown = ({ countdown, compact }: SpinCountdownProps) => (
  <div className="flex flex-col items-center gap-2">
    <span
      className={`font-semibold text-white ${
        compact ? "text-[15px]" : "text-[18px]"
      }`}
    >
      {t("next_spin_in") || "Next Spin In"}
    </span>
    {/* The whole row is one accessible string; the tiles themselves are
        presentational, so a screen reader doesn't read "10 colon 48". */}
    <div
      className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`}
      role="timer"
      aria-label={`${t("next_spin_in") || "Next spin in"} ${countdown.label}`}
    >
      <Tile value={countdown.hours} compact={compact} />
      <Colon compact={compact} />
      <Tile value={countdown.minutes} compact={compact} />
      <Colon compact={compact} />
      <Tile value={countdown.seconds} compact={compact} />
    </div>
  </div>
);

export default SpinCountdown;
