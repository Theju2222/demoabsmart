// The spin wheel's dialog state lives in FloatingActionDock (mounted once,
// globally). Anything that wants to open the wheel from elsewhere — e.g. the
// "Spin Now" nudge on the My Rewards page, which renders on its own route —
// dispatches this event instead of reaching for that state.
export const OPEN_SPIN_WHEEL_EVENT = "spin-wheel:open";

export const openSpinWheel = (): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_SPIN_WHEEL_EVENT));
};
