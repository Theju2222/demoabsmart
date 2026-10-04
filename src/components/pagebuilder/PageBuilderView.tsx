"use client";

import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import * as api from "@/api/apiRoutes";
import SectionsRenderer from "@/components/homelayout/SectionsRenderer";
import Custom404 from "@/components/notfound/Custom404";
import Loader from "@/components/loader/Loader";
import useFullCategoryTree from "@/hooks/useFullCategoryTree";
import useIsHydrated from "@/hooks/useIsHydrated";
import useScrollThresholdFetch from "@/hooks/useScrollThresholdFetch";
import { PAGE_BUILDER_SECTION_LIMIT } from "@/constants/homeLayout";

// `initialPage` is set by the server route only when it resolved coordinates
// to seed with: { data, latitude, longitude, device }. Same seeding contract
// as HomeLayout's `initialHomeLayout` — matches the server's render for
// hydration, then redux coords take over once hydrated.
interface PageBuilderViewProps {
  slug: string;
  initialPage?: any;
}

const PageBuilderView = ({ slug, initialPage = null }: PageBuilderViewProps) => {
  const city = useSelector((state: any) => state.City.city);
  const setting = useSelector((state: any) => state.Setting.setting);
  const language = useSelector((state: any) => state.Language.selectedLanguage);
  const isHydrated = useIsHydrated();

  const latitude = !isHydrated
    ? initialPage?.latitude
    : city?.latitude || setting?.default_city?.latitude || initialPage?.latitude;
  const longitude = !isHydrated
    ? initialPage?.longitude
    : city?.longitude || setting?.default_city?.longitude || initialPage?.longitude;

  const { resolveCategoryTree } = useFullCategoryTree({
    latitude,
    longitude,
    languageId: language?.id,
  });

  // Device bucket: same resize-based bucket as HomeLayout — sections inside
  // (banner_slider, product_tabs, ...) pick per-device image/aspect fields.
  const [device, setDevice] = useState(initialPage?.device || "web");
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

  // Paginated like home_layout: `limit` sections per request, next `offset` =
  // sections fetched so far, stop at the response's `total_sections`.
  const seed = initialPage?.data
    ? { pages: [initialPage.data], pageParams: [0] }
    : undefined;

  const {
    data,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["page-builder", slug, latitude, longitude, language?.id],
    queryFn: async ({ pageParam }) => {
      const response = await api.getPageBuilder({
        slug,
        latitude,
        longitude,
        limit: PAGE_BUILDER_SECTION_LIMIT,
        offset: pageParam,
      });
      return response?.data ?? null;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any, allPages: any[]) => {
      const nextOffset = (allPages ?? []).reduce(
        (sum, p) => sum + (p?.page?.sections?.length ?? 0),
        0,
      );
      const total = lastPage?.total_sections;
      const lastCount = lastPage?.page?.sections?.length ?? 0;
      const hasMore =
        typeof total === "number"
          ? nextOffset < total
          : lastCount >= PAGE_BUILDER_SECTION_LIMIT;
      return hasMore ? nextOffset : undefined;
    },
    enabled: !!slug && !!latitude && !!longitude,
    initialData: () =>
      seed &&
      latitude === initialPage.latitude &&
      longitude === initialPage.longitude
        ? seed
        : undefined,
    // Hydration moves the coords from the SSR seed (settings default_city) to
    // the persisted redux city, which changes the query key — keeping the
    // previous/seeded pages as placeholder keeps the rendered sections on
    // screen and makes the coord change a silent background refresh.
    placeholderData: (prev: any) =>
      Array.isArray(prev?.pages) && Array.isArray(prev?.pageParams)
        ? prev
        : seed,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  useScrollThresholdFetch({
    threshold: 0.7,
    enabled: !!hasNextPage && !isFetchingNextPage && !isFetching,
    onLoadMore: fetchNextPage,
  });

  // Section ids can repeat across offset pages in theory; dedupe so React keys
  // stay unique.
  const sections = useMemo(() => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const p of data?.pages ?? []) {
      for (const s of p?.page?.sections ?? []) {
        const key = String(s?.id ?? "");
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        out.push(s);
      }
    }
    return out;
  }, [data?.pages]);

  // A spinner, not a section skeleton: the page's own section mix is unknown
  // until the response lands, so a guessed banner/product-rail skeleton just
  // rendered placeholder cards that looked nothing like the real page. Still
  // shows SOMETHING — rendering nothing here reads as a dead click, with no
  // sign the navigation actually did anything.
  if (isLoading && !data) return <Loader screen="full" />;

  const page = data?.pages?.[0]?.page;

  if (!isLoading && (!page || sections.length === 0)) {
    return <Custom404 />;
  }

  return (
    <div>
      <SectionsRenderer
        sections={sections}
        device={device}
        resolveCategoryTree={resolveCategoryTree}
      />
    </div>
  );
};

export default PageBuilderView;
