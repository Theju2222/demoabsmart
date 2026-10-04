"use client";

import { useCallback, useEffect, useState } from "react";
import { t } from "@/utils/translation";
import * as api from "@/api/apiRoutes";
import { useSelector } from "react-redux";
import WishlistCard from "../productcards/WishlistCard";
import CardSkeleton from "../skeleton/CardSkeleton";
import NoWishListImage from "@/assets/empty-state/empty-whistlist.svg";
import NotFound from "../notfound/NotFound";
import useInViewFetch from "@/hooks/useInViewFetch";

const Wishlist = () => {
  const lat = useSelector((state: any) => state.City.city?.latitude);
  const lng = useSelector((state: any) => state.City.city?.longitude);
  // Wishlist product entries come straight from the getFavorite API response
  // (raw JSON shape) — `any` here matches the API-boundary policy.
  const [wishlistProducts, setWishlistProducts] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [isError, setIsError] = useState(false);

  const itemPerPage = 10;

  // `fetchOffset` is passed explicitly so load-more never reads a stale offset
  // from state. `isAppend` keeps the existing list visible (only the load-more
  // spinner shows) instead of flashing the whole grid back to skeletons.
  // Auto scroll-load can fire an instant is-append fetch right after the
  // FIRST page lands, before the user ever scrolls — e.g. page 1 (10 items)
  // is shorter than the viewport, so useScrollThresholdFetch's "already past
  // threshold" check fires immediately. On a fast connection that request
  // resolves before the skeleton even paints, so the user sees the list grow
  // with no visible sign anything loaded — reads as "did scrolling do
  // nothing?". A floor on how long the load-more skeleton stays up guarantees
  // at least one visible frame of it, win or lose the race with the response.
  const MIN_LOAD_MORE_MS = 500;

  const handleFetchLikedProducts = useCallback(
    async ({
      fetchOffset = 0,
      isAppend = false,
    }: { fetchOffset?: number; isAppend?: boolean } = {}) => {
      const startedAt = Date.now();
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setIsError(false);
      }
      try {
        const response = await api.getFavorite({
          latitude: lat,
          longitude: lng,
          limit: itemPerPage,
          offset: fetchOffset,
        });
        if (isAppend) {
          const elapsed = Date.now() - startedAt;
          if (elapsed < MIN_LOAD_MORE_MS) {
            await new Promise((r) => setTimeout(r, MIN_LOAD_MORE_MS - elapsed));
          }
        }
        if (response.status == 1) {
          setWishlistProducts((prev) =>
            isAppend ? [...prev, ...response.data] : response.data,
          );
          setTotal(response.total);
        } else if (!isAppend) {
          setWishlistProducts([]);
          setTotal(0);
        }
      } catch (error) {
        if (!isAppend) {
          setIsError(true);
        }
        console.log("Error", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [lat, lng, itemPerPage],
  );

  useEffect(() => {
    // Reset to first page whenever the city (delivery location) changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-dependency-change pattern; not derivable from render
    handleFetchLikedProducts({ fetchOffset: 0, isAppend: false });
    setOffset(0);
  }, [lat, lng, handleFetchLikedProducts]);

  const handleLoadMore = () => {
    const nextOffset = offset + itemPerPage;
    setOffset(nextOffset);
    handleFetchLikedProducts({ fetchOffset: nextOffset, isAppend: true });
  };

  const hasMore = (total ?? 0) > (wishlistProducts?.length ?? 0);
  // Sentinel-based, not whole-page-height-based: Wishlist is one section
  // inside the profile dashboard page, with a footer below it — a
  // percentage-of-the-whole-document threshold landed wherever 70% of
  // EVERYTHING fell, often deep in/near the footer, so scrolling only
  // "worked" once the user was basically all the way down. Watching a
  // sentinel placed right after this list's own last row fires as soon as
  // THAT point nears the viewport, regardless of what's below it.
  const loadMoreSentinelRef = useInViewFetch({
    enabled: hasMore && !loading && !loadingMore,
    onLoadMore: handleLoadMore,
  });

  return (
    <div className="w-full cardBorder rounded-2xl overflow-hidden">
      <div className="backgroundColor flex justify-between px-4 sm:px-5 py-4 items-center border-b">
        <h2 className="font-bold text-lg sm:text-xl">{t("wishlist")}</h2>
        {!loading && wishlistProducts?.length > 0 && (
          <span className="SecondaryTextColor text-sm font-medium">
            {total ?? wishlistProducts?.length} {t("items") || "items"}
          </span>
        )}
      </div>
      <div className="p-3 sm:p-4">
        {loading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 sm:gap-3">
            {Array?.from({ length: 8 })?.map((_, index) => (
              <CardSkeleton height={104} padding="3px" key={index} />
            ))}
          </div>
        ) : isError ? (
          <div className="grid place-items-center gap-3 py-10 text-center">
            <p className="font-semibold text-base fontColor">
              {t("something_went_wrong") || "Something went wrong"}
            </p>
            <button
              className="rounded-lg primaryBackColor py-2 px-5 text-white text-sm font-medium"
              onClick={() =>
                handleFetchLikedProducts({ fetchOffset: 0, isAppend: false })
              }
            >
              {t("retry") || t("try_again") || "Retry"}
            </button>
          </div>
        ) : wishlistProducts?.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 sm:gap-3">
            {wishlistProducts?.map((prdct) => (
              <WishlistCard
                key={prdct?.id}
                product={prdct}
                setWishlistProducts={setWishlistProducts}
                wishlistProducts={wishlistProducts}
                setTotal={setTotal}
                handleFetchLikedProducts={handleFetchLikedProducts}
              />
            ))}

            {/* Sits at the true end of the loaded list — this, not the whole
                page, is what useInViewFetch watches. */}
            {hasMore && <div ref={loadMoreSentinelRef} className="col-span-full h-px" />}

            {/* Shown whenever more pages exist, not just while one is
                in flight — a hint that scrolling further loads more, visible
                the instant the first page lands rather than only once the
                user has already scrolled to the true bottom and wondered if
                there even was more. */}
            {hasMore &&
              Array?.from({ length: loadingMore ? 4 : 2 })?.map((_, index) => (
                <CardSkeleton
                  height={104}
                  padding="3px"
                  key={`more-${index}`}
                />
              ))}
          </div>
        ) : (
          <NotFound
            image={NoWishListImage}
            title={t("enter_wishlist_message")}
            className="col-span-12"
          />
        )}

      </div>
    </div>
  );
};

export default Wishlist;