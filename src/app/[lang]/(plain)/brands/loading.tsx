import PageSkeleton from "@/components/skeleton/PageSkeleton";

// Overrides the (plain) group's Loader: this route really is a card grid, so
// a grid placeholder reserves the right shape instead of a centered spinner.
export default function Loading() {
  return <PageSkeleton />;
}
