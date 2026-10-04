"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { tabIdFromSlug, slugFromTabId } from "@/utils/categoryTabSlug";
import { useDispatch, useSelector } from "react-redux";
import * as api from "@/api/apiRoutes";
import {
  setLayoutTheme,
  setSelectedCategoryId as setSelectedCategoryIdAction,
} from "@/redux/slices/shopModeSlice";
import SectionsRenderer from "./SectionsRenderer";
import SectionSkeleton from "./sections/SectionSkeleton";
import CategoryTabs from "../categories/CategoryTabs";
import Loader from "../loader/Loader";
// Rarely used (demo_mode off by default) — lazy-load to trim the bundle.
const DemoBuyNow = dynamic(() => import("../demo/DemoBuyNow"), { ssr: false });

// Exceptional-state-only components — lazy-load so the happy path skips their bytes.
const Location = dynamic(() => import("../locationmodal/Location"), {
  ssr: false,
});
const StoreClosed = dynamic(
  () => import("@/components/store-closed/StoreClosed"),
);
const StoreClosedBanner = dynamic(
  () => import("@/components/store-closed/StoreClosedBanner"),
);
const NotFound = dynamic(() => import("../notfound/NotFound"));
import NoProductSvg from "@/assets/empty-state/no-product.svg";
import { t } from "@/utils/translation";
import useIsHydrated from "@/hooks/useIsHydrated";
import useScrollThresholdFetch from "@/hooks/useScrollThresholdFetch";
import { HOME_LAYOUT_INITIAL_SECTION_LIMIT } from "@/constants/homeLayout";
import useFullCategoryTree from "@/hooks/useFullCategoryTree";

// Must match shopModeSlice's initial `mode` or the SSR query key mismatches on hydration.
const SHOP_MODE_SSR_DEFAULT = "quick";

// `initialHomeLayout` is set by getServerSideProps only when the URL resolved a
// zone: { data, latitude, longitude } where the coords are that zone's polygon
// centroid. It exists to put real home content in the server HTML for crawlers.
//
// The centroid is NOT the visitor's location — a returning user has a persisted
// city with its own coords. So this seeds the FIRST render only (matching what
// the server sent, which is what hydration requires), and redux coords take over
// as soon as they exist. That handover is a normal keyed refetch, i.e. exactly
// today's behaviour for a user with a saved city.
interface HomeLayoutProps {
  initialHomeLayout?: any;
}

const HomeLayout = ({ initialHomeLayout = null }: HomeLayoutProps) => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const city = useSelector((state: any) => state.City.city);
  const setting = useSelector((state: any) => state.Setting.setting);
  const language = useSelector((state: any) => state.Language.selectedLanguage);
  // Read here too (not just inside StoreClosedBanner) so the lazy chunk only loads when needed.
  const storeClosedSoft =
    useSelector((state: any) => state.ShopMode?.storeClosed) === true;
  // Gates `dir` until hydration so it doesn't flip and discard the tree (#418).
  const isHydrated = useIsHydrated();
  // Pre-hydration: use the SSR centroid (matches server, avoids key mismatch). Post-hydration: redux city wins.
  const latitude = !isHydrated
    ? initialHomeLayout?.latitude
    : city?.latitude ||
      setting?.default_city?.latitude ||
      initialHomeLayout?.latitude;
  const longitude = !isHydrated
    ? initialHomeLayout?.longitude
    : city?.longitude ||
      setting?.default_city?.longitude ||
      initialHomeLayout?.longitude;
  // A "category" redirect tile only carries a numeric category_id — the
  // products page's filter sidebar needs a SLUG in the URL to highlight it
  // (see resolveIdCsvToSlugCsv usage in renderBlock below). This tree is the
  // same cached query ProductFilter.tsx uses, so a same-session visit to
  // /products warms this cache instead of adding a new fetch.
  const { resolveCategoryTree } = useFullCategoryTree({
    latitude,
    longitude,
    languageId: language?.id,
  });
  // Pinned to the SSR value (initialHomeLayout.shopMode, may differ from the slice default) until hydration.
  const ssrShopMode = initialHomeLayout?.shopMode || SHOP_MODE_SSR_DEFAULT;
  const persistedShopMode = useSelector((state: any) => state.ShopMode.mode);
  const shopMode = isHydrated ? persistedShopMode : ssrShopMode;
  const prevShopMode = useRef(shopMode);
  // Tracks whether the hydration correction (ssrShopMode -> persistedShopMode)
  // has already been consumed once, separately from shopMode's own value —
  // see the effect below for why comparing prevShopMode alone isn't enough.
  const hydrationHandledRef = useRef(false);

  // Selected tab: null = backend's first tab. The URL (?tab=) is the
  // shareable/SSR-visible source of truth, but next/navigation's
  // useSearchParams() only updates a render or more AFTER router.push()
  // resolves — deriving selectedCategoryId from it alone meant a tab click
  // dispatched to redux immediately, yet the query key (and so isFetching/
  // the skeleton gate below) stayed on the OLD tab for that whole window,
  // during which the previous tab's full content kept rendering as if
  // nothing had happened. redux's selectedCategoryId updates synchronously
  // with the click (same render, via useSelector) and wins here whenever it
  // disagrees with the URL — closing that window. The URL param remains the
  // fallback for the very first render of a shared/refreshed link, before
  // any click has happened to populate redux.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabSlugParam = searchParams?.get("tab") ?? null;
  // Gated on isHydrated like latitude/longitude/shopMode above: redux-persist
  // can rehydrate a tab picked in a PRIOR session before React's hydration
  // walk commits, so reading this unconditionally let the client's first
  // render see a different selectedCategoryId than the server did (which
  // always starts from a fresh store) — a different query key meant the
  // initialData match below (line ~291) failed on the client but had
  // succeeded on the server, so the client fell back to its isLoading branch
  // while the server had rendered full content: a hydration mismatch.
  const persistedReduxCategoryId = useSelector(
    (state: any) => state.ShopMode?.selectedCategoryId,
  );
  const reduxCategoryId = isHydrated ? persistedReduxCategoryId : undefined;
  // Slug→id needs the tab list, which arrives with the data — fall back to the SSR-resolved id until then.
  const ssrCategoryId = initialHomeLayout?.categoryId ?? null;
  // Tab list to resolve ?tab= against, filtered to the current shopMode (each channel has its own list, same cache namespace).
  const knownTabs =
    (queryClient
      .getQueriesData({ queryKey: ["home-layout"] }) as any[])
      .filter(([key]: any) => key?.[5] === shopMode)
      .map(([, entry]: any) => entry?.category_tabs)
      .find((tabs: any) => Array.isArray(tabs) && tabs.length > 0) ||
    // SSR seed only valid while still on the channel the server actually rendered with.
    (shopMode === ssrShopMode
      ? initialHomeLayout?.data?.category_tabs
      : null) ||
    [];
  const resolvedFromUrl = tabIdFromSlug(knownTabs, tabSlugParam);
  // ssrCategoryId is only a valid fallback while the URL's slug hasn't been
  // checked against a real tab list yet (knownTabs still empty — nothing to
  // resolve against). Once knownTabs is populated and the slug still doesn't
  // resolve, that slug belongs to a DIFFERENT channel (e.g. a mode switch
  // whose router.push hasn't landed yet, so this render still sees the old
  // channel's ?tab=) — falling back to ssrCategoryId then reused the wrong
  // channel's id and fired one home_layout request with a category_id that
  // doesn't exist in the new channel, briefly rendering "No data found".
  const urlCategoryId = tabSlugParam
    ? (resolvedFromUrl ?? (knownTabs.length > 0 ? null : ssrCategoryId))
    : null;
  const selectedCategoryId =
    reduxCategoryId !== undefined && reduxCategoryId !== null
      ? reduxCategoryId
      : urlCategoryId;

  // Tab pick → dispatch first (updates selectedCategoryId, and so the query
  // key above, on THIS render), then push the slug into the URL so it stays
  // shareable/refreshable. Order matters: the URL push is async from
  // next/navigation's perspective, the dispatch is not.
  const setSelectedCategoryId = (id: any) => {
    dispatch(setSelectedCategoryIdAction(id));
    const slug = slugFromTabId(knownTabs, id);

    // pathname (not router.pathname, which doesn't exist on next/navigation's
    // router) carries the real zone/lang segments — middleware rewrites those
    // onto "/" as query params, but the visible URL still shows them in the path.
    const visiblePath = pathname || "/";
    const params = new URLSearchParams(searchParams?.toString());
    if (slug) params.set("tab", slug);
    else params.delete("tab");
    // zone/lang belong in the path; drop them if they leak through as query params.
    params.delete("zone");
    params.delete("lang");
    const search = params.toString();
    const nextUrl = search ? `${visiblePath}?${search}` : visiblePath;

    // scroll:false stops Next's scroll-restoration fighting the push; the
    // explicit scrollTo replaces it. push (not replace), matching the
    // original: each tab pick is its own history entry so Back steps through
    // tabs, same as Pages Router's shallow push did.
    router.push(nextUrl, { scroll: false });
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const [modeSwitching, setModeSwitching] = useState(false);

  // Device bucket for home_layout: <768 app, 768-1024 tablet, >1024 web. Starts from SSR's UA guess, corrected on mount.
  const [device, setDevice] = useState(initialHomeLayout?.device || "web");
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      let next = "web";
      if (w < 768) next = "app";
      else if (w <= 1024) next = "tablet";
      setDevice(next);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Shop mode switch: clear the tab (each mode has its own list) and invalidate the new mode's query.
  useEffect(() => {
    // The very first render post-hydration can change `shopMode` (SSR's
    // guessed default -> the visitor's actual persisted mode) even though
    // the user did nothing — that transition must never reset the tab.
    // Comparing prevShopMode alone doesn't catch this: if the persisted mode
    // happens to differ from SHOP_MODE_SSR_DEFAULT (e.g. visitor was last on
    // "allShop"), the values ARE different, so the old guard fell through to
    // `setSelectedCategoryId(null)` — which pushes the URL and strips a
    // shared/refreshed ?tab= param, landing back on the plain home tab.
    if (!hydrationHandledRef.current) {
      hydrationHandledRef.current = isHydrated;
      prevShopMode.current = shopMode;
      return;
    }
    if (prevShopMode.current === shopMode) return;
    prevShopMode.current = shopMode;
    // intentional: resets tab + starts the mode-switch loader in sync with the
    // shopMode change that triggered this effect (see comment above).
    setSelectedCategoryId(null);
    setModeSwitching(true);
    queryClient.invalidateQueries({
      queryKey: [
        "home-layout",
        latitude,
        longitude,
        language?.id,
        null,
        shopMode,
      ],
    });
    // setSelectedCategoryId is redefined every render (closes over router/knownTabs,
    // neither memoized) — adding it here would re-run this effect on unrelated
    // renders instead of only on a real shop-mode switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopMode, isHydrated, queryClient, latitude, longitude, language?.id]);

  // One query PER category (selectedCategoryId is part of the key), and
  // useInfiniteQuery caches every offset page ever fetched for that key under
  // `data.pages`. Switching All -> Category A -> All lands back on the "All"
  // key with its pages array still in cache (fresh within staleTime) — no
  // network call, and Load More there resumes at the next uncached offset
  // instead of re-fetching offset=0. This replaces the previous hand-rolled
  // extraSections/hasMoreSections/IntersectionObserver-fetch bookkeeping,
  // which re-fetched page 1 of a tab every time it was revisited because that
  // pagination state was never tied to react-query's own cache.
  const {
    data: infiniteData,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    // device IS part of this key — backend now returns a device-specific
    // layout, so a bucket change (e.g. resize across the 768/1024 breakpoints)
    // must refetch instead of reusing another bucket's cached response.
    queryKey: [
      "home-layout",
      latitude,
      longitude,
      language?.id,
      selectedCategoryId,
      shopMode,
      device,
    ],
    queryFn: async ({ pageParam }) => {
      const response = await api.getHomeLayout({
        latitude,
        longitude,
        category_id: selectedCategoryId,
        limit: HOME_LAYOUT_INITIAL_SECTION_LIMIT,
        offset: pageParam,
        device,
      });
      // status:0 = store closed; sentinel so it survives React Query caching (a setState would be skipped on cache hits).
      if (response?.status === 0 && response?.message) {
        return { storeClosed: true, message: response.message };
      }
      return response?.data ?? null;
    },
    initialPageParam: 0,
    // total_sections is the exact stop condition; a short page (fewer
    // sections than `limit`) is the fallback for a response missing it,
    // matching the old heuristic exactly.
    getNextPageParam: (lastPage: any, allPages: any[]) => {
      const nextOffset = (allPages ?? []).reduce(
        (sum, page) => sum + (page?.layout?.sections?.length ?? 0),
        0,
      );
      const totalSections = lastPage?.total_sections;
      const lastPageCount = lastPage?.layout?.sections?.length ?? 0;
      const hasMore =
        typeof totalSections === "number"
          ? nextOffset < totalSections
          : lastPageCount >= HOME_LAYOUT_INITIAL_SECTION_LIMIT;
      return hasMore ? nextOffset : undefined;
    },
    enabled: !!(latitude && longitude),
    // Only seed initialData when every key segment matches what the server actually
    // fetched with — else refetch normally. A function (not an inline object) so
    // react-query evaluates it once per queryKey instead of getting a new object
    // identity on every render, which otherwise left `data.pages` transiently
    // undefined internally and crashed getNextPageParam's caller.
    initialData: () =>
      initialHomeLayout?.data &&
      latitude === initialHomeLayout.latitude &&
      longitude === initialHomeLayout.longitude &&
      String(selectedCategoryId ?? "") === String(ssrCategoryId ?? "") &&
      shopMode === ssrShopMode
        ? { pages: [initialHomeLayout.data], pageParams: [0] }
        : undefined,
    // Keeps the previous tab's sections on screen while the new key fetches.
    // Guarded on the infinite-query shape: react-query computes hasNextPage
    // off `data.pages` as soon as placeholder data exists, so handing back
    // anything without a `pages` array (undefined on the first render for a
    // key, or a non-infinite cache entry) crashes getNextPageParam's caller
    // with "Cannot read properties of undefined (reading 'length')".
    placeholderData: (prev: any) =>
      Array.isArray(prev?.pages) && Array.isArray(prev?.pageParams)
        ? prev
        : undefined,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    // Revisiting a tab (All -> Beauty -> All) switches this query's key back
    // to one already cached and still fresh (< staleTime) — that alone must
    // never trigger a network call. Default refetchOnMount only refetches
    // STALE data, so this is normally redundant, but the idle tab-prefetch
    // below primes cache entries as background/inactive queries; explicit
    // here so a fresh key switch is never treated as a new "mount" needing
    // its own network round trip.
    refetchOnMount: false,
  });

  // Everything below that used to read the single-page `data` object
  // (theme, category_tabs, home_type, storeClosed) reads the FIRST page only
  // — those fields don't change page to page, they're set once by the tab's
  // initial (offset=0) response.
  const data = infiniteData?.pages?.[0];

  // isFetching (not queryFn) reliably clears the mode-switch loader whether data came from network or cache.
  useEffect(() => {
    if (!isFetching && modeSwitching) {
      // intentional: clears the mode-switch loader once the query settles —
      // see comment above (isFetching is the reliable signal, not queryFn).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModeSwitching(false);
    }
  }, [isFetching, modeSwitching]);

  // Channel config/delivery labels are dispatched by Layout.jsx globally. Header theme is the exception —
  // it's per-category and only available here, so dispatch it without an extra request.
  useEffect(() => {
    const tabs = data?.category_tabs;
    if (!Array.isArray(tabs) || tabs.length === 0) return;
    const activeId = selectedCategoryId ?? tabs[0]?.id;
    const activeTab = tabs.find((tab: any) => String(tab?.id) === String(activeId));
    const theme = activeTab?.background_theme ? activeTab : data?.layout;
    if (theme) dispatch(setLayoutTheme(theme));
  }, [data?.category_tabs, data?.layout, selectedCategoryId, dispatch]);

  // Warms one tab's cache on demand (hover/focus on its strip button, or the
  // idle warm-up below) so clicking it is a cache hit instead of a fresh
  // request. Fire-and-forget: no loading state tied to it, and prefetchQuery
  // no-ops for a key that's already cached and fresh.
  const prefetchTab = useCallback(
    (tabId: any) => {
      if (tabId == null || !latitude || !longitude) return;
      // Must be prefetchInfiniteQuery, matching the shape useInfiniteQuery
      // above expects under this same key ({ pages, pageParams }) — seeding
      // it via plain prefetchQuery would leave a bare page object in cache
      // that isn't an array, breaking `infiniteData.pages` the moment this
      // tab is actually opened.
      queryClient.prefetchInfiniteQuery({
        queryKey: [
          "home-layout",
          latitude,
          longitude,
          language?.id,
          tabId,
          shopMode,
          device,
        ],
        queryFn: async () => {
          const response = await api.getHomeLayout({
            latitude,
            longitude,
            category_id: tabId,
            limit: HOME_LAYOUT_INITIAL_SECTION_LIMIT,
            offset: 0,
            device,
          });
          if (response?.status === 0 && response?.message) {
            return { storeClosed: true, message: response.message };
          }
          return response?.data ?? null;
        },
        initialPageParam: 0,
        staleTime: 1000 * 60 * 5,
      });
    },
    [queryClient, latitude, longitude, language?.id, shopMode, device],
  );

  // Idle warm-up for the few tabs adjacent to the active one. Previously this
  // fired one request per tab in a single burst (N-1 simultaneous home_layout
  // calls, doubled again by StrictMode in dev) and — because its dep was the
  // `data.category_tabs` array reference, which react-query hands back fresh
  // on every result — re-ran that whole burst on EVERY tab click. Keyed on a
  // stable id string now, and capped: the rest are prefetched on hover.
  const rawCategoryTabs = data?.category_tabs;
  const tabIdsKey = useMemo(
    () =>
      Array.isArray(rawCategoryTabs)
        ? rawCategoryTabs.map((tab: any) => tab?.id).join(",")
        : "",
    [rawCategoryTabs],
  );
  useEffect(() => {
    const tabs = data?.category_tabs;
    if (!Array.isArray(tabs) || tabs.length <= 1) return;
    const activeId = selectedCategoryId ?? tabs[0]?.id;
    const activeIndex = tabs.findIndex(
      (tab: any) => String(tab?.id) === String(activeId),
    );
    // Only the immediate neighbours — the overwhelmingly likely next click.
    const neighbours = [tabs[activeIndex - 1], tabs[activeIndex + 1]].filter(
      Boolean,
    );
    const idle =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? (window as any).requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 400);
    const cancelIdle =
      typeof window !== "undefined" && "cancelIdleCallback" in window
        ? (window as any).cancelIdleCallback
        : clearTimeout;
    const handle = idle(() => {
      neighbours.forEach((tab: any) => prefetchTab(tab.id));
    });
    return () => cancelIdle(handle);
    // tabIdsKey (a stable string) stands in for the unstable tabs array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabIdsKey, selectedCategoryId, prefetchTab]);

  // First tab is deliberately NOT written to state on load — that would change the query key and refetch.
  // activeTabId (below) fixes the highlight at render time instead.

  const firstPageSectionCount = data?.layout?.sections?.length ?? 0;

  // Sections across ALL cached pages for the active category, deduped —
  // backend pagination can return a section id that already appeared on an
  // earlier offset page, so React keys (keyed by section.id) stay unique.
  const sections = useMemo(() => {
    const pages = infiniteData?.pages ?? [];
    const seenIds = new Set<any>();
    const all: any[] = [];
    for (const page of pages) {
      for (const section of page?.layout?.sections ?? []) {
        if (seenIds.has(section?.id)) continue;
        seenIds.add(section?.id);
        all.push(section);
      }
    }
    return all;
  }, [infiniteData?.pages]);

  // Shapes of the placeholders shown while sections are in flight, as a list
  // of home_layout block types (undefined = "unknown, use the default rail").
  //
  // Pagination (`replacingAll` false): the incoming page holds at most `limit`
  // sections, but the final page is usually short — total_sections, when the
  // backend sends it, says exactly how many are still outstanding, so the
  // placeholder block matches the real height of what's arriving instead of
  // always reserving a full `limit` worth that then collapses. The types are
  // mirrored from the tail of what's already loaded, since a "load more" page
  // tends to continue the same mix of rails and banners.
  //
  // Tab switch (`replacingAll` true): a full `limit` page is coming and the
  // outgoing tab's sections are the only available guess at its shape — home
  // layouts are broadly similar tab to tab, so reusing them keeps the swap
  // from jumping.
  const buildSkeletonTypes = useCallback(
    (replacingAll: boolean) => {
      const totalSections = infiniteData?.pages?.[0]?.total_sections;
      let count = HOME_LAYOUT_INITIAL_SECTION_LIMIT;
      if (!replacingAll && typeof totalSections === "number") {
        count = Math.max(0, totalSections - sections.length);
      }
      count = Math.min(count, HOME_LAYOUT_INITIAL_SECTION_LIMIT) || 1;
      // Tab switch mirrors the head of the outgoing layout (its first sections
      // are the ones about to be replaced on screen); pagination mirrors the
      // tail (the sections the new page continues from).
      const template = replacingAll
        ? sections.slice(0, count)
        : sections.slice(-count);
      return Array.from(
        { length: count },
        (_, index) => template[index]?.blocks?.[0]?.type,
      );
    },
    [infiniteData?.pages, sections],
  );

  // Next offset page starts loading once the visitor has scrolled through 70%
  // of the current content, so ~30% is still ahead of them while it lands —
  // this replaced a bottom sentinel + IntersectionObserver, which by
  // definition could only fire once they were already at the end of the list
  // and so always showed a visible stall.
  //
  // The offset itself is untouched: getNextPageParam above still sums the
  // sections already fetched and hands that back as the next `offset`, with
  // `limit` fixed at HOME_LAYOUT_INITIAL_SECTION_LIMIT. This only changes WHEN
  // that request is issued.
  //
  // Duplicate protection: `enabled` is false the whole time a page is in
  // flight (isFetchingNextPage) or the query is otherwise busy (isFetching —
  // a tab switch/refetch must not also append a page), the hook latches after
  // each fire, and useInfiniteQuery dedupes per query key on top of that, so
  // remounts and tab-visibility changes can't produce a second call for an
  // offset already requested.
  useScrollThresholdFetch({
    threshold: 0.7,
    enabled:
      !!hasNextPage &&
      !isFetchingNextPage &&
      !isFetching &&
      !!latitude &&
      !!longitude,
    onLoadMore: fetchNextPage,
  });

  // No resolved location: keep the query disabled and force the Location modal open.
  if (!latitude || !longitude) {
    return (
      <div className="min-h-[60vh]">
        <Location showLocation={true} setShowLocation={() => {}} />
      </div>
    );
  }

  // First load, before any section has ever arrived: a spinner, not section
  // skeletons. The layout's own section mix is server-driven and unknown until
  // the response lands, so any skeleton here is a guess — it rendered banner/
  // card placeholders that matched neither this store's real banner shape nor
  // its actual section order. The per-section skeletons below still apply once
  // real sections exist to mirror (tab switch / pagination).
  if (isLoading && !data) return <Loader screen="full" />;

  if (modeSwitching && isFetching) return <Loader screen="full" />;

  if (data?.storeClosed) {
    return <StoreClosed />;
  }

  const layout = data?.layout;
  const isCategoryWise = data?.home_type === "category_wise";
  const categoryTabs = isCategoryWise ? data?.category_tabs || [] : [];

  // Derived, never stored (see note above the query).
  const activeTabId = selectedCategoryId ?? categoryTabs[0]?.id ?? null;

  // No sections and no tabs to keep the bar alive → render nothing.
  if (sections.length === 0 && categoryTabs.length === 0) return null;

  // Tab-switch skeleton (sections only, tab strip stays mounted). Gated on
  // isHydrated so SSR/crawlers never see it.
  //
  // isFetchingNextPage is excluded: a "load more" fetch is also `isFetching`,
  // and treating it as a tab switch replaced the WHOLE page with a skeleton
  // every time the visitor scrolled far enough — the one thing section-level
  // loading exists to stop. Pagination now only paints placeholders BELOW the
  // sections already on screen (see the tail of the list below).
  const isSwitchingTab =
    isHydrated && isFetching && !isFetchingNextPage && !modeSwitching;
  // A tab switch swaps the whole dataset, so the sections currently rendered
  // belong to the PREVIOUS tab (placeholderData keeps them around) — they must
  // not stay on screen under the new tab's highlight. Pagination is the
  // opposite case: the incoming page appends to the same dataset, so the
  // loaded sections stay exactly as they are and only the pending ones are
  // placeholders. That distinction is the whole point of section-level
  // loading, and it's why no full-page placeholder fires on this path — that
  // would blank the already-loaded sections along with the pending ones.
  const showSectionSkeletons = isSwitchingTab || isFetchingNextPage;
  const renderedSections = isSwitchingTab ? [] : sections;
  const skeletonTypes = showSectionSkeletons
    ? buildSkeletonTypes(isSwitchingTab)
    : [];

  const backgroundStyle: React.CSSProperties = {};
  if (layout?.text_color) {
    backgroundStyle.color = layout.text_color;
  }

  return (
    <div style={backgroundStyle} dir={isHydrated ? language?.type : undefined}>
      <CategoryTabs
        categories={categoryTabs}
        selectedId={activeTabId}
        onSelect={setSelectedCategoryId}
        device={device}
      />

      {storeClosedSoft && <StoreClosedBanner />}

      <div>
          {/* Empty state only when nothing is loaded AND nothing is on its way —
              otherwise the placeholders below carry the pending state. */}
          {sections.length === 0 && !showSectionSkeletons && (
            <div className="container flex items-center justify-center min-h-[70vh]">
              <NotFound
                image={NoProductSvg}
                title={t("no_data_found")}
                size={400}
                className="!py-0 [&_img]:!max-w-[400px] [&_svg]:!max-w-[400px] [&_img]:!w-full [&_svg]:!w-full"
              />
            </div>
          )}
          <SectionsRenderer
            sections={renderedSections}
            device={device}
            resolveCategoryTree={resolveCategoryTree}
            firstPageSectionCount={firstPageSectionCount}
          />
          {/* Section-level loading. Only the sections still being fetched are
              placeholders — everything above stays mounted, rendered and
              interactive, whether this is a "load more" page appending to the
              bottom or a tab switch whose previous content react-query is
              still holding via placeholderData. */}
          <AnimatePresence>
            {showSectionSkeletons && (
              <motion.div
                key="section-skeletons"
                aria-busy="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                {skeletonTypes.map((type, index) => (
                  <SectionSkeleton
                    // Placeholders have no identity of their own; index is the
                    // key precisely because slot N is the same slot across
                    // renders (a fixed-length, non-reorderable placeholder list).
                    key={`section-skeleton-${index}`}
                    type={type}
                    fullBleed={type === "banner_slider"}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
      </div>
      {/* Back to Top now lives in the global FloatingActionDock (Layout.tsx) —
          no per-page mount needed. */}
      {/* Renders itself only when the settings API reports demo_mode: "1". */}
      <DemoBuyNow />
    </div>
  );
};

export default HomeLayout;
