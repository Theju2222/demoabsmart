"use client";

import { useDispatch, useSelector } from "react-redux";
import { FiInfo, FiX } from "react-icons/fi";
import { t } from "@/utils/translation";
import { setPromoAutoApplyError } from "@/redux/slices/cartSlice";

// One-line reason a saved coupon (Spin & Win "Use") couldn't be applied yet.
// Stays until dismissed or a coupon is applied — a toast alone was easy to miss.
const CouponAutoApplyError = () => {
  const dispatch = useDispatch();
  const err = useSelector((s: any) => s.Cart?.promoAutoApplyError);
  if (!err) return null;

  return (
    <div
      className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-500/25 dark:bg-emerald-500/10"
      title={`${err.code}: ${err.reason}`}
    >
      <FiInfo size={14} className="shrink-0 text-emerald-600" />
      <p className="min-w-0 flex-1 truncate text-emerald-700 dark:text-emerald-300">
        <span className="font-bold uppercase tracking-wide">{err.code}</span>
        <span className="mx-1 opacity-50">·</span>
        {err.reason}
      </p>
      <button
        type="button"
        aria-label={t("close") || "Close"}
        onClick={() => dispatch(setPromoAutoApplyError(null))}
        className="shrink-0 text-emerald-500 transition hover:text-emerald-700"
      >
        <FiX size={14} />
      </button>
    </div>
  );
};

export default CouponAutoApplyError;
