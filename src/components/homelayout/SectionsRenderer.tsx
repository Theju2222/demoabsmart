"use client";

import React from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { toCssRadius, toCssRadiusCorners } from "@/utils/helperFunction";
import SectionSkeleton from "./sections/SectionSkeleton";

// Section components split into their own chunks (ssr stays on, so markup/LCP
// timing is unchanged) — the sections mix is server-driven per request, so
// every type is a "could be first" candidate and none can be dropped eagerly.
const TextSection = dynamic(() => import("./sections/TextSection"));
const ProductSliderSection = dynamic(
  () => import("./sections/ProductSliderSection"),
);
const BannerSliderSection = dynamic(
  () => import("./sections/BannerSliderSection"),
  {
    // Reserves the banner's typical box (API's default aspect ratio) before
    // the chunk arrives — without this the section is 0-height until the
    // dynamic import resolves, then pops in and shifts every section below
    // it (a forced-reflow/CLS source flagged by PageSpeed).
    loading: () => (
      <div className="w-full aspect-[1200/650] animate-pulse bg-black/5" />
    ),
  },
);
const CategorySection = dynamic(() => import("./sections/CategorySection"));
const BrandSection = dynamic(() => import("./sections/BrandSection"));
const ProductTabsSection = dynamic(
  () => import("./sections/ProductTabsSection"),
);
const GridBannerSection = dynamic(
  () => import("./sections/GridBannerSection"),
);
const TitleImageSection = dynamic(
  () => import("./sections/TitleImageSection"),
);

// Marks the first block of the first section eager (not lazy) so it's the LCP element.
const renderBlock = (
  block: any,
  sectionRadius: string | number | undefined,
  device: string,
  resolveCategoryTree: () => Promise<any[]>,
  isLcpCandidate = false,
) => {
  switch (block?.type) {
    case "text_section":
      return (
        <TextSection
          block={block}
          borderRadius={sectionRadius}
          resolveCategoryTree={resolveCategoryTree}
        />
      );
    case "product_slider":
      return (
        <ProductSliderSection
          block={block}
          borderRadius={sectionRadius}
          device={device}
        />
      );
    case "banner_slider":
      return (
        <BannerSliderSection
          block={block}
          borderRadius={sectionRadius}
          device={device}
          priority={isLcpCandidate}
          resolveCategoryTree={resolveCategoryTree}
        />
      );
    case "grid_banner":
      return (
        <GridBannerSection
          block={block}
          borderRadius={sectionRadius}
          device={device}
          priority={isLcpCandidate}
          resolveCategoryTree={resolveCategoryTree}
        />
      );
    case "title_image":
      return (
        <TitleImageSection
          block={block}
          borderRadius={sectionRadius}
          device={device}
          priority={isLcpCandidate}
          resolveCategoryTree={resolveCategoryTree}
        />
      );
    case "category_section":
      return (
        <CategorySection
          block={block}
          borderRadius={sectionRadius}
          device={device}
        />
      );
    case "brand_section":
      return (
        <BrandSection block={block} borderRadius={sectionRadius} device={device} />
      );
    case "product_tabs":
      return (
        <ProductTabsSection
          block={block}
          borderRadius={sectionRadius}
          device={device}
        />
      );
    default:
      return null;
  }
};

interface SectionsRendererProps {
  sections: any[];
  device: string;
  resolveCategoryTree: () => Promise<any[]>;
  // Sections at/after this index get the paginated-in fade+slide entrance
  // (a "load more" page appended below what's already on screen). Defaults to
  // the full length, i.e. every section is treated as already on screen —
  // the right default for a page with no pagination (a page-builder page).
  firstPageSectionCount?: number;
}

const SectionsRenderer = ({
  sections,
  device,
  resolveCategoryTree,
  firstPageSectionCount,
}: SectionsRendererProps) => {
  const pageBoundary = firstPageSectionCount ?? sections.length;

  return (
    <>
      {sections.map((section: any, sectionIndex: number) => {
        // API moved from a flat `border_radius` number to a per-corner
        // `border_radius_corners` object ({top_left, top_right,
        // bottom_left, bottom_right}) — prefer the new shape, falling
        // back to the old one for any response that hasn't switched yet.
        const sectionRadius =
          toCssRadiusCorners(section?.border_radius_corners) ??
          toCssRadius(section?.border_radius);
        // full_width banner breaks out of .container to span viewport edge-to-edge
        const isFullBleed =
          section?.blocks?.[0]?.type === "banner_slider" &&
          section?.blocks?.[0]?.config?.carousel_style === "full_width";
        // Sections past the first page arrived from a "load more" fetch —
        // fade+slide them in so appending doesn't pop the layout instantly.
        // initial={false} for page-1 sections: they're already on screen,
        // never re-run the entrance (matches ProductsList's isNew pattern).
        const isPaginatedIn = sectionIndex >= pageBoundary;
        return (
          <motion.div
            key={section?.id}
            className={isFullBleed ? "w-full" : "container"}
            initial={isPaginatedIn ? { opacity: 0, y: 24 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              marginTop: section?.margin_top || undefined,
              marginBottom: section?.margin_bottom || undefined,
              borderRadius: sectionRadius,
              overflow: sectionRadius ? "hidden" : undefined,
            }}
          >
            {(section?.blocks || []).map((block: any, blockIndex: number) => (
              // Each block's component is a dynamic() chunk. Without a Suspense
              // boundary here, the chunk request a newly-paginated section
              // triggers suspends the whole tree up to Next's route-level
              // LoadingBoundary, which swaps the entire page for loading.tsx's
              // full-screen Loader mid-scroll. Catching it per block keeps the
              // already-rendered sections on screen and shows only a
              // section-shaped placeholder in the incoming block's slot.
              <React.Suspense
                key={block?.id}
                fallback={<SectionSkeleton type={block?.type} />}
              >
                {renderBlock(
                  block,
                  sectionRadius,
                  device,
                  resolveCategoryTree,
                  sectionIndex === 0 && blockIndex === 0,
                )}
              </React.Suspense>
            ))}
          </motion.div>
        );
      })}
    </>
  );
};

export default SectionsRenderer;
