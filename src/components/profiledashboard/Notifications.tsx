"use client";

import React, { useEffect, useState } from "react";
import { t } from "@/utils/translation";
import NotificationCard from "../notifications/NotificationCard";
import * as api from "../../api/apiRoutes";
import NoNotificationImage from "@/assets/empty-state/no-notification.svg";
import CardSkeleton from "../skeleton/CardSkeleton";
import NotFound from "../notfound/NotFound";
import useInViewFetch from "@/hooks/useInViewFetch";

const Notifications = () => {
  const total_notifications_per_page = 7;

  // Notification entries come straight from the getNotifications API response
  // (raw JSON shape) — `any` here matches the API-boundary policy.
  const [notifications, setNotifications] = useState<any[]>([]);
  const [currPage, setCurrPage] = useState(1);
  const [offset, setoffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [totalNotications, setTotalNotifications] = useState<number | null>(null);
  const [isError, setIsError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Scroll-triggered load-more can fire the instant the page mounts (page 1
  // shorter than the viewport), before the user has scrolled at all — on a
  // fast connection that resolves before the skeleton ever paints, which
  // reads as "did scrolling do nothing?". Flooring how long the load-more
  // skeleton stays up guarantees at least one visible frame of it.
  const MIN_LOAD_MORE_MS = 500;

  const handleFetchNotifications = async (offset = 0) => {
    const startedAt = Date.now();
    if (offset === 0) {
      setIsLoading(true);
      setIsError(false);
    } else {
      setLoadingMore(true);
    }
    try {
      const response = await api.getNotifications({
        limit: total_notifications_per_page,
        offset,
      });
      if (offset !== 0) {
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_LOAD_MORE_MS) {
          await new Promise((r) => setTimeout(r, MIN_LOAD_MORE_MS - elapsed));
        }
      }
      setTotalNotifications(response.total);
      setNotifications((prev) =>
        offset === 0 ? response.data : [...prev, ...response?.data],
      );
      setIsLoading(false);
      setLoadingMore(false);
    } catch (error) {
      setIsLoading(false);
      setLoadingMore(false);
      if (offset === 0) {
        setIsError(true);
      }
      console.log("Error ", error);
    }
  };

  // Fetch on mount. This used to be gated on `selectedTab === "notifications"`
  // back when one component rendered every profile tab at once; each tab is
  // its own route now, so reaching this component already means the tab is
  // active.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; not derivable from render
    handleFetchNotifications();
  }, []);

  const handleLoadMore = (pageNum: number) => {
    setCurrPage(pageNum);
    setoffset(
      pageNum * total_notifications_per_page - total_notifications_per_page,
    );
    handleFetchNotifications(
      pageNum * total_notifications_per_page - total_notifications_per_page,
    );
  };

  const hasMore = (notifications?.length ?? 0) < (totalNotications ?? 0);
  // Sentinel-based, not whole-page-height-based — see Wishlist.tsx's own
  // comment for why: a whole-document scroll threshold only fires once
  // basically at the true bottom on a page with other content below this
  // list, regardless of where this list itself ends.
  const loadMoreSentinelRef = useInViewFetch({
    enabled: hasMore && !isLoading && !loadingMore,
    onLoadMore: () => handleLoadMore(currPage + 1),
  });

  return (
    <div>
      <div className="cardBorder rounded-xl bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="font-bold text-lg textColor">{t("notification")}</h2>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {isLoading &&
            Array.from({ length: total_notifications_per_page }).map(
              (_, idx) => (
                <div key={idx} className="w-full">
                  <CardSkeleton height={100} padding="p-1" />
                </div>
              ),
            )}
          {notifications?.length > 0 ? (
            <>
              {notifications?.map((notification) => (
                <NotificationCard
                  notification={notification}
                  key={notification?.id}
                />
              ))}
              {/* Sits at the true end of the loaded list — this, not the
                  whole page, is what useInViewFetch watches. */}
              {hasMore && <div ref={loadMoreSentinelRef} className="h-px" />}
              {/* Shown whenever more pages exist, not just while one is in
                  flight — a persistent hint that scrolling further loads
                  more, visible as soon as the first page lands. */}
              {hasMore &&
                Array.from({ length: loadingMore ? 4 : 2 }).map((_, idx) => (
                  <div key={`m${idx}`} className="w-full">
                    <CardSkeleton height={100} padding="p-1" />
                  </div>
                ))}
            </>
          ) : !isLoading && isError ? (
            <div className="grid place-items-center gap-3 py-10 text-center">
              <p className="font-semibold text-base textColor">
                {t("something_went_wrong") || "Something went wrong"}
              </p>
              <button
                className="rounded-lg primaryBackColor py-2 px-5 text-white text-sm font-medium"
                onClick={() => handleFetchNotifications(0)}
              >
                {t("retry") || t("try_again") || "Retry"}
              </button>
            </div>
          ) : (
            !isLoading && (
              <NotFound
                image={NoNotificationImage}
                title={t("empty_notification_list_message")}
                className="col-span-12"
              />
            )
          )}
        </div>

      </div>
    </div>
  );
};

export default Notifications;