import Loader from "@/components/loader/Loader";

// Group default for every (plain) route. Next renders this the instant a
// navigation starts, so the click registers immediately instead of leaving
// the previous page on screen for the length of the RSC fetch.
//
// A Loader, not a skeleton: this group is mostly text and form pages —
// checkout, cart, contact, the policy pages, order detail. It used to render
// a 10-card product grid, which promised a layout none of those routes ever
// settle into. The handful of routes here that genuinely ARE card grids
// (brands, sellers, countries, categories) override this with
// PageSkeleton in their own loading.tsx; blogs uses its own BlogSkeleton.
export default function Loading() {
  return <Loader screen="full" />;
}
