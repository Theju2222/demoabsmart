import React, { useState } from "react";
import { t } from "@/utils/translation";
import Link from "next/link";
import { formatCustomDate } from "@/lib/utils";
import { TbCurrentLocation } from "react-icons/tb";
import {
  LuPackage,
  LuEye,
  LuWallet,
  LuStore,
  LuChevronDown,
  LuRotateCcw,
  LuDownload,
} from "react-icons/lu";
import ImageWithPlaceholder from "@/components/image-with-placeholder/ImageWithPlaceholder";
import CancelReasonModal from "@/components/orderdetail/CancelReasonModal";
import ReoderConfirmModal from "./ReoderConfirmModal";
import LiveTrackingModal from "./LiveTrackingModal";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import useZoneHref from "@/hooks/useZoneHref";
import useCurrency from "@/hooks/useCurrency";

// Shared status map (same status codes as Quick Orders).
const STATUS_MAP: Record<number, { label: string; cls: string }> = {
  1: { label: "paymentPending", cls: "paymentPendingStatus" },
  2: { label: "order_status_display_name_recieved", cls: "orderRecieved" },
  3: { label: "processed", cls: "orderProcessed" },
  4: { label: "order_status_display_name_shipped", cls: "orderShipped" },
  5: { label: "out_for_delivery", cls: "orderOutForDelivery" },
  6: { label: "order_status_display_name_delivered", cls: "orderDelivered" },
  7: { label: "cancelled", cls: "orderCancelled" },
  8: { label: "returned", cls: "orderReturned" },
  9: { label: "order_in_process", cls: "orderInProcess" },
  10: { label: "ready_to_pickup", cls: "orderReadyToPickup" },
};

// "KG: 100 gm" from variant_attributes
const formatAttributes = (attrs: any) =>
  Array.isArray(attrs)
    ? attrs.map((a) => `${a?.name}: ${a?.value}`).join(", ")
    : "";

interface EcomOrdersCardProps {
  order: any;
  onCancelled: () => void;
  channel: string;
  shopMode: string;
  availableModes: string;
}

// E-commerce order list rows are per-order-item. `order.id` IS the
// order_item_id used by the detail API. `other_items` lists sibling items in the
// same order_id. Kept separate from ActiveOrdersCard (Quick flow).
const EcomOrdersCard = ({ order, onCancelled, channel, shopMode, availableModes }: EcomOrdersCardProps) => {
  const zoneHref = useZoneHref();
  const { currency } = useCurrency(order);
  const [open, setOpen] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReoderModal, setShowReorderModal] = useState(false);
  const [showLiveTracking, setShowLiveTracking] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Show Reorder when:
  //   - Only one mode is available (no comparison needed), OR
  //   - Header mode matches the page tab channel
  //     (quick ↔ quick, allShop ↔ ecommerce)
  const headerMatchesTab =
    (shopMode === "quick" && channel === "quick") ||
    (shopMode === "allShop" && channel === "ecommerce");
  const showReorder = availableModes !== "both" || headerMatchesTab;

  // Ecom rows are per line-item, fulfilled separately — use the per-item
  // invoice endpoint keyed by order_item_id (order?.id), matching EcomOrderDetail.
  const handleDownloadInvoice = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await api.downloadItemInvoice({ orderItemId: order?.id });
      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      const fileLink = document.createElement("a");
      fileLink.href = fileURL;
      fileLink.setAttribute("download", `Invoice-${order?.id}.pdf`);
      document.body.appendChild(fileLink);
      fileLink.click();
      fileLink.remove();
      window.URL.revokeObjectURL(fileURL);
    } catch (error: any) {
      toast.error(
        error?.request?.statusText ||
          error?.message ||
          t("something_went_wrong"),
      );
    } finally {
      setDownloading(false);
    }
  };


  // Ecom rows are per-item (no items[]). ReoderConfirmModal expects an
  // items[]-shaped order, so adapt this row (+ any sibling other_items that
  // expose a variant_id) into that shape.
  const reorderOrder = {
    items: [
      { variant_id: order?.variant_id, quantity: order?.quantity || 1 },
      ...(Array.isArray(order?.other_items)
        ? order.other_items
            .filter((it) => it?.variant_id)
            .map((it) => ({
              variant_id: it?.variant_id,
              quantity: it?.quantity || 1,
            }))
        : []),
    ],
  };

  const status = STATUS_MAP[order?.active_status] || {
    label: "returned",
    cls: "orderReturned",
  };

  const otherCount = Array.isArray(order?.other_items)
    ? order.other_items.length
    : 0;
  const payment = order?.payment_method;
  const productName = order?.product_name || order?.name;
  // final_total is only the amount the payment method settled — for a wallet
  // (or partial-wallet) order it excludes the wallet portion, so it reads ₹0 /
  // too low on the card. The real order total is wallet + method residual.
  const walletUsed = Number(order?.wallet_balance) > 0;
  const displayTotal = walletUsed
    ? Number(order?.wallet_balance) + Number(order?.final_total || 0)
    : order?.final_total;
  // A split order (wallet + a method that settled a non-zero residual) shows
  // BOTH — "Wallet + Razorpay" — so the card doesn't hide that the wallet paid
  // most of it. Full-wallet (residual 0) shows just the method (which IS Wallet).
  const gatewayResidual = Number(order?.final_total || 0);
  const paymentLabel =
    walletUsed && Number(order?.final_total) > 0 && payment
      ? `${t("wallet") || "Wallet"} + ${payment}`
      : payment;

  // Pickup orders have no rider or courier — show a badge.
  const isPickupOrder = order?.delivery_type === "pickup";

  return (
    <div className="px-2 pb-3">
      <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_20px_-12px_rgba(16,24,40,0.14)] dark:bg-zinc-900">
        {/* Row 1: status pill + badges + invoice download */}
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.cls}`}
              style={{
                border: "none",
                backgroundColor:
                  "color-mix(in srgb, currentColor 12%, transparent)",
              }}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              <span className="whitespace-nowrap">
                {order?.order_item_status || t(status.label)}
              </span>
            </span>
            {/* Self Pickup badge */}
            {isPickupOrder && (
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <LuStore size={12} />
                {t("self_pickup") || "Self Pickup"}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadInvoice}
              disabled={downloading}
              aria-label={t("download_invoice") || t("GetInvoice") || "Download Invoice"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full textPrimaryColor transition hover:brightness-95 disabled:opacity-50"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--primary-color) 10%, transparent)",
              }}
              title={t("download_invoice") || t("GetInvoice") || "Download Invoice"}
            >
              <LuDownload size={14} />
            </button>
          </div>
        </div>

        {/* Row 2: order id + date + store */}
        <div className="px-4 pt-3">
          <p className="truncate text-[15px] font-bold leading-tight">
            {t("order")} {order?.order_number ?? `#${order?.order_id}`}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs SecondaryTextColor">
            <span>{formatCustomDate(order?.date)}</span>
            {order?.store_name && (
              <span className="flex min-w-0 items-center gap-1">
                <LuStore size={12} className="shrink-0" />
                <span className="truncate">{order?.store_name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Thumbnail + product summary (click to expand other items) */}
        <button
          type="button"
          onClick={() => otherCount > 0 && setOpen((o) => !o)}
          className={`mt-3 flex w-full items-center gap-3 px-4 text-start ${
            otherCount > 0 ? "cursor-pointer" : "cursor-default"
          }`}
        >
          <div className="relative aspect-square h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--border-color)] bg-white">
            {order?.image ? (
              <ImageWithPlaceholder
                src={order?.image}
                alt={productName || "product"}
                fill
                className="h-full w-full object-contain p-1.5"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center SecondaryTextColor">
                <LuPackage size={18} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-grow">
            <p className="truncate text-sm font-semibold leading-tight">{productName}</p>
            <p className="mt-1 truncate text-xs SecondaryTextColor">
              {otherCount > 0
                ? `+${otherCount} ${t("moteItems") || "more items"}`
                : formatAttributes(order?.variant_attributes)}
            </p>
          </div>
          {otherCount > 0 && (
            <LuChevronDown
              size={18}
              className={`shrink-0 SecondaryTextColor transition-transform duration-300 ${
                open ? "rotate-180" : ""
              }`}
            />
          )}
        </button>

        {/* Expanded other_items — grid-rows trick animates height */}
        {otherCount > 0 && (
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="mt-2 flex flex-col divide-y divide-dashed divide-[var(--border-color)] px-4">
                {/* this item first */}
                <div className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-grow truncate">
                    {productName}{" "}
                    <span className="SecondaryTextColor">
                      × {order?.quantity || 1}
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-semibold">
                    {currency}
                    {order?.final_total}
                  </span>
                </div>
                {order.other_items.map((it) => (
                  <div
                    key={it?.order_item_id}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-grow truncate">
                      {it?.product_name}{" "}
                      <span className="SecondaryTextColor">
                        × {it?.quantity || 1}
                      </span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-semibold">
                      {currency}
                      {it?.final_total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Total + payment */}
        <div className="mx-4 mt-3 flex items-center justify-between gap-2 border-t border-dashed border-[var(--border-color)] py-3">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 text-xs SecondaryTextColor">
              {t("total")}
            </span>
            <span className="truncate text-lg font-bold">
              {currency}
              {displayTotal}
            </span>
          </div>
          {payment && (
            <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/[0.03] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide SecondaryTextColor dark:bg-white/[0.06]">
              <LuWallet size={13} />
              {paymentLabel}
            </span>
          )}
        </div>

        {/* Action — detail keyed by order_item_id (order.id) */}
        <div className="@container mt-auto flex flex-col gap-2 px-4 pb-4">
          {/* Stacks by the CARD's width (@container), not the viewport. */}
          <div className="grid grid-cols-1 gap-2 @[280px]:grid-cols-2">
            {showReorder && (
              <button
                type="button"
                onClick={() => setShowReorderModal(true)}
                className="flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-color)] px-2 py-2.5 text-[13px] font-semibold transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
              >
                <LuRotateCcw size={15} className="shrink-0" />
                <span className="truncate">{t("reorder")}</span>
              </button>
            )}
            <Link
              href={zoneHref(`/order-detail/${order?.id}?type=ecommerce`)}
              className={`flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-2 py-2.5 text-[13px] font-semibold transition-colors hover:brightness-95 ${
                !showReorder ? "@[280px]:col-span-2" : ""
              }`}
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary-color) 30%, transparent)",
                backgroundColor:
                  "color-mix(in srgb, var(--primary-color) 8%, transparent)",
                color: "var(--primary-color)",
              }}
            >
              <LuEye size={15} className="shrink-0" />
              <span className="truncate">{t("view_details")}</span>
            </Link>
          </div>
          {/* Track (moved to the arrow beside the order id) + Cancel removed. */}
        </div>
      </div>

      <CancelReasonModal
        showCancelMoodal={showCancelModal}
        setShowCancelModal={setShowCancelModal}
        selectedProduct={order}
        handleFetchOrderDetail={onCancelled}
      />
      <ReoderConfirmModal
        showReoderModal={showReoderModal}
        setShowReorderModal={setShowReorderModal}
        order={reorderOrder}
        orderChannel="allShop"
      />
      <LiveTrackingModal
        showLiveTracking={showLiveTracking}
        setShowLiveTracking={setShowLiveTracking}
        order={{ ...order, id: order?.order_id }}
      />
    </div>
  );
};

export default EcomOrdersCard;
