import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import * as api from "@/api/apiRoutes";
import type {
  SpinWheelData,
  SpinWheelSegment,
  SpinWheelSpinResult,
  SpinWheelSpins,
} from "@/types/spinWin";

export interface UseSpinWheelParams {
  latitude?: number | string;
  longitude?: number | string;
  /** Gate the fetch on hydration/location readiness the same way other
   * location-scoped hooks do (see useProductFilters). */
  enabled?: boolean;
}

export interface UseSpinWheelResult {
  data: SpinWheelData | null;
  isLoading: boolean;
  isError: boolean;
  spin: () => Promise<{
    segment: SpinWheelSegment | null;
    result: SpinWheelSpinResult | null;
  }>;
  spinning: boolean;
  refetch: () => void;
}

const getUpdatedSpins = (
  result: SpinWheelSpinResult | null | undefined,
): SpinWheelSpins | null => result?.spins ?? null;

// Idempotency key for POST /customer/spin_wheel/spin — covers the case where
// the request fires but the response never comes back (network drop, tab
// closed/backgrounded mid-spin, etc.). The backend is expected to recognize a
// repeated idempotency_key as the SAME spin attempt (not a new one), so a
// retry after an interrupted spin can't double-consume the user's spin count
// or hand out a second reward for one physical spin.
//
// Stored in localStorage (not component state) so it survives a full reload —
// the exact case an in-memory value wouldn't cover. One key is generated per
// spin ATTEMPT and only cleared on a confirmed-successful response; as long
// as it's still there, the next spin() call reuses it instead of minting a
// new one, so a retry after a failure/interruption resends the same key.
const IDEMPOTENCY_KEY_STORAGE = "spin_wheel_idempotency_key";

const getOrCreateIdempotencyKey = (): string => {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(IDEMPOTENCY_KEY_STORAGE);
  if (existing) return existing;
  const key = crypto.randomUUID();
  window.localStorage.setItem(IDEMPOTENCY_KEY_STORAGE, key);
  return key;
};

const clearIdempotencyKey = (): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(IDEMPOTENCY_KEY_STORAGE);
};

/**
 * Wraps GET /customer/spin_wheel (wheel state: campaign/theme, segments,
 * today's spins-remaining) and POST /customer/spin_wheel/spin (records a
 * spin, returns the won segment). Refetches state on location change; a
 * successful spin patches the cached spins block directly (no extra GET)
 * so the spin-count UI updates immediately, then invalidates in the
 * background to reconcile with the server.
 */
export const useSpinWheel = ({
  latitude,
  longitude,
  enabled = true,
}: UseSpinWheelParams): UseSpinWheelResult => {
  const queryClient = useQueryClient();
  // User id in the key: the wheel state is per-user (guest gets can_spin:false
  // + "login to continue"), so a guest response cached before login must not
  // be served after it.
  const userId = useSelector((state: any) => state.User?.user?.id ?? null);
  const queryKey = ["spin-wheel", latitude, longitude, userId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.getSpinWheel({ latitude, longitude });
      // API may wrap payload in { data } or return it flat.
      return (res?.data ?? res ?? null) as SpinWheelData | null;
    },
    enabled: enabled && latitude != null && longitude != null,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const idempotencyKey = getOrCreateIdempotencyKey();
      const res = await api.spinSpinWheel({
        latitude,
        longitude,
        idempotencyKey,
      });
      return (res?.data ?? res ?? null) as SpinWheelSpinResult | null;
    },
    onSuccess: (result) => {
      // Only a confirmed-successful response clears the key — a thrown/4xx
      // response skips onSuccess entirely, so a genuinely failed OR
      // interrupted attempt leaves the key in place for the next spin() to
      // reuse (see getOrCreateIdempotencyKey's own comment).
      clearIdempotencyKey();
      const updatedSpins = getUpdatedSpins(result);
      if (!updatedSpins) return;
      queryClient.setQueryData<SpinWheelData | null>(queryKey, (prev) =>
        prev ? { ...prev, spins: updatedSpins } : prev,
      );
    },
    onSettled: () => {
      // Reconcile with the server regardless of whether the response carried
      // an updated spins block — cheap and covers the case where it didn't.
      queryClient.invalidateQueries({ queryKey });
      // A spin adds a row to the won-rewards history, so drop that cache too
      // — otherwise the My Rewards list sitting behind the wheel dialog keeps
      // showing a stale list that's missing the reward just won.
      queryClient.invalidateQueries({ queryKey: ["spin-wheel-rewards"] });
    },
  });

  const spin = async () => {
    const result = await mutation.mutateAsync();
    // The spin response only carries segment_id/segment_index, not the full
    // segment (color/icon_url/label) — look it up from the GET-cached wheel
    // state so SpinWheel has what it needs to animate/land on it. Falls back
    // to segment_index if a stale/refetched segments array ever reorders ids.
    const segments = query.data?.segments ?? [];
    const segment =
      segments.find((s) => s.id === result?.segment_id) ??
      segments[result?.segment_index ?? -1] ??
      null;
    return { segment, result };
  };

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    spin,
    spinning: mutation.isPending,
    refetch: query.refetch,
  };
};

export default useSpinWheel;
