import CardSkeleton from "@/components/skeleton/CardSkeleton";

// Mirrors ActiveOrders' OWN first-load skeleton (same grid, same count, same
// order-card variant), so the RSC-fetch placeholder and the data-fetch one
// are the same picture. Inheriting the parent profile/loading.tsx instead
// showed a generic two-box shape first, then this one — two different
// shimmers for a single tab switch.
export default function Loading() {
  return (
    <div className="grid grid-cols-1 items-start gap-3 p-3 lg:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <CardSkeleton variant="order" key={index} />
      ))}
    </div>
  );
}
