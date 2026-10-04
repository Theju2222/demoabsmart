import React from "react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

// Route-level placeholder rendered by each group's loading.tsx while the App
// Router waits on the next page's RSC payload. Without one, Next keeps the
// CURRENT page on screen for the whole wait, so a click looks ignored for
// 1-2s and users click again.
//
// Deliberately generic — one shape stands in for every route in the group, so
// it reads as "the page is coming" rather than pretending to predict a layout
// it can't know. The breadcrumb strip plus a title and a card grid matches the
// broad shape of most pages here (listings, categories, profile sections).
const PageSkeleton = () => (
  <section className="bodyBackgroundColor min-h-screen">
    {/* Breadcrumb strip */}
    <div className="border-b border-[var(--border-color)]">
      <div className="container py-3">
        <Skeleton height={14} width={180} />
      </div>
    </div>

    <div className="container py-6">
      {/* Page title */}
      <div className="mb-6">
        <Skeleton height={28} width={260} />
        <div className="mt-2">
          <Skeleton height={14} width={340} />
        </div>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton height={160} borderRadius={12} />
            <Skeleton height={14} width="80%" />
            <Skeleton height={14} width="50%" />
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default PageSkeleton;
