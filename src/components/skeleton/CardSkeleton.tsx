import React from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface CardSkeletonProps {
  height?: number | string;
  width?: number | string;
  padding?: string;
  variant?: "block" | "list" | "order";
}

// `variant="list"` mirrors ListViewProductCard: a short horizontal row with the
// thumbnail on the left and the text column beside it. The default block shape
// is a tall rectangle, which is right for the vertical grid card but wrong in
// list view — it rendered ~300px tall stacked blocks under real 140px rows, so
// the placeholder didn't match what loaded in.
const CardSkeleton = ({ height, width = "100%", padding, variant = "block" }: CardSkeletonProps) => {
    // `variant="order"` mirrors PrevOrderCard/ActiveOrdersCard/EcomOrdersCard's
    // real structure (status pill + date, order id, one product row, a total/
    // payment-method row, two action buttons) — the flat `height` rectangle
    // those cards used before was a visibly different shape/height than the
    // real card it was standing in for.
    if (variant === "order") {
        return (
            <div className={`px-4 py-2 ${padding ?? ""}`}>
                <div className="flex w-full flex-col overflow-hidden rounded-lg border border-[var(--border-color)] shadow-sm">
                    <div className="flex items-center justify-between gap-2 px-4 pt-4">
                        <Skeleton height={22} width={110} borderRadius={9999} />
                        <Skeleton height={28} width={28} borderRadius={9999} />
                    </div>
                    <div className="px-4 pt-2">
                        <Skeleton height={12} width={120} />
                    </div>
                    <div className="px-4 pt-1">
                        <Skeleton height={16} width={140} />
                    </div>
                    <div className="mt-3 flex w-full items-center gap-3 px-4">
                        <Skeleton height={48} width={48} borderRadius={8} />
                        <div className="min-w-0 flex-grow">
                            <Skeleton height={14} width="70%" />
                            <div className="mt-1">
                                <Skeleton height={11} width="40%" />
                            </div>
                        </div>
                        <Skeleton height={16} width={50} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-[var(--border-color)] px-4 py-3">
                        <Skeleton height={20} width={90} />
                        <Skeleton height={14} width={60} />
                    </div>
                    <div className="flex gap-2 px-4 pb-4">
                        <Skeleton height={40} width="100%" borderRadius={8} />
                        <Skeleton height={40} width="100%" borderRadius={8} />
                    </div>
                </div>
            </div>
        );
    }

    if (variant === "list") {
        return (
            <div className={`flex w-full ${padding ?? ""}`}>
                <div className="flex flex-row w-full min-h-[140px] gap-3 p-2.5 sm:p-3 border rounded-lg cardBorder">
                    {/* Thumbnail — same footprint as the real card's image box */}
                    <div className="shrink-0 self-start w-24 h-24 sm:w-28 sm:h-28">
                        <Skeleton height="100%" width="100%" borderRadius={12} />
                    </div>
                    {/* Text column: title, subtitle, price, then the action row
                        pinned to the bottom like the real card's mt-auto button. */}
                    <div className="flex flex-1 min-w-0 flex-col">
                        <Skeleton height={14} width="85%" />
                        <div className="mt-1">
                            <Skeleton height={12} width="45%" />
                        </div>
                        <div className="mt-2">
                            <Skeleton height={16} width="30%" />
                        </div>
                        <div className="mt-auto pt-2">
                            <Skeleton height={40} width="100%" borderRadius={8} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex  w-full ${padding}`}>
            <div className="w-full border rounded-lg cardBorder p-4">
                <Skeleton height={height} width={width} />
            </div>
        </div>
    );
};

export default CardSkeleton;
