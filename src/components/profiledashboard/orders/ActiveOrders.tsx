"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { t } from "@/utils/translation";
import ActiveOrdersCard from "./ActiveOrdersCard";
import * as api from "@/api/apiRoutes";
import CardSkeleton from "@/components/skeleton/CardSkeleton";
import OrderNotFoundImage from "@/assets/not_found_images/No_Orders.svg";
import NotFound from "../../notfound/NotFound";
import OrderChannelTabs from "./OrderChannelTabs";
import OrderDateFilter, { type OrderDateFilterValue } from "./OrderDateFilter";
import EcomOrdersList from "./EcomOrdersList";
import useInViewFetch from "@/hooks/useInViewFetch";

const ActiveOrders = () => {
  // "quick" = existing Quick Order flow (quick channel only),
  // "ecommerce" = new separate ecom_orders flow.
  // Default the order tab to the header's active shop mode so it matches what the
  // user picked up top: header "Quick" → Quick tab, header "Shop all" → All Shop.
  // ShopMode.mode is "quick" | "allShop" (NOT "ecommerce") — map allShop→ecommerce.
  const shopMode = useSelector((state: any) => state.ShopMode.mode);
  const availableModes = useSelector((state: any) => state.ShopMode.availableModes);
  const [activeChannel, setActiveChannel] = useState<string>(
    shopMode === "allShop" ? "ecommerce" : "quick",
  );

  // Keep the tab in sync if the header mode changes while this page is open.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs tab with header shop mode
    setActiveChannel(shopMode === "allShop" ? "ecommerce" : "quick");
  }, [shopMode]);
  const [loading, setLoading] = useState(false);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [totalOrders, setTotalOrders] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dateFilter, setDateFilter] = useState<OrderDateFilterValue | null>(null);

  const ordersPerPage = 10;
  // Scroll-triggered load-more can fire the instant the page mounts (page 1
  // shorter than the viewport), before the user has scrolled at all — on a
  // fast connection that resolves before the skeleton ever paints, which
  // reads as "did scrolling do nothing?". Flooring how long the load-more
  // skeleton stays up guarantees at least one visible frame of it.
  const MIN_LOAD_MORE_MS = 500;

  const handleFetchActiveOrders = async (isLoadMore = false, newOffset?: number) => {
    const startedAt = Date.now();
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await api.getOrders({
        limit: ordersPerPage,
        offset: newOffset,
        type: 1,
        orderType: "",
        channel: "quick",
        startDate: dateFilter?.startDate,
        endDate: dateFilter?.endDate,
      });
      if (isLoadMore) {
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_LOAD_MORE_MS) {
          await new Promise((r) => setTimeout(r, MIN_LOAD_MORE_MS - elapsed));
        }
      }
      if (response.status == 1) {
        if (isLoadMore) {
          setActiveOrders((ord) => [...ord, ...response.data]);
        } else {
          setActiveOrders(response.data);
        }
        setTotalOrders(response.total);
        setHasMore(response.data?.length === ordersPerPage);
        setLoading(false);
        setLoadingMore(false);
      } else {
        setActiveOrders([]);
        setLoading(false);
        setTotalOrders(0);
        setHasMore(false);
        setLoadingMore(false);
      }
    } catch (error: any) {
      console.log("Error", error);
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Guards against React StrictMode's dev-only double-invoke of this effect
  // firing handleFetchActiveOrders() twice for the same dateFilter — a ref
  // (not state) so the write is synchronous and visible to the phantom
  // mount→cleanup→remount cycle, same pattern as EcomOrderDetail.tsx's
  // fetchedOrderItemIdRef / CartDrawer's openFetchedRef.
  const fetchedDateFilterRef = useRef<OrderDateFilterValue | null | undefined>(
    undefined,
  );

  useEffect(() => {
    if (fetchedDateFilterRef.current === dateFilter) return;
    fetchedDateFilterRef.current = dateFilter;
    setOffset(0);
    handleFetchActiveOrders(false, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  const handleFetchMore = async () => {
    setLoadingMore(true);
    const newOffset = offset + ordersPerPage;
    setOffset(newOffset);
    handleFetchActiveOrders(true, newOffset);
  };

  // Sentinel-based, not whole-page-height-based — see PrevOrder.tsx's own
  // comment for why: a percentage-of-the-whole-document threshold landed
  // wherever 70% of EVERYTHING (footer included) fell, often well past this
  // list's own end.
  const loadMoreSentinelRef = useInViewFetch({
    enabled: activeChannel !== "ecommerce" && hasMore && !loading && !loadingMore,
    onLoadMore: handleFetchMore,
  });

  return (
    <div className="w-full overflow-hidden rounded-lg border border-[var(--border-color)]">
      <OrderChannelTabs
        active={activeChannel}
        onChange={setActiveChannel}
        title={t("active_orders")}
      >
        <OrderDateFilter value={dateFilter} onApply={setDateFilter} />
      </OrderChannelTabs>

      {activeChannel === "ecommerce" ? (
        <EcomOrdersList type={1} dateFilter={dateFilter} />
      ) : (
        <>
          {activeOrders.length === 0 && !loading ? (
            <NotFound image={OrderNotFoundImage} title={t("no_order")} />
          ) : (
            <div className="grid grid-cols-1 items-start gap-3 p-3 lg:grid-cols-2 2xl:grid-cols-3">
              {loading
                ? Array?.from({ length: 6 })?.map((_, index) => (
                    <CardSkeleton variant="order" key={index} />
                  ))
                : activeOrders?.map((order) => (
                    <ActiveOrdersCard
                      order={order}
                      key={order?.id}
                      channel={activeChannel}
                      shopMode={shopMode}
                      availableModes={availableModes}
                      onCancelled={() => handleFetchActiveOrders(false, 0)}
                    />
                  ))}
              {/* Sits at the true end of the loaded list — this, not the
                  whole page, is what useInViewFetch watches. */}
              {hasMore && (
                <div ref={loadMoreSentinelRef} className="col-span-full h-px" />
              )}

              {/* Shown whenever more pages exist, not just while one is in
                  flight — a persistent hint that scrolling further loads
                  more, visible as soon as the first page lands. */}
              {hasMore
                ? Array?.from({ length: loadingMore ? 3 : 2 })?.map(
                    (_, index) => (
                      <CardSkeleton variant="order" key={`m${index}`} />
                    ),
                  )
                : null}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ActiveOrders;