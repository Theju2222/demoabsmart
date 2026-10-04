import { useState } from "react";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import { t } from "@/utils/translation";

// "Notify me when back in stock" toggle for a single variant — subscribes/
// unsubscribes via the notify_me API and tracks its own optimistic state.
// Shared by every product card + detail view that renders an out-of-stock
// slot, so the subscribe/unsubscribe/toast/error handling lives in one place.
export default function useNotifyMe({
  variantId,
  latitude,
  longitude,
}: {
  variantId?: number | string | null;
  latitude?: number | string;
  longitude?: number | string;
}) {
  const [isNotifyRequested, setIsNotifyRequested] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggle = async (currentlyRequested: boolean) => {
    if (loading || !variantId) return;
    setLoading(true);
    try {
      const response = currentlyRequested
        ? await api.removeNotifyMe({ product_variant_id: variantId })
        : await api.notifyMe({ product_variant_id: variantId, latitude, longitude });
      // Backend's own message ("Back-in-stock alert removed" / "..." on
      // subscribe) — never a hardcoded string, so wording changes there show
      // up here without a redeploy.
      if (response?.status === 1) {
        setIsNotifyRequested(!!response?.data?.is_notify_requested);
        if (response?.message) toast.success(response.message);
      } else {
        toast.error(response?.message || t("something_went_wrong") || "Something went wrong");
      }
    } catch (error: any) {
      console.log("notify me error", error);
      toast.error(
        error?.response?.data?.message ||
          t("something_went_wrong") ||
          "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  };

  return { isNotifyRequested, setIsNotifyRequested, loading, toggle };
}
