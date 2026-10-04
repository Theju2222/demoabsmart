import ProductDetailSkeleton from "@/components/skeleton/ProductDetailSkeleton";

// Overrides the (zoned)/[zone] group's generic card-grid loading.tsx for this
// one route — a product page is never a grid of cards, so that fallback read
// as "wrong page incoming" while this one matches ProductDetail.tsx's real
// two-column shape.
export default function Loading() {
  return <ProductDetailSkeleton />;
}
