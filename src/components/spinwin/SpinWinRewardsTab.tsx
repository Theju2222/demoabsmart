"use client";

import React from "react";
import { useSelector } from "react-redux";
import { t } from "@/utils/translation";
import useIsHydrated from "@/hooks/useIsHydrated";
import SpinWinRewardsContent from "./SpinWinRewardsContent";

// "My Rewards" as a normal ProfileDashboard tab panel (sidebar stays visible,
// content swaps in place) — matches every other profile menu item's behavior.
// Wraps the SAME SpinWinRewardsContent the (now-removed) modal used to, so
// there's still only one implementation of the summary+list.
const SpinWinRewardsTab = () => {
  const city = useSelector((state: any) => state.City);
  const isHydrated = useIsHydrated();
  const latitude = isHydrated ? city?.city?.latitude : undefined;
  const longitude = isHydrated ? city?.city?.longitude : undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold fontColor">
        {t("my_rewards") || "My Rewards"}
      </h1>
      {/* No panel chrome here — SpinWinRewardsContent paints its own tinted
          board and rounds its own hero/cards, so a second border + radius
          around it just double-framed everything. */}
      <div className="overflow-hidden rounded-2xl">
        <SpinWinRewardsContent latitude={latitude} longitude={longitude} />
      </div>
    </div>
  );
};

export default SpinWinRewardsTab;
