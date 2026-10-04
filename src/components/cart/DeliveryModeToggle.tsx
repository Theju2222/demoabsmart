import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { t } from "@/utils/translation";
import { setDeliveryType } from "@/redux/slices/checkoutSlice";
import { RiPhoneLine } from "react-icons/ri";
import { FaDirections } from "react-icons/fa";
import { LuStore } from "react-icons/lu";
import { SlLocationPin } from "react-icons/sl";

// Delivery mode's own icon (a package/parcel outline) — the toggle used
// react-icons' RiTruckLine before, but the design now specifies this exact
// mark. currentColor, not a fixed fill, so it picks up the button's own
// active/inactive text colour the way the react-icons swap did.
const DeliveryIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className="shrink-0"
    aria-hidden
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1.25C11.3953 1.25 10.8384 1.40029 10.2288 1.65242C9.64008 1.89588 8.95633 2.25471 8.1049 2.70153L6.03739 3.78651C4.99242 4.33487 4.15616 4.77371 3.51047 5.20491C2.84154 5.65164 2.32632 6.12201 1.95112 6.75918C1.57718 7.39421 1.40896 8.08184 1.32829 8.90072C1.24999 9.69558 1.24999 10.6731 1.25 11.9026V12.0974C1.24999 13.3268 1.24999 14.3044 1.32829 15.0993C1.40896 15.9182 1.57718 16.6058 1.95112 17.2408C2.32632 17.878 2.84154 18.3484 3.51047 18.7951C4.15616 19.2263 4.99241 19.6651 6.03737 20.2135L8.10481 21.2984C8.95628 21.7453 9.64006 22.1041 10.2288 22.3476C10.8384 22.5997 11.3953 22.75 12 22.75C12.6047 22.75 13.1616 22.5997 13.7712 22.3476C14.3599 22.1041 15.0437 21.7453 15.8951 21.2985L17.9626 20.2135C19.0076 19.6651 19.8438 19.2263 20.4895 18.7951C21.1585 18.3484 21.6737 17.878 22.0489 17.2408C22.4228 16.6058 22.591 15.9182 22.6717 15.0993C22.75 14.3044 22.75 13.3269 22.75 12.0975V11.9025C22.75 10.6731 22.75 9.69557 22.6717 8.90072C22.591 8.08184 22.4228 7.39421 22.0489 6.75918C21.6737 6.12201 21.1585 5.65164 20.4895 5.20491C19.8438 4.77371 19.0076 4.33487 17.9626 3.7865L15.8951 2.70154C15.0437 2.25472 14.3599 1.89589 13.7712 1.65242C13.1616 1.40029 12.6047 1.25 12 1.25ZM8.7708 4.04608C9.66052 3.57917 10.284 3.2528 10.802 3.03856C11.3062 2.83004 11.6605 2.75 12 2.75C12.3395 2.75 12.6938 2.83004 13.198 3.03856C13.716 3.2528 14.3395 3.57917 15.2292 4.04608L17.2292 5.09563C18.3189 5.66748 19.0845 6.07032 19.6565 6.45232C19.9387 6.64078 20.1604 6.81578 20.3395 6.99174L17.0088 8.65708L8.50895 4.18349L8.7708 4.04608ZM6.94466 5.00439L6.7708 5.09563C5.68111 5.66747 4.91553 6.07032 4.34352 6.45232C4.06131 6.64078 3.83956 6.81578 3.66054 6.99174L12 11.1615L15.3572 9.48289L7.15069 5.16369C7.07096 5.12173 7.00191 5.06743 6.94466 5.00439ZM2.93768 8.30737C2.88718 8.52125 2.84901 8.76413 2.82106 9.04778C2.75084 9.7606 2.75 10.6644 2.75 11.9415V12.0585C2.75 13.3356 2.75084 14.2394 2.82106 14.9522C2.88974 15.6494 3.02022 16.1002 3.24367 16.4797C3.46587 16.857 3.78727 17.1762 4.34352 17.5477C4.91553 17.9297 5.68111 18.3325 6.7708 18.9044L8.7708 19.9539C9.66052 20.4208 10.284 20.7472 10.802 20.9614C10.9656 21.0291 11.1134 21.0832 11.25 21.1255V12.4635L2.93768 8.30737ZM12.75 21.1255C12.8866 21.0832 13.0344 21.0291 13.198 20.9614C13.716 20.7472 14.3395 20.4208 15.2292 19.9539L17.2292 18.9044C18.3189 18.3325 19.0845 17.9297 19.6565 17.5477C20.2127 17.1762 20.5341 16.857 20.7563 16.4797C20.9798 16.1002 21.1103 15.6494 21.1789 14.9522C21.2492 14.2394 21.25 13.3356 21.25 12.0585V11.9415C21.25 10.6644 21.2492 9.7606 21.1789 9.04778C21.151 8.76412 21.1128 8.52125 21.0623 8.30736L17.75 9.96352V13C17.75 13.4142 17.4142 13.75 17 13.75C16.5858 13.75 16.25 13.4142 16.25 13V10.7135L12.75 12.4635V21.1255Z"
      fill="currentColor"
    />
  </svg>
);

// Pickup mode's own icon (a shopping-bag outline) — replaces RiStoreLine.
const PickupIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 18 18"
    fill="none"
    className="shrink-0"
    aria-hidden
  >
    <path
      d="M6.375 10.6875C6.375 12.1275 7.56 13.3125 9 13.3125C10.44 13.3125 11.625 12.1275 11.625 10.6875"
      stroke="currentColor"
      strokeWidth="1.125"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.60758 1.5L3.89258 4.2225"
      stroke="currentColor"
      strokeWidth="1.125"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11.3926 1.5L14.1076 4.2225"
      stroke="currentColor"
      strokeWidth="1.125"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M1.5 5.88745C1.5 4.49995 2.2425 4.38745 3.165 4.38745H14.835C15.7575 4.38745 16.5 4.49995 16.5 5.88745C16.5 7.49995 15.7575 7.38745 14.835 7.38745H3.165C2.2425 7.38745 1.5 7.49995 1.5 5.88745Z"
      stroke="currentColor"
      strokeWidth="1.125"
    />
    <path
      d="M2.625 7.5L3.6825 13.98C3.9225 15.435 4.5 16.5 6.645 16.5H11.1675C13.5 16.5 13.845 15.48 14.115 14.07L15.375 7.5"
      stroke="currentColor"
      strokeWidth="1.125"
      strokeLinecap="round"
    />
  </svg>
);

interface DeliveryModeToggleProps {
  /** Full cart response data from api.getCart() */
  checkoutData: any;
  /** True while a re-price fetch for the current toggle selection is in
   * flight. checkoutData/pickupData are the PREVIOUS mode's response until
   * that fetch resolves — showing the pickup card (or its unavailable_reason
   * banner) off stale data during that window can flash the wrong store's
   * info or a stale warning. Suppressed when true. */
  totalsLoading?: boolean;
  /** Called synchronously, before dispatch, when the user picks a mode — lets
   * the parent flip its own loading flag in the SAME click handler instead of
   * only inside the refetch effect (which fires one render later: dispatch →
   * re-render with stale checkoutData still visible → then the effect sets
   * loading). That one-render gap is what let the pickup card/banner flash
   * stale info, worse on a slow connection where it lingers visibly. */
  onBeforeToggle?: () => void;
  /** True for a signed-out cart drawer, where this toggle is shown for
   * display only (no repricing wired to it — the guest cart endpoint has no
   * per-mode pricing to switch between). Suppresses the pickup store details
   * card below the pills: that card is real store info promising "ready for
   * pickup in N mins" for an order the guest can't actually place yet
   * (checkout requires login), so showing it here overpromised. The pills
   * themselves still show. */
  isGuest?: boolean;
}

/**
 * Delivery-mode pill toggle + pickup-store info card.
 *
 * Shows ONLY when checkoutData has been loaded. Renders:
 *  - A two-pill toggle (Delivery / Self Pickup) when both modes are available.
 *  - A single non-interactive label when only one mode is available.
 *  - A pickup store details card below the toggle when mode = pickup.
 *
 * On toggle, dispatches setDeliveryType which triggers handleFetchCheckout
 * (via checkout.deliveryType dep) to re-price the cart in the new mode.
 */
const DeliveryModeToggle = ({
  checkoutData,
  totalsLoading = false,
  onBeforeToggle,
  isGuest = false,
}: DeliveryModeToggleProps) => {
  const dispatch = useDispatch();
  const deliveryType = useSelector(
    (state: any) => state.Checkout.deliveryType as "delivery" | "pickup",
  );

  if (!checkoutData) return null;

  const deliveryAvailable = Number(checkoutData?.delivery_available) === 1;
  const pickupData = checkoutData?.pickup;
  const pickupAvailable = Number(checkoutData?.pickup_available) === 1;

  // Nothing to show if neither mode is flagged.
  if (!deliveryAvailable && !pickupAvailable) return null;
  // Only delivery available and we are in delivery mode — nothing extra to show.
  if (deliveryAvailable && !pickupAvailable && deliveryType === "delivery")
    return null;

  const showToggle = deliveryAvailable && pickupAvailable;
  const showPickupCard =
    !isGuest &&
    !totalsLoading &&
    (deliveryType === "pickup" || !deliveryAvailable) &&
    pickupData;

  // Turn-by-turn from the store's own lat/lng (more accurate than
  // re-geocoding the address text); falls back to a text search when only the
  // address string is present, and to nothing when neither is.
  const directionsHref = (() => {
    if (pickupData?.latitude != null && pickupData?.longitude != null) {
      return `https://www.google.com/maps/dir/?api=1&destination=${pickupData.latitude},${pickupData.longitude}`;
    }
    if (pickupData?.address) {
      return `https://maps.google.com/?q=${encodeURIComponent(pickupData.address)}`;
    }
    return null;
  })();

  const handleToggle = (mode: "delivery" | "pickup") => {
    if (mode === deliveryType) return;
    onBeforeToggle?.();
    dispatch(setDeliveryType({ data: mode }));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Mode toggle */}
      {showToggle && (
        <div
          className="flex items-center gap-1 rounded-lg p-1 shadow-sm"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--primary-color) 8%, transparent)",
          }}
        >
          <button
            type="button"
            id="delivery-mode-btn"
            onClick={() => handleToggle("delivery")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all ${deliveryType === "delivery"
                ? "primaryLightBack primaryColor primaryColorBorder"
                : "border-transparent SecondaryTextColor hover:primaryColor"
              }`}
          >
            <DeliveryIcon size={16} />
            {t("delivery") || "Delivery"}
          </button>

          <button
            type="button"
            id="self-pickup-mode-btn"
            onClick={() => handleToggle("pickup")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all ${deliveryType === "pickup"
                ? "primaryLightBack primaryColor primaryColorBorder"
                : "border-transparent SecondaryTextColor hover:primaryColor"
              }`}
          >
            <PickupIcon size={16} />
            {t("self_pickup") || "Self Pickup"}
          </button>
        </div>
      )}

      {/* Pickup store card — text-only: a live Static Maps tile was tried and
          dropped (this project's Google Cloud key doesn't have the Static
          Maps API enabled — a 403 "not activated" on every load — and a
          drawn CSS map read as a cheap graph-paper swatch instead). Directions
          still works via a real maps.google.com link below; it just isn't
          illustrated with a tile. */}
      {showPickupCard && (
        <div className="cardBorderPrimary bodyBackgroundColor p-2.5 flex flex-col gap-1.5">
          {/* Icon tile + name + status/meta line. */}
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg primaryLightBack primaryColor">
              <LuStore size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="truncate font-bold textColor text-sm leading-tight">
                {pickupData?.store_name}
              </h4>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] SecondaryTextColor">
                <span
                  className={`inline-flex items-center gap-1 font-bold ${
                    pickupData?.is_open_now
                      ? "primaryColor"
                      : "text-red-500 dark:text-red-400"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {pickupData?.is_open_now
                    ? t("open_now") || "Open Now"
                    : t("closed_now") || "Closed Now"}
                </span>
                {pickupData?.preparation_time && (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      {t("ready_for_pickup_in") || "Ready for pickup in"}{" "}
                      {pickupData.preparation_time}
                    </span>
                  </>
                )}
                {pickupData?.distance != null && (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      {pickupData.distance} {pickupData.distance_unit || "km"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Address row, own line below a divider. */}
          {pickupData?.address && (
            <div className="flex items-start gap-2 pt-1.5 border-t border-[color-mix(in_srgb,var(--primary-color)_12%,transparent)] text-xs SecondaryTextColor leading-relaxed">
              <SlLocationPin size={14} className="primaryColor shrink-0 mt-0.5" />
              <span className="min-w-0 flex-1">{pickupData.address}</span>
            </div>
          )}

          {/* Directions + Call, one row — Directions first. */}
          {(directionsHref || pickupData?.contact_number) && (
            <div className="flex items-center gap-4 text-xs">
              {directionsHref && (
                <a
                  href={directionsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold primaryColor hover:underline"
                >
                  <FaDirections size={13} className="shrink-0" />
                  {t("get_directions") || "Get Directions"}
                </a>
              )}
              {pickupData?.contact_number && (
                <a
                  href={`tel:${pickupData.contact_number}`}
                  className="inline-flex items-center gap-1.5 primaryColor font-semibold hover:underline"
                >
                  <RiPhoneLine size={13} className="shrink-0" />
                  {t("call_store") || "Call Store"}
                </a>
              )}
            </div>
          )}

          {!pickupAvailable && pickupData?.unavailable_reason && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-800/40 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400">
              {pickupData.unavailable_reason}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryModeToggle;
