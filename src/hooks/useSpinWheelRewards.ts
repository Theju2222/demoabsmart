import { useInfiniteQuery } from "@tanstack/react-query";
import * as api from "@/api/apiRoutes";
import type { SpinWheelReward, SpinWheelRewardsSummary } from "@/types/spinWin";

const PAGE_SIZE = 10;

export interface UseSpinWheelRewardsParams {
  latitude?: number | string;
  longitude?: number | string;
  /** Narrows to one reward kind ("promo_code" | "wallet" | "free_delivery"),
   * or undefined/"" for all. Changing this is a new query key, so it starts
   * fresh from page 1 rather than appending onto the old filter's rows. */
  rewardType?: string;
  /** Gate the fetch on hydration/location readiness AND on the caller
   * actually needing it — this is a history list opened from a "My Rewards"
   * button, not fetched eagerly with the wheel itself. */
  enabled?: boolean;
}

export interface UseSpinWheelRewardsResult {
  /** Every loaded page's rows, flattened, for the active filter. */
  rewards: SpinWheelReward[];
  /** Lifetime-wide, NOT scoped to the active filter (confirmed live: `total`
   * follows reward_type, `summary` doesn't). Taken from the first page. */
  summary: SpinWheelRewardsSummary | null;
  /** Row count for the ACTIVE filter — drives hasMore, not summary.wins. */
  total: number | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  isError: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

/**
 * Wraps GET /customer/spin_wheel/rewards — the user's own won-rewards
 * history (past wallet credits / promo codes / free-delivery wins) plus a
 * lifetime summary block. Separate hook from useSpinWheel (the live wheel +
 * spin action) since this is only fetched when the rewards list is opened.
 *
 * useInfiniteQuery owns pagination: an invalidation of this query key (see
 * useSpinWheel.ts's onSettled, which invalidates the whole
 * ["spin-wheel-rewards"] prefix after a spin) refetches ALL currently-loaded
 * pages from page 1 forward — so a reward just won is guaranteed to show up
 * even if the user had scrolled past page 1, with no manual reset logic
 * needed here.
 */
export const useSpinWheelRewards = ({
  latitude,
  longitude,
  rewardType,
  enabled = true,
}: UseSpinWheelRewardsParams): UseSpinWheelRewardsResult => {
  const query = useInfiniteQuery({
    queryKey: ["spin-wheel-rewards", latitude, longitude, rewardType],
    queryFn: async ({ pageParam }) => {
      const res = await api.getSpinWheelRewards({
        latitude,
        longitude,
        rewardType,
        limit: PAGE_SIZE,
        offset: pageParam,
      });
      const data = res?.data ?? res ?? null;
      return {
        rewards: (data?.rewards ?? []) as SpinWheelReward[],
        summary: (data?.summary ?? null) as SpinWheelRewardsSummary | null,
        total: (res?.total ?? null) as number | null,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.rewards.length, 0);
      if (lastPage.total == null || loaded >= lastPage.total) return undefined;
      return loaded;
    },
    enabled: enabled && latitude != null && longitude != null,
    staleTime: 30_000,
  });

  const pages = query.data?.pages ?? [];
  const rewards = pages.flatMap((p) => p.rewards);
  const total = pages[0]?.total ?? null;
  const summary = pages[0]?.summary ?? null;

  return {
    rewards,
    summary,
    total,
    isLoading: query.isLoading,
    isLoadingMore: query.isFetchingNextPage,
    isError: query.isError,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
    refetch: () => query.refetch(),
  };
};

export default useSpinWheelRewards;
