import Loader from "@/components/loader/Loader";

// Overrides the (plain) group's PageSkeleton for page-builder routes. That
// skeleton draws a breadcrumb + title + product-card grid, which is the shape
// of the listing/profile pages it was written for — a builder page is a stack
// of server-driven sections (banners, sliders, tabs) with no cards or title
// bar, so the placeholder promised a layout that never arrived. A spinner
// makes no claim about the layout while still showing the click registered.
export default function Loading() {
  return <Loader screen="full" />;
}
