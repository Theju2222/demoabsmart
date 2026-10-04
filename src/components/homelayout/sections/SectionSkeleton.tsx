"use client";

import React from "react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

// Per-section placeholder for the home layout. Each home_layout block type has
// a distinctive shape (edge-to-edge banner, chip row, product rail, …) so a
// single generic box would collapse/expand the page as the real block replaced
// it. These mirror the real blocks' boxes closely enough that swapping skeleton
// -> content causes no visible layout shift.
//
// Only used once real sections are already on screen: HomeLayout renders one
// per *incoming* section during pagination and tab switches, so the loaded
// sections above stay mounted and only the pending ones are placeholders.
// Their shapes are mirrored from sections already loaded, which is what makes
// them accurate — a FIRST load has nothing to mirror, so that path shows a
// plain Loader instead of guessing a layout.

const SectionSkeletonBody = ({ type }: { type?: string }) => {
  switch (type) {
    case "banner_slider":
      // 1200/650 (~1.85:1, BannerSliderSection's own no-image_aspect fallback)
      // is much TALLER than banners actually configured on real stores
      // (typically ~3:1) — at full viewport width that rendered taller than
      // the viewport itself, reading as an oversized/stuck loading block. A
      // wider ratio here is a closer guess at the real banner's eventual
      // shape while still erring toward a placeholder that's too SHORT rather
      // than one that dominates the page.
      return <Skeleton className="w-full aspect-[3/1] rounded-md" />;

    case "grid_banner":
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array(3)
            .fill(0)
            .map((_, index) => (
              <Skeleton key={index} className="w-full aspect-[16/9] rounded-md" />
            ))}
        </div>
      );

    case "title_image":
      return <Skeleton className="w-full aspect-[1200/300] rounded-md" />;

    case "text_section":
      return (
        <div className="py-2">
          <Skeleton width={220} height={24} className="mb-2" />
          <Skeleton width="70%" height={16} />
        </div>
      );

    case "category_section":
      return (
        <>
          <div className="flex items-center justify-between mb-4">
            <Skeleton width={150} height={24} />
            <Skeleton width={80} height={24} />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {Array(6)
              .fill(0)
              .map((_, index) => (
                <div key={index} className="flex flex-col items-center">
                  <Skeleton circle width={72} height={72} className="mb-2" />
                  <Skeleton width={56} height={14} />
                </div>
              ))}
          </div>
        </>
      );

    case "brand_section":
      return (
        <>
          <div className="flex items-center justify-between mb-4">
            <Skeleton width={150} height={24} />
            <Skeleton width={80} height={24} />
          </div>
          <div className="flex gap-6 overflow-hidden pb-2">
            {Array(6)
              .fill(0)
              .map((_, index) => (
                <div key={index} className="min-w-[120px] flex-shrink-0">
                  <Skeleton height={80} className="mb-2 rounded-md" />
                  <Skeleton width="80%" height={14} className="mx-auto" />
                </div>
              ))}
          </div>
        </>
      );

    case "product_slider":
    default:
      return (
        <>
          <div className="flex items-center justify-between mb-4">
            <Skeleton width={180} height={24} />
            <Skeleton width={100} height={24} />
          </div>
          <div className="flex gap-4 overflow-hidden pb-2">
            {Array(5)
              .fill(0)
              .map((_, index) => (
                <div key={index} className="min-w-[200px] flex-shrink-0">
                  <Skeleton height={180} className="mb-2 rounded-md" />
                  <Skeleton width="80%" height={16} className="mb-1" />
                  <Skeleton width="50%" height={16} className="mb-1" />
                  <div className="flex justify-between items-center">
                    <Skeleton width={60} height={20} />
                    <Skeleton width={40} height={20} />
                  </div>
                </div>
              ))}
          </div>
        </>
      );
  }
};

interface SectionSkeletonProps {
  // home_layout block type of the section being loaded. Unknown/absent falls
  // back to the product-rail shape, the most common section by far.
  type?: string;
  // full_width banners break out of .container, same rule as the real section.
  fullBleed?: boolean;
  className?: string;
}

const SectionSkeleton = ({
  type,
  fullBleed = false,
  className = "",
}: SectionSkeletonProps) => (
  <div
    aria-busy="true"
    aria-hidden="true"
    className={`${fullBleed ? "w-full" : "container"} my-6 ${className}`.trim()}
  >
    <SectionSkeletonBody type={type} />
  </div>
);

export default SectionSkeleton;
