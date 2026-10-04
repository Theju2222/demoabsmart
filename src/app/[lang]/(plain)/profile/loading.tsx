import CardSkeleton from "@/components/skeleton/CardSkeleton";

// Renders INSIDE profile/layout.tsx, so this covers only the tab content area
// — the sidebar stays on screen throughout. It replaces a skeleton of the
// whole shell (sidebar included), which made every tab click look like a full
// page reload of a page whose left half never changes.
//
// This file must exist: without it the (plain) group's loading.tsx takes over
// and paints a breadcrumb + product-card grid, which fits this route worse.
export default function Loading() {
  return (
    <div className="flex flex-col gap-2">
      <CardSkeleton height={50} />
      <CardSkeleton height={400} />
    </div>
  );
}
