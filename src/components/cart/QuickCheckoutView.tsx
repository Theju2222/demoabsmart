import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { t } from "@/utils/translation";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import useOrderPlacement from "@/hooks/useOrderPlacement";
import useStoreClosed from "@/hooks/useStoreClosed";
import { setAllAddresses, setSelectedAddresForEdit } from "@/redux/slices/addressSlice";
import { clearCartPromo, setCartPromo } from "@/redux/slices/cartSlice";
import { setDeliveryType } from "@/redux/slices/checkoutSlice";
import { hasMissingRequiredPrescriptions } from "@/utils/helperFunction";
import DeliveryModeToggle from "./DeliveryModeToggle";
import AppliedCouponCard from "./AppliedCouponCard";
import UnlockCouponNudge from "./UnlockCouponNudge";
import {
  RiMapPin2Line,
  RiHome4Line,
  RiBriefcase4Line,
  RiWallet3Line,
  RiMoneyDollarCircleLine,
  RiAddLine,
  RiPencilLine,
  RiCheckLine,
  RiCoupon3Line,
  RiArrowLeftLine,
} from "react-icons/ri";
import { FiInfo } from "react-icons/fi";
import { MdOutlineCelebration } from "react-icons/md";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import CartDrawerSkeletons from "./CartDrawerLoading";
import CartProductsCard from "./CartDrawerProductsCard";
import RazorpayLogo from "@/assets/payment_methods_svgs/ic_razorpay.svg";
import PaypalLogo from "@/assets/payment_methods_svgs/ic_paypal.svg";
import PaystackLogo from "@/assets/payment_methods_svgs/ic_paystack.svg";
import StripeLogo from "@/assets/payment_methods_svgs/ic_stripe.svg";
import CashfreeLogo from "@/assets/payment_methods_svgs/ic_cashfree.svg";
import MidtransLogo from "@/assets/payment_methods_svgs/Midtrans.svg";
import PhonePeLogo from "@/assets/payment_methods_svgs/Phonepe.svg";
import PaytabsLogo from "@/assets/payment_methods_svgs/ic_paytabs.svg";

// NewAddressModal.jsx (out of scope for this migration batch) is still untyped
// JS; cast to `any` at the import boundary — same pattern used throughout this
// migration for out-of-scope untyped components (PrescriptionUpload, etc).
import NewAddressModalUntyped from "@/components/newaddressmodal/NewAddressModal";
const NewAddressModal = NewAddressModalUntyped as any;
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PhoneNumberInput from "@/components/phonenumberinput/PhoneNumberInput";
import useBillingDetails from "@/hooks/useBillingDetails";
import usePendingCouponAutoApply from "@/hooks/usePendingCouponAutoApply";
import CouponAutoApplyError from "./CouponAutoApplyError";

// Enabled online gateways, keyed by the merchant's payment_setting flag. COD +
// wallet are handled separately (no flag / balance-gated). Same set as checkout.
const GATEWAYS = [
  { key: "razorpay_payment_method", value: "razorpay", logo: RazorpayLogo },
  { key: "paypal_payment_method", value: "paypal", logo: PaypalLogo },
  { key: "paystack_payment_method", value: "paystack", logo: PaystackLogo },
  { key: "stripe_payment_method", value: "stripe", logo: StripeLogo },
  { key: "cashfree_payment_method", value: "cashfree", logo: CashfreeLogo },
  { key: "midtrans_payment_method", value: "midtrans", logo: MidtransLogo },
  { key: "phonepay_payment_method", value: "phonepe", logo: PhonePeLogo },
  { key: "paytabs_payment_method", value: "paytabs", logo: PaytabsLogo },
];

// Uniform right-side selector for every payment row (wallet, COD, gateways):
// filled primary check when active, faint ring when not.
const CheckCircle = ({ active }: { active: boolean }) => (
  <span
    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
      active
        ? "primaryBackColor border-transparent text-white"
        : "border-[color-mix(in_srgb,var(--primary-color)_35%,transparent)]"
    }`}
  >
    {active && <RiCheckLine size={15} />}
  </span>
);

interface QuickCheckoutViewProps {
  /** close the whole drawer */
  onClose: () => void;
  /** currency formatter from the parent drawer */
  money: (amount?: number | string) => string;
  currency?: string;
  decimals?: number;
  /** drawer's synced cart rows — no shared exported type, kept `any[]` like the
   * rest of this migration's cart rows. */
  cartProductsData?: any[];
  setCartProductsData: React.Dispatch<React.SetStateAction<any[]>>;
  setCartData?: React.Dispatch<React.SetStateAction<any>>;
  /** open the coupon-list view in the drawer */
  onViewCoupons: () => void;
}

/**
 * In-drawer express checkout with FULL payment support (COD, wallet, and every
 * enabled online gateway) via the shared useOrderPlacement hook:
 *   getAddress → getCart(checkout:1) for totals → placeOrder → gateway → status.
 *
 * Single-page: renders the cart items too (with qty steppers + coupon) so the
 * whole flow — items, address, payment, bill — lives on ONE scroll, no separate
 * cart step.
 */
const QuickCheckoutView = ({
  onClose,
  money,
  currency,
  decimals,
  cartProductsData = [],
  setCartProductsData,
  setCartData,
  onViewCoupons,
}: QuickCheckoutViewProps) => {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const { storeClosed, notifyClosed, closedProps } = useStoreClosed();
  const cart = useSelector((state: any) => state.Cart);
  const user = useSelector((state: any) => state.User);
  const paymentSetting = useSelector((state: any) => state.Setting.payment_setting);
  const city = useSelector((state: any) => state.City.city);
  const shopMode = useSelector((state: any) => state.ShopMode.mode);
  const appliedCoupon = useSelector((state: any) => state.Cart.promo_code);
  const prescriptions = useSelector((state: any) => state.Cart.prescriptions);
  const deliveryType = useSelector(
    (state: any) => state.Checkout.deliveryType as "delivery" | "pickup",
  );
  const { placeOrder, paymentLoading, StripePortal } = useOrderPlacement();

  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [addressLoading, setAddressLoading] = useState(true);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  // The redux toggle is a REQUEST, not a guarantee — it can carry a stale
  // "pickup" from a previous store/session into a store that doesn't offer
  // pickup at all (pickup_available: 0), which hid the delivery address
  // section here even though delivery was the only real option. Once the
  // cart response has actually resolved, its own `delivery_type` is the
  // backend's authoritative answer (same principle CheckoutUI.tsx's
  // mismatch banner uses) and wins over the raw redux request.
  const isPickup = checkoutData
    ? checkoutData.delivery_type === "pickup"
    : deliveryType === "pickup";
  const [totalsLoading, setTotalsLoading] = useState(false);
  // Selected method: "COD" | "wallet" | gateway value (razorpay/stripe/…).
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  // NewAddressModal's `isAddressSelected` prop doubles as its edit-mode flag —
  // true opens it prefilled from redux's selectedEditAddress, false opens it
  // blank for a new address. Matches CheckoutUI.tsx's handleEditAddress pattern.
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const billingDetails = useBillingDetails();
  // Pickup's "Add New Address" reveals these SAME fields inline instead of
  // opening NewAddressModal — a pickup order needs a Bill To, not a saved,
  // reusable Address record, so there's no address-creation API call here at
  // all; the fields go straight out as billing_* text params (see
  // billingSameAsShipping in handlePlaceOrder).
  const [showManualBilling, setShowManualBilling] = useState(false);
  // Scroll targets for the progressive CTA (jump to the step that's missing).
  const paymentSectionRef = useRef<HTMLElement>(null);
  const cartSectionRef = useRef<HTMLElement>(null);
  // Collapsed by default: show only the selected address + a Change button.
  // Expanded shows the full list to pick from.
  const [showAllAddresses, setShowAllAddresses] = useState(false);
  // Tracks whether the mount effect below has already fired loadAddresses —
  // see that effect for why.
  const mountFetchedRef = useRef(false);

  // Gateway success (Razorpay/Paystack/Stripe/redirect-based) pushes to the
  // status page via router.push, a client-side nav that leaves Header (and
  // this drawer, mounted inside it) alive — so it stays open behind the
  // success screen unless we close it here once the route lands.
  useEffect(() => {
    if (pathname?.includes("web-payment-status")) onClose?.();
  }, [pathname, onClose]);

  // Wallet balance lives on user.user.balance. The checkout page gates wallet
  // purely on a positive balance (no separate enable flag), so mirror that.
  const walletBalance = Number(user?.user?.balance || 0);
  const enabledGateways = GATEWAYS.filter(
    (g) => paymentSetting?.[g.key] === "1",
  );

  const formatAddress = (a: any) =>
    [a?.address, a?.area, a?.city, a?.state, a?.pincode, a?.country]
      .filter(Boolean)
      .join(", ");

  const addressIcon = (type?: string) => {
    const key = String(type || "").toLowerCase();
    if (key === "home") return RiHome4Line;
    if (key === "work" || key === "office") return RiBriefcase4Line;
    return RiMapPin2Line;
  };

  // Load saved addresses. `selectNewestFrom` (list of prior ids) comes from the
  // add-address modal — the id NOT in that list is the freshly created one, so we
  // auto-select it; otherwise preselect the default (else first).
  //
  // Guards against duplicate concurrent calls the same way fetchCart in
  // CartDrawer.jsx does: React StrictMode's dev-only double-invoke of the
  // mount effect below fires this twice on every drawer open, and this
  // function is ALSO re-called after adding a new address (fetchAddress prop
  // to the add-address modal) — either way, only the response matching the
  // CURRENT sequence number is applied, so a stale response can't overwrite a
  // newer one's result.
  const loadAddressesSeqRef = useRef(0);
  const loadAddresses = async ({
    selectNewestFrom,
  }: { selectNewestFrom?: any[] } = {}) => {
    const seq = ++loadAddressesSeqRef.current;
    setAddressLoading(true);
    try {
      const res: any = await api.getAddress();
      if (seq !== loadAddressesSeqRef.current) return;
      const list = Array.isArray(res?.data) ? res.data : [];
      setAddresses(list);
      // Mirror into redux so the shared add-address modal snapshots the correct
      // prior-id set (it reads state.Addresses.allAddresses for selectNewestFrom).
      dispatch(setAllAddresses({ data: list }));
      let newest: any;
      if (Array.isArray(selectNewestFrom)) {
        const prev = new Set(selectNewestFrom);
        newest = list.find((a: any) => !prev.has(a?.id));
      }
      // A plain refetch (e.g. after editing an address) keeps the current
      // selection, swapped for its fresh copy so edited fields (state/pincode/
      // coords) flow into the totals refetch below.
      setSelectedAddress(
        (current: any) =>
          newest ||
          list.find((a: any) => a?.id === current?.id) ||
          list.find((a: any) => a?.is_default == 1) ||
          list[0] ||
          null,
      );
    } catch (error) {
      if (seq !== loadAddressesSeqRef.current) return;
      console.log("[quick-checkout] getAddress failed", error);
    } finally {
      if (seq === loadAddressesSeqRef.current) setAddressLoading(false);
    }
  };

  useEffect(() => {
    // Guards against React StrictMode's dev-only double-invoke of this mount
    // effect firing loadAddresses() TWICE — a ref (not the seq guard inside
    // loadAddresses itself) so the SECOND request never fires at all, not
    // just its response being discarded. Permanent for this component
    // instance's lifetime (matches useDefaultCountry's pattern): a fresh
    // mount always gets a fresh ref, and every LATER call to loadAddresses
    // (e.g. via the add-address modal's fetchAddress prop) is a real,
    // intentional re-fetch that must still go through — only the one
    // fired from this specific effect is guarded.
    if (mountFetchedRef.current) return;
    mountFetchedRef.current = true;
     
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run-once on mount only
  }, []);

  // Fetch checkout totals (delivery charge + final total) for the selected
  // address. Backend reads the server cart; we pass geo + address_id + checkout flag.
  //
  // Pickup: the "address" picked here is a Bill To (name/mobile), not a
  // delivery destination — it can be anywhere, unrelated to the store's zone.
  // Sending ITS coords as the pricing location would have the backend
  // zone-check and price the order against wherever that billing address
  // happens to be, instead of the store the customer is actually collecting
  // from. Pricing stays keyed on the customer's current location (`city`) in
  // pickup mode, same as before any address was picked; only address_id (the
  // Bill To) still follows the selection.
  useEffect(() => {
    // No address yet in delivery mode: still fetch once against the
    // customer's current city coords (not a real shipping destination) so
    // checkoutData.pickup_available/delivery_available resolve and the mode
    // toggle can render — otherwise a delivery-only-looking user could never
    // discover pickup exists before adding an address. is_deliverable_address
    // is meaningless for these city-coords results, so it's never surfaced
    // (no undeliverable banner) until a real address is picked below.
    let alive = true;
    (async () => {
      setTotalsLoading(true);
      try {
        const res = await api.getCart({
          latitude: isPickup
            ? city?.latitude
            : (selectedAddress?.latitude ?? city?.latitude),
          longitude: isPickup
            ? city?.longitude
            : (selectedAddress?.longitude ?? city?.longitude),
          checkout: 1,
          promocode_id: cart?.promo_code?.promo_code_id || 0,
          address_id: selectedAddress?.id,
          delivery_type: deliveryType,
        });
        if (!alive) return;
        if (res?.status == 1) {
          setCheckoutData(res?.data);
        } else {
          setCheckoutData(null);
          // A "not deliverable" message from the backend is meaningless for
          // a pickup order priced off the customer's own location, not a
          // delivery address — never surface it there.
          if (res?.message && !isPickup) toast.error(res.message);
        }
      } catch (error) {
        console.log("[quick-checkout] getCart(checkout) failed", error);
      } finally {
        if (alive) setTotalsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // cart?.cartSubTotal changes on every +/- (syncFromServerCart dispatches
    // setCartSubTotal), so watching it refetches the checkout totals live instead
    // of leaving the bill stale until the drawer is reopened.
    // Editing an address keeps its id, so the pricing-relevant fields are
    // watched too — a state change flips tax between IGST and CGST+SGST.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally scoped to selectedAddress's pricing fields (not the whole object) + promo/subtotal/deliveryType; city is only a fallback when selectedAddress has no lat/lng and would over-trigger refetches if watched directly
  }, [
    selectedAddress?.id,
    selectedAddress?.state,
    selectedAddress?.pincode,
    selectedAddress?.latitude,
    selectedAddress?.longitude,
    cart?.promo_code?.promo_code_id,
    cart?.cartSubTotal,
    deliveryType,
  ]);

  // Delivery charge + its tax — backend has been seen sending this as a plain
  // `delivery_charge` scalar, a `delivery_charge` object with
  // total_delivery_charge/tax_amount/tax_name, OR a separate `delivery_charges`
  // (plural) object with amount/tax_amount/tax_name. All three are checked so
  // neither the amount nor its tax silently goes missing depending on which
  // shape a given response uses.
  const deliveryChargeObj =
    (typeof checkoutData?.delivery_charge === "object"
      ? checkoutData?.delivery_charge
      : null) || checkoutData?.delivery_charges;
  const deliveryCharge = useMemo(() => {
    const val =
      deliveryChargeObj?.total_delivery_charge ??
      deliveryChargeObj?.amount ??
      (typeof checkoutData?.delivery_charge === "object"
        ? undefined
        : checkoutData?.delivery_charge);
    return Number(val || 0);
  }, [checkoutData, deliveryChargeObj]);

  const deliveryChargeTax = deliveryChargeObj;

  // Manual coupon entry — same input+Apply pattern as CartDrawer's coupon
  // footer, added here too: this single-page checkout previously had no way
  // to TYPE/PASTE a code (only the unlock nudge + view-all list), so a code
  // won elsewhere (e.g. a Spin & Win reward, copied on its own page) had
  // nowhere to be pasted and applied without leaving this view.
  const [couponInput, setCouponInput] = useState("");
  const [couponApplyLoading, setCouponApplyLoading] = useState(false);
  const handleApplyTypedCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponApplyLoading(true);
    try {
      const response = await api.setPromoCode({
        promoCodeName: code,
        amount: subTotal,
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (response.status == 1) {
        dispatch(setCartPromo({ data: response.data }));
        setCouponInput("");
      } else {
        toast.error(response.message || t("invalid_coupon_code"));
      }
    } catch (error) {
      console.log("[quick-checkout] apply typed coupon failed", error);
    } finally {
      setCouponApplyLoading(false);
    }
  };

  const subTotal = Number(checkoutData?.sub_total ?? cart?.cartSubTotal ?? 0);
  usePendingCouponAutoApply({
    active: true,
    hasItems: cartProductsData?.length > 0,
    subTotal,
  });
  // No address selected yet ⇒ checkoutData never fetched (delivery/final total
  // need one) — show the item subtotal instead of 0 so the bill isn't blank.
  const totalAmount = Number(checkoutData?.total_amount ?? subTotal);
  const codAllowed = checkoutData?.cod_allowed == "1";
  // The selected address may be outside the serviceable area even though the
  // drawer-level cart (city coords) was deliverable. The checkout API reports
  // this per-address via is_deliverable_address (1 = OK, 0 = not serviceable),
  // and separately whether the store offers delivery at all on this channel
  // via delivery_available — both, straight from the cart response, no zone
  // lookup of our own. Only trust it once totals have loaded — undefined
  // before the first fetch. Every call site below already gates this behind
  // `!isPickup &&`, so an undeliverable address never blocks a pickup order.
  const isDeliverable =
    checkoutData == null ||
    (Number(checkoutData?.delivery_available) === 1 &&
      Number(checkoutData?.is_deliverable_address) === 1);
  // Per-SKU delivery restriction, independent of the address-level check
  // above — some SKUs can be zone-restricted on their own even when the
  // address itself is inside the zone.
  const undeliverableVariantIds = new Set(
    (checkoutData?.undeliverable_variant_ids ?? []).map((id: any) =>
      String(id),
    ),
  );
  const walletCoversAll = walletBalance >= totalAmount && totalAmount > 0;

  // Savings + cashback (mirrors the cart drawer). "wallet" apply-type coupons are
  // cashback (credited after the order, NOT a price reduction); "instant" coupons
  // reduce the price. saved_amount = product slab savings.
  const isCashbackCoupon = appliedCoupon?.discount_apply_type === "wallet";
  const promoDiscount = Number(appliedCoupon?.discount || 0);
  const productSaved = Number(checkoutData?.saved_amount || 0);
  // Total price savings — read straight from the API's `saved_amount`, which
  // already accounts for the applied promo code. Adding promoDiscount on top of
  // it double-counted the coupon (saved_amount 200 + promo 100 rendered "You
  // saved 300" while the bill only came down by 200).
  const totalSaved = productSaved;

  // Extra charge lines from the checkout response (same 3 sources as the checkout
  // page). Each normalized to {label, amount, refundable, taxAmount} for one
  // render loop. total_amount already includes these — this is display only.
  // taxAmount (when > 0) means the charge's own `amount` already has that much
  // tax baked in (surge_charges/zone_additional_charges each carry their own
  // tax_amount/tax_name — same "already inclusive" shape as sub_total/tax_amount).
  const chargeRows: {
    label: string;
    amount: number;
    refundable?: any;
    taxAmount?: number;
    taxName?: string;
  }[] = [
    ...(checkoutData?.additional_charges || []).map((c: any) => ({
      label: c?.title,
      amount: Number(c?.amount || 0),
      refundable: undefined,
    })),
    ...(checkoutData?.surge_charges || []).map((c: any) => ({
      label: c?.label,
      amount: Number(c?.charge || 0),
      refundable: c?.is_refundable,
      taxAmount: Number(c?.tax_amount || 0),
      taxName: c?.tax_name,
    })),
    ...(checkoutData?.zone_additional_charges || []).map((c: any) => ({
      label: c?.name,
      amount: Number(c?.amount || 0),
      refundable: c?.is_refundable,
      taxAmount: Number(c?.tax_amount || 0),
      taxName: c?.tax_name,
    })),
  ].filter((r) => r.label);

  // Per-tax breakdown (IGST/CGST/SGST) shown as a Subtotal tooltip rather
  // than its own bill rows — zero-amount entries dropped so a tax bucket the
  // backend still lists at ₹0 doesn't appear in the tooltip. Gated on the
  // array itself having real rows rather than a separate
  // tax_breakdown_available flag — that flag isn't reliably set even when
  // tax_breakdown carries real data.
  const taxBreakdownRows = (checkoutData?.tax_breakdown || []).filter(
    (tx: any) => Number(tx?.amount) > 0,
  );

  // Amount the wallet redeems (only the portion up to the total) + the residual
  // that still needs a real method (COD here). Full-cover ⇒ payable 0.
  const walletUsedAmount = useWallet ? Math.min(walletBalance, totalAmount) : 0;
  const payable = Math.max(totalAmount - walletUsedAmount, 0);

  let walletStatusLabel;
  if (walletCoversAll) {
    walletStatusLabel = useWallet
      ? t("pay_fully_with_wallet") || "Paying fully with wallet"
      : t("pay_fully_with_wallet") || "Pay fully with wallet";
  } else if (useWallet) {
    walletStatusLabel = `${t("wallet_applied") || "Applied"} ${money(walletUsedAmount)}`;
  } else {
    walletStatusLabel = t("redeem_at_checkout") || "Redeem at checkout";
  }

  // Effective payment method: wallet fully covers ⇒ "wallet"; otherwise the
  // explicitly chosen method (COD or an online gateway). Partial wallet rides
  // along via walletUsed while the chosen method settles the residual.
  const effectiveMethod =
    useWallet && walletCoversAll ? "wallet" : paymentMethod;

  const missingRx = hasMissingRequiredPrescriptions(
    cartProductsData,
    prescriptions,
  );

  // Delivery always needs a real shipping destination. Pickup is satisfied
  // by EITHER picking a saved address (its id becomes the Bill To) OR fully
  // typing billing details inline instead (billingDetails.isFilled — NOT
  // isValid, which treats "same as shipping" as automatically satisfied and
  // there's no shipping address for pickup to be "same as") — it never
  // needs a saved Address record.
  const addressSatisfied = isPickup
    ? !!selectedAddress || billingDetails.isFilled
    : !!selectedAddress;

  const canPlace =
    addressSatisfied &&
    !paymentLoading &&
    !totalsLoading &&
    !!effectiveMethod &&
    !missingRx;

  const handlePlaceOrder = async () => {
    if (storeClosed) {
      notifyClosed();
      return;
    }
    if (!isPickup && !selectedAddress) {
      toast.error(t("please_select_address"));
      return;
    }
    if (isPickup && !selectedAddress && !billingDetails.isFilled) {
      toast.error(
        t("please_select_address_or_fill_billing_details") ||
          "Please pick an address or fill in billing details",
      );
      return;
    }
    if (!isPickup && !isDeliverable) {
      toast.error(t("sorry_we_are_not_delivering_on_selected_address"));
      return;
    }
    if (!effectiveMethod) {
      toast.error(t("please_select_payment_method"));
      return;
    }
    if (missingRx) {
      toast.error(
        t("please_upload_required_prescription") ||
          "Please upload a prescription for all required medical items",
      );
      return;
    }
    // Delivery: billingDetails.isValid (sameAsShipping counts as satisfied).
    // Pickup with no selected address: already required isFilled above, so
    // this is a no-op there; pickup WITH a selected address needs no
    // additional billing check (its address_id is the Bill To).
    if (!isPickup && !billingDetails.isValid) {
      toast.error(
        t("please_fill_billing_details") || "Please fill in billing details",
      );
      return;
    }
    // Only COD/wallet navigate straight to the status page, so the drawer can
    // close on those. For gateway methods the drawer MUST stay mounted — the
    // Stripe modal (StripePortal below) is rendered inside this component and
    // would unmount with the drawer; Razorpay's overlay + redirect gateways are
    // also driven from here. Leave it open until the gateway resolves.
    const settlesInline =
      effectiveMethod === "COD" || effectiveMethod === "wallet";

    // Hand off to the shared placement hook — it owns every gateway path
    // (COD/wallet → status page, razorpay/stripe modal, redirect gateways).
    await placeOrder({
      method: effectiveMethod,
      payable,
      subTotal,
      deliveryCharge,
      finalTotal: payable,
      walletUsed: useWallet,
      walletBalance: walletUsedAmount,
      // Required for both modes: shipping destination for delivery, Bill To
      // (name/mobile) for pickup.
      addressId: selectedAddress?.id,
      orderNote: orderNote?.trim() || "",
      promocodeId: cart?.promo_code?.promo_code_id || 0,
      delivery_type: deliveryType,
      // Same coords the checkout-totals fetch above priced the cart with —
      // lets the server catch a moved-since-priced pickup order instead of
      // placing one for a store that's no longer reachable.
      latitude: selectedAddress?.latitude ?? city?.latitude,
      longitude: selectedAddress?.longitude ?? city?.longitude,
      prescriptions,
      onCreated: settlesInline ? () => onClose?.() : undefined,
      // Pickup with no selected address is using the inline fields as the
      // ENTIRE Bill To (no address_id, no shipping address to defer to) —
      // billing.sameAsShipping still defaults true there since the checkbox
      // never renders for pickup, so it must be forced false or the backend
      // would ignore the very fields the user just filled in.
      billingSameAsShipping:
        isPickup && !selectedAddress
          ? false
          : billingDetails.billing.sameAsShipping,
      billingName: billingDetails.billing.name,
      billingMobile: billingDetails.billing.mobile,
      billingCountryCode: billingDetails.billing.countryCode,
      billingAddress: billingDetails.billing.address,
      billingCity: billingDetails.billing.city,
      billingState: billingDetails.billing.state,
      billingPincode: billingDetails.billing.pincode,
      billingCountry: billingDetails.billing.country,
      billingRegionId: billingDetails.regionIdToSend,
    });
  };

  // Progressive CTA: the footer button guides the user to the next missing step
  // instead of just sitting disabled — no address → "Add Address" (opens the
  // add-address modal); address but no payment → "Select Payment" (scrolls to
  // the payment section); everything ready → "Place Order".
  const cta = (() => {
    // In delivery mode, require an address first.
    if (!isPickup && !selectedAddress)
      return {
        label: t("add_new_address") || "Add New Address",
        action: () => setShowAddAddress(true),
        ready: false,
      };
    if (!isPickup && !isDeliverable)
      return {
        label: t("sorry_we_are_not_delivering_on_selected_address"),
        action: () => setShowAllAddresses(true),
        ready: false,
        blocked: true,
      };
    if (!effectiveMethod)
      return {
        label: t("select_payment_method") || "Select Payment Method",
        action: () =>
          paymentSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        ready: false,
      };
    if (missingRx)
      return {
        label: t("upload_prescription") || "Upload Prescription",
        action: () => {
          toast.error(
            t("please_upload_required_prescription") ||
              "Please upload a prescription for all required medical items",
          );
          cartSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        },
        ready: false,
      };
    return {
      label: t("place_order") || "Place Order",
      action: handlePlaceOrder,
      ready: true,
    };
  })();

  // Reading cta.ready here is not a render-time ref access: cta.action closures
  // (which touch paymentSectionRef/cartSectionRef) only run inside their click
  // handler, never during render. The compiler's static analysis can't see that
  // distinction through the `cta` object, hence the disable.
  // eslint-disable-next-line react-hooks/refs
  const ctaClosedSpreadProps = cta.ready ? closedProps : {};
  // eslint-disable-next-line react-hooks/refs
  const ctaClosedClassName = cta.ready ? (closedProps.className ?? "") : "";

  return (
    <>
      {/* flex-1 + min-h-0 (NOT h-full): fill the space left AFTER the SheetHeader in
        the drawer's flex column. h-full took the FULL 100dvh, ignoring the header,
        which pushed the footer (Place Order) below the viewport. */}
      <div className="flex min-h-0 flex-1 flex-col bodyBackgroundColor">
        <div className="flex-grow space-y-4 overflow-y-auto p-4">
          {/* Delivery-mode toggle — Delivery vs Self Pickup.
            Only shown once cart data has loaded (checkoutData present). */}
          {checkoutData && (
            <DeliveryModeToggle
              checkoutData={checkoutData}
              totalsLoading={totalsLoading}
              onBeforeToggle={() => setTotalsLoading(true)}
            />
          )}

          {/* Address — collapses to a single-line pill (pin + selected address +
            edit) so it stays out of the way; tapping edit expands the full picker.
            Rendered FIRST so it's the top thing the user sees. Required in BOTH
            modes now: delivery uses it as the shipping destination, pickup sends
            its id as address_id, which the backend uses as the Bill To (name/
            mobile) instead of the profile default. */}
          {addressLoading ? (
            <section className="bodyBackgroundColor cardBorderPrimary !rounded-lg p-4 shadow-sm">
              <CartDrawerSkeletons />
            </section>
          ) : !showAllAddresses && selectedAddress ? (
            /* Collapsed pill — one compact row. Whole row is the edit affordance. */
            <button
              type="button"
              onClick={() => setShowAllAddresses(true)}
              className="flex w-full items-center gap-2.5 cardBorderPrimary !rounded-lg bodyBackgroundColor px-4 py-3 text-start shadow-sm transition-colors hover:primaryLightBack"
            >
              <RiMapPin2Line size={18} className="primaryColor shrink-0" />
              <div className="flex min-w-0 flex-grow flex-col">
                <span className="truncate text-sm font-bold textColor">
                  {isPickup
                    ? t("billing_address") || "Billing address"
                    : t("deliver_to") || "Deliver to"}{" "}
                  {selectedAddress?.type || selectedAddress?.name}
                </span>
                <span className="truncate text-xs SecondaryTextColor leading-snug">
                  {formatAddress(selectedAddress)}
                </span>
              </div>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full primaryLightBack primaryColor">
                <RiPencilLine size={14} />
              </span>
            </button>
          ) : (
            /* Expanded card — full header + address list (or add-address CTA). */
            <section className="bodyBackgroundColor cardBorderPrimary !rounded-lg shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2 font-bold text-base textColor">
                  <RiMapPin2Line size={17} className="primaryColor shrink-0" />
                  <span className="truncate">
                    {isPickup
                      ? t("billing_address") || "Billing Address"
                      : t("delivery_address")}
                  </span>
                </span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {addresses.length === 0 && !showManualBilling && (
                  <button
                    type="button"
                    onClick={() =>
                      isPickup
                        ? setShowManualBilling(true)
                        : setShowAddAddress(true)
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[color-mix(in_srgb,var(--primary-color)_25%,transparent)] py-4 text-sm font-semibold primaryColor"
                  >
                    <RiAddLine size={18} />
                    {t("add_new_address") || "Add New Address"}
                  </button>
                )}

                {addresses.length > 0 && !showManualBilling && (
                  <div className="flex flex-col gap-2">
                    {/* Full list — same markup as the checkout page's AddressCard.
                        Picking one collapses back to the pill. */}
                    {addresses.map((addr) => {
                      const Icon = addressIcon(addr?.type);
                      const active = selectedAddress?.id === addr?.id;
                      return (
                        <label
                          key={addr?.id}
                          className={`relative flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer transition ${
                            active
                              ? "primaryColorBorder dark:border-white dark:bg-white/5"
                              : "border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] hover:border-[color-mix(in_srgb,var(--primary-color)_35%,transparent)]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="quick_delivery_address"
                            className="sr-only"
                            checked={active}
                            onChange={() => {
                              setSelectedAddress(addr);
                              // Picking one collapses back to the single-line summary.
                              setShowAllAddresses(false);
                            }}
                          />
                          <span
                            className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                              active
                                ? "primaryColorBorder dark:border-white"
                                : "border-gray-300 dark:border-gray-600"
                            }`}
                          >
                            {active && (
                              <span className="w-2 h-2 rounded-full primaryBackColor dark:bg-white" />
                            )}
                          </span>
                          <span
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              active
                                ? "primaryBackColor text-white"
                                : "primaryLightBack primaryColor dark:text-white"
                            }`}
                          >
                            <Icon size={15} />
                          </span>
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm truncate">
                                {addr?.type || addr?.name}
                              </span>
                              {addr?.is_default == 1 && (
                                <span className="text-[10px] font-semibold primaryColor dark:text-white shrink-0">
                                  • {t("default")}
                                </span>
                              )}
                            </div>
                            <span className="text-xs SecondaryTextColor leading-snug line-clamp-1">
                              {formatAddress(addr)}
                            </span>
                          </div>
                          <button
                            type="button"
                            aria-label={t("edit") || "Edit"}
                            // Card root is the <label> that toggles the radio on click —
                            // stop that here so Edit doesn't also select this address.
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              dispatch(setSelectedAddresForEdit({ data: addr }));
                              setIsEditingAddress(true);
                              setShowAddAddress(true);
                            }}
                            className="shrink-0 rounded-lg p-1.5 text-SecondaryTextColor transition-colors hover:primaryLightBack hover:primaryColor"
                          >
                            <RiPencilLine size={15} />
                          </button>
                        </label>
                      );
                    })}
                    {/* Add another address — opens the shared modal (delivery)
                        or reveals the inline billing fields (pickup). */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isPickup) {
                          // Clear any already-picked address — leaving it
                          // set here would have addressId/billingSameAs
                          // Shipping still send the STALE pick alongside
                          // whatever the user types below, instead of using
                          // the manual fields as the real Bill To.
                          setSelectedAddress(null);
                          setShowManualBilling(true);
                          return;
                        }
                        setIsEditingAddress(false);
                        setShowAddAddress(true);
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--primary-color)_25%,transparent)] py-2.5 text-sm font-semibold primaryColor transition-colors hover:primaryLightBack"
                    >
                      <RiAddLine size={16} />
                      {t("add_new_address") || "Add New Address"}
                    </button>
                  </div>
                )}

                {/* Pickup-only inline Bill To fields — same fields as
                    delivery's "different billing address" form, but never a
                    modal: a pickup order needs a Bill To, not a saved,
                    reusable Address record, so nothing here calls the
                    address-creation API. Picking a saved address above (if
                    any exist) is still preferred — this is the fallback path
                    when the user has none, or wants to type one-off details. */}
                {isPickup && showManualBilling && (
                  <div className="flex flex-col gap-3.5">
                    {addresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowManualBilling(false)}
                        className="inline-flex w-fit items-center gap-1.5 self-start rounded-full primaryLightBack px-3 py-1.5 text-xs font-bold primaryColor transition-opacity hover:opacity-80"
                      >
                        <RiArrowLeftLine size={14} className="shrink-0" />
                        {t("choose_saved_address") || "Choose a saved address"}
                      </button>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-sm font-semibold textColor">{t("name")}</Label>
                      <Input
                        type="text"
                        className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent"
                        placeholder={t("name")}
                        value={billingDetails.billing.name}
                        onChange={(e) => billingDetails.setField("name", e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3.5">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-semibold textColor">{t("mobileNumber")}</Label>
                        <div className="-mt-1.5">
                          <PhoneNumberInput
                            value={billingDetails.billing.mobile}
                            countryCode={billingDetails.billing.countryCode}
                            onChange={billingDetails.handleMobileChange}
                            onCountryReady={billingDetails.handleMobileCountryReady}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-semibold textColor">{t("enter_city")}</Label>
                        <Input
                          type="text"
                          className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent"
                          placeholder={t("enter_city")}
                          value={billingDetails.billing.city}
                          onChange={(e) => billingDetails.setField("city", e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-sm font-semibold textColor">{t("address")}</Label>
                      <Input
                        type="text"
                        placeholder={t("address")}
                        value={billingDetails.billing.address}
                        onChange={(e) => billingDetails.setField("address", e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-semibold textColor">{t("enter_pincode")}</Label>
                        <Input
                          type="text"
                          className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent"
                          placeholder={t("enter_pincode")}
                          value={billingDetails.billing.pincode}
                          onChange={(e) => billingDetails.setField("pincode", e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-semibold textColor">{t("enter_country")}</Label>
                        <Select
                          value={billingDetails.billing.countryId || undefined}
                          onValueChange={billingDetails.handleCountryChange}
                        >
                          <SelectTrigger className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent focus:primaryColorBorder focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary-color)_25%,transparent)]">
                            <SelectValue placeholder={t("enter_country")} />
                          </SelectTrigger>
                          <SelectContent>
                            {billingDetails.countries.map((c: any) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-semibold textColor">{t("enter_region")}</Label>
                        {billingDetails.regionsEmpty ? (
                          <Input
                            type="text"
                            className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent"
                            placeholder={t("enter_region")}
                            value={billingDetails.billing.regionId}
                            onChange={(e) =>
                              billingDetails.handleRegionChange(e.target.value)
                            }
                          />
                        ) : (
                          <Select
                            value={billingDetails.billing.regionId || undefined}
                            onValueChange={billingDetails.handleRegionChange}
                            disabled={!billingDetails.billing.countryId}
                          >
                            <SelectTrigger className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent focus:primaryColorBorder focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary-color)_25%,transparent)]">
                              <SelectValue placeholder={t("enter_region")} />
                            </SelectTrigger>
                            <SelectContent>
                              {billingDetails.regions.map((region: any) => (
                                <SelectItem key={region.id} value={String(region.id)}>
                                  {region.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Undeliverable banner — only in delivery mode, and only once a
              real address is selected (the pre-address fetch above prices
              against city coords, not a shipping destination, so its
              is_deliverable_address is meaningless here). */}
          {!isPickup && !!selectedAddress && !isDeliverable && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2.5">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {t("sorry_we_are_not_delivering_on_selected_address")}
              </p>
            </div>
          )}

          {/* Billing Details — collapsed by default ("same as shipping"); the
            same country/region <Select> + PhoneNumberInput pattern used in
            NewAddressModal.tsx, driven by the shared useBillingDetails hook so
            this drawer and the main checkout page stay in sync. Sits right
            below the address section so billing follows shipping context.
            Hidden entirely when the address is undeliverable — the order
            can't be placed either way, so collecting billing info is moot.
            ALSO hidden for pickup: there's no shipping address to be "same
            as" (the address section above IS the billing address there —
            its address_id is sent as the Bill To), so this whole card would
            be showing a checkbox that lies about what it's comparing to. */}
          {!isPickup && isDeliverable && (
          <section className="bodyBackgroundColor cardBorderPrimary !rounded-lg shadow-sm">
            <label className="flex items-center justify-between gap-2 border-b border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] p-4 cursor-pointer">
              <span className="font-bold text-lg textColor">
                {t("billing_details") || "Billing Details"}
              </span>
              <span className="flex items-center gap-2 text-sm font-semibold textColor">
                {t("billing_same_as_shipping") || "Same as shipping address"}
                <Checkbox
                  checked={billingDetails.billing.sameAsShipping}
                  onCheckedChange={(checked) =>
                    billingDetails.setSameAsShipping(checked === true)
                  }
                  className="primaryColorBorder data-[state=checked]:primaryBackColor"
                />
              </span>
            </label>
            {!billingDetails.billing.sameAsShipping && (
              <div className="flex flex-col gap-3.5 p-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-semibold textColor">{t("name")}</Label>
                  <Input
                    type="text"
                    className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent"
                    placeholder={t("name")}
                    value={billingDetails.billing.name}
                    onChange={(e) => billingDetails.setField("name", e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-semibold textColor">{t("mobileNumber")}</Label>
                    {/* PhoneNumberInput bakes in its own mt-1.5 (expects to sit
                        directly under a label with no gap); this wrapper's own
                        gap-1.5 would double that spacing, so cancel it here. */}
                    <div className="-mt-1.5">
                      <PhoneNumberInput
                        value={billingDetails.billing.mobile}
                        countryCode={billingDetails.billing.countryCode}
                        onChange={billingDetails.handleMobileChange}
                        onCountryReady={billingDetails.handleMobileCountryReady}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-semibold textColor">{t("enter_city")}</Label>
                    <Input
                      type="text"
                      className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent"
                      placeholder={t("enter_city")}
                      value={billingDetails.billing.city}
                      onChange={(e) => billingDetails.setField("city", e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-semibold textColor">{t("address")}</Label>
                  <Input
                    type="text"
                    placeholder={t("address")}
                    value={billingDetails.billing.address}
                    onChange={(e) => billingDetails.setField("address", e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-semibold textColor">{t("enter_pincode")}</Label>
                    <Input
                      type="text"
                      className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent"
                      placeholder={t("enter_pincode")}
                      value={billingDetails.billing.pincode}
                      onChange={(e) => billingDetails.setField("pincode", e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-semibold textColor">{t("enter_country")}</Label>
                    <Select
                      value={billingDetails.billing.countryId || undefined}
                      onValueChange={billingDetails.handleCountryChange}
                    >
                      <SelectTrigger className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent focus:primaryColorBorder focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary-color)_25%,transparent)]">
                        <SelectValue placeholder={t("enter_country")} />
                      </SelectTrigger>
                      <SelectContent>
                        {billingDetails.countries.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-semibold textColor">{t("enter_region")}</Label>
                    {/* Countries with no region list on file (e.g. Italy) get
                        a free-text field instead of a stuck-empty dropdown —
                        regionId doubles as the typed name. */}
                    {billingDetails.regionsEmpty ? (
                      <Input
                        type="text"
                        className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent"
                        placeholder={t("enter_region")}
                        value={billingDetails.billing.regionId}
                        onChange={(e) =>
                          billingDetails.handleRegionChange(e.target.value)
                        }
                      />
                    ) : (
                      <Select
                        value={billingDetails.billing.regionId || undefined}
                        onValueChange={billingDetails.handleRegionChange}
                        disabled={!billingDetails.billing.countryId}
                      >
                        <SelectTrigger className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent focus:primaryColorBorder focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary-color)_25%,transparent)]">
                          <SelectValue placeholder={t("enter_region")} />
                        </SelectTrigger>
                        <SelectContent>
                          {billingDetails.regions.map((region: any) => (
                            <SelectItem key={region.id} value={String(region.id)}>
                              {region.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
          )}

          {/* Cart items — single-page: the whole flow (items → address → payment →
            bill) lives on one scroll, so items + qty steppers render here too. */}
          {cartProductsData?.length > 0 && (
            <section
              ref={cartSectionRef}
              className="scroll-mt-4 bodyBackgroundColor cardBorderPrimary !rounded-lg shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] p-4">
                <span className="flex items-center gap-2 font-bold text-lg textColor">
                  {t("shoppingCart") || "Your Cart"}
                  <span className="text-sm font-normal SecondaryTextColor">
                    ({cartProductsData.length} {t("items")})
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-2 p-3">
                {cartProductsData.map((product) => (
                  <CartProductsCard
                    key={product?.product_variant_id ?? product?.id}
                    product={product}
                    cartProductsData={cartProductsData}
                    setCartProductsData={setCartProductsData}
                    setCartData={setCartData}
                    currency={currency}
                    decimals={decimals}
                  />
                ))}
              </div>
              {/* Per-SKU delivery restriction — independent of
                  is_deliverable_address: some SKUs are zone-restricted on
                  their own even when the address itself is inside the zone.
                  Doesn't apply to a pickup order (no delivery leg). */}
              {!isPickup &&
                undeliverableVariantIds.size > 0 &&
                (() => {
                  const restrictedNames = cartProductsData
                    .filter((p) =>
                      undeliverableVariantIds.has(
                        String(p?.product_variant_id),
                      ),
                    )
                    .map((p) => p?.name)
                    .filter(Boolean);
                  if (restrictedNames.length === 0) return null;
                  return (
                    <div className="mx-3 mb-3 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        {(t("items_not_deliverable_to_this_address") ||
                          "Can't be delivered to this address:") +
                          " " +
                          restrictedNames.join(", ")}
                      </p>
                    </div>
                  );
                })()}
            </section>
          )}

          {/* Coupon — its own card OUTSIDE the cart card: the offer is about the
              order, not about any one line item, so nesting it under the product
              list read as another cart row. Applied → the ticket with saved
              amount + remove; otherwise → the unlock nudge + view-all list. */}
          {appliedCoupon ? (
            <AppliedCouponCard
              key={appliedCoupon?.promo_code}
              code={appliedCoupon?.promo_code}
              savedAmount={money(appliedCoupon?.discount)}
              discountType={appliedCoupon?.discount_type}
              onRemove={() => dispatch(clearCartPromo())}
              loading={false}
            />
          ) : (
            // One outer card wrapping BOTH the typed-code input and the
            // unlock nudge/view-all — previously two separate bordered blocks
            // stacked with a gap, which read as two unrelated sections
            // instead of one coupon area. The input's own border/rounding is
            // dropped (border-b divider instead) and UnlockCouponNudge's
            // bordered=false drops ITS outer border, so this wrapper is the
            // only outline either piece has.
            <div
              className="overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)]"
              style={{
                // Same tint + border token UnlockCouponNudge uses for its own
                // card, so the input section and the nudge below it read as
                // one themed surface rather than a plain gray-bordered box.
                backgroundImage:
                  "linear-gradient(to bottom, color-mix(in srgb, var(--primary-color) 6%, var(--category-card-bg)), var(--category-card-bg))",
              }}
            >
              {/* Type / paste a coupon, then Apply. Needed here specifically
                  so a code won elsewhere (e.g. copied off the Spin & Win
                  rewards page) can be pasted and applied without leaving
                  checkout. */}
              <div className="flex h-12 items-center gap-2 border-b border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] pl-2 pr-1.5 transition-colors focus-within:bg-[color-mix(in_srgb,var(--primary-color)_8%,transparent)]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg primaryLightBack primaryColor">
                  <RiCoupon3Line size={17} />
                </span>
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleApplyTypedCoupon()
                  }
                  placeholder={t("enter_coupon_code") || "Enter coupon code"}
                  className="min-w-0 flex-grow bg-transparent text-sm font-bold uppercase tracking-wide outline-none placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:SecondaryTextColor textColor"
                />
                <button
                  type="button"
                  onClick={handleApplyTypedCoupon}
                  disabled={!couponInput.trim() || couponApplyLoading}
                  className="shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all active:scale-95 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: couponInput.trim()
                      ? "var(--primary-color)"
                      : "color-mix(in srgb, var(--primary-color) 35%, #fff)",
                  }}
                >
                  {couponApplyLoading ? "..." : t("apply") || "Apply"}
                </button>
              </div>

              <CouponAutoApplyError />

              <UnlockCouponNudge
                code={checkoutData?.unlock_promo_code}
                message={checkoutData?.unlock_message}
                onViewAll={onViewCoupons}
                bordered={false}
              />
            </div>
          )}

          {/* Delivery instruction / order note — sent to placeOrder as orderNote.
            Quick channel only (ecom/all-shop ships, no delivery-partner note). */}
          {shopMode === "quick" && (
            <section className="bodyBackgroundColor cardBorderPrimary !rounded-lg shadow-sm">
              <div className="border-b border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] p-4">
                <span className="flex items-center gap-2 font-bold text-lg textColor">
                  {t("order_notes") ||
                    t("delivery_instruction") ||
                    "Delivery Instruction"}
                </span>
              </div>
              <div className="p-4">
                <p className="mb-2 text-xs SecondaryTextColor">
                  {t("order_notes_hint") ||
                    "Add a delivery instruction for the delivery partner (optional)."}
                </p>
                <textarea
                  rows={2}
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder={
                    t("order_notes_placeholder") ||
                    "e.g. Leave at the door, call on arrival…"
                  }
                  className="w-full resize-none rounded-lg border border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] bg-transparent p-3 text-sm outline-none transition-colors focus:primaryColorBorder textColor placeholder:SecondaryTextColor"
                />
              </div>
            </section>
          )}

          {/* Coupon + unlock offer live on the cart view (before this step), so the
            code is already applied here — not repeated to avoid duplicate UI. */}

          {/* Payment method — COD, wallet + every enabled online gateway. */}
          <section
            ref={paymentSectionRef}
            className="scroll-mt-4 bodyBackgroundColor cardBorderPrimary !rounded-lg shadow-sm"
          >
            <div className="border-b border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] p-4">
              <span className="flex items-center gap-2 font-bold text-lg textColor">
                {t("payment_method") || "Payment Method"}
              </span>
            </div>
            <div className="p-4">
              {/* Recommended: wallet (toggle) + COD. */}
              <div className="flex flex-col gap-2">
                {walletBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setUseWallet((v) => !v);
                      if (!useWallet && walletCoversAll)
                        setPaymentMethod("wallet");
                      if (useWallet && paymentMethod === "wallet")
                        setPaymentMethod(null);
                    }}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      useWallet
                        ? "primaryColorBorder primaryLightBack"
                        : "border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] hover:bg-gray-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full primaryLightBack primaryColor">
                      <RiWallet3Line size={18} />
                    </span>
                    <div className="min-w-0 flex-grow text-left">
                      <p className="text-sm font-bold textColor">
                        {t("wallet_balance") || "Wallet Balance"}
                      </p>
                      <p className="text-[11px] SecondaryTextColor">
                        {walletStatusLabel}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-extrabold primaryColor tabular-nums">
                      {money(walletBalance)}
                    </span>
                    <CheckCircle active={useWallet} />
                  </button>
                )}

                {/* Wallet full-cover ⇒ it IS the payment; hide the rest. */}
                {!(useWallet && walletCoversAll) && codAllowed && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("COD")}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      paymentMethod === "COD"
                        ? "primaryColorBorder primaryLightBack"
                        : "border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] hover:bg-gray-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full primaryLightBack primaryColor">
                      <RiMoneyDollarCircleLine size={18} />
                    </span>
                    <div className="min-w-0 flex-grow text-left">
                      <p className="text-sm font-bold textColor">
                        {isPickup
                          ? t("pay_at_store") || "Pay at Store"
                          : t("cash_on_delivery") || "Cash on Delivery"}
                      </p>
                      <p className="text-[11px] SecondaryTextColor">
                        {isPickup
                          ? t("pay_at_store") || "Pay at Store"
                          : t("pay_when_you_receive") || "Pay when you receive"}
                      </p>
                    </div>
                    <CheckCircle active={paymentMethod === "COD"} />
                  </button>
                )}
              </div>

              {/* Online gateways — compact single-line rows (logo + name + radio),
              much shorter than tall tiles so a long list stays tight. */}
              {!(useWallet && walletCoversAll) &&
                enabledGateways.length > 0 && (
                  <>
                    <div className="my-3 flex items-center gap-2">
                      <span className="h-px flex-grow bg-[color-mix(in_srgb,var(--primary-color)_18%,transparent)]" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider SecondaryTextColor">
                        {t("pay_online") || "Pay Online"}
                      </span>
                      <span className="h-px flex-grow bg-[color-mix(in_srgb,var(--primary-color)_18%,transparent)]" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {enabledGateways.map((g) => {
                        const active = paymentMethod === g.value;
                        return (
                          <button
                            type="button"
                            key={g.value}
                            onClick={() => setPaymentMethod(g.value)}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                              active
                                ? "primaryColorBorder primaryLightBack"
                                : "border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] hover:bg-gray-50 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-black/5 dark:bg-zinc-800">
                              <Image
                                src={g.logo}
                                alt={g.value}
                                height={16}
                                className="h-4 w-auto object-contain"
                              />
                            </span>
                            <span className="flex-grow truncate text-left text-sm font-semibold capitalize textColor">
                              {t(g.value) || g.value}
                            </span>
                            <CheckCircle active={active} />
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
            </div>
          </section>

          {/* Bill breakdown — lives INSIDE the scroll area so a long list of charges
            can never push the Total + Place Order below the fold. The footer keeps
            only the grand total + CTA, always visible. */}
          <section className="bodyBackgroundColor cardBorderPrimary !rounded-lg shadow-sm">
            <div className="border-b border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] p-4">
              <span className="flex items-center gap-2 font-bold text-lg textColor">
                {t("bill_details") || t("order_summary") || "Bill Details"}
              </span>
            </div>
            <div className="space-y-1.5 p-4">
              <div className="flex justify-between text-[13px] SecondaryTextColor">
                <span className="flex items-center gap-1.5">
                  {t("subtotal")}{" "}
                  {/* API's subtotal is already tax-inclusive (tax_breakdown is
                      reported separately and not added on top) — same wording as
                      FinalCheckoutSummary's order-detail bill, only shown when a
                      real tax amount is actually part of it. The per-tax
                      (IGST/CGST/SGST) split lives in the tooltip rather than
                      its own bill rows, so the bill stays visually calm. */}
                  {taxBreakdownRows.length > 0 && (
                    <>
                      <span className="text-[11px]">
                        ({t("incl_tax") || "Incl. Tax"})
                      </span>
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                              aria-label={t("incl_tax") || "Incl. Tax"}
                            >
                              <FiInfo size={13} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">
                            <div className="flex flex-col gap-0.5">
                              {taxBreakdownRows.map((tx: any, i: number) => (
                                <div
                                  key={`subtotal-tax-${i}`}
                                  className="flex justify-between gap-3"
                                >
                                  <span>
                                    {tx?.rate != null
                                      ? `${tx?.name} (${tx?.rate}%)`
                                      : tx?.name}
                                  </span>
                                  <span className="tabular-nums">
                                    {money(tx?.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  )}
                </span>
                <span className="tabular-nums">{money(subTotal)}</span>
              </div>
              {/* Hidden for pickup — there's no delivery leg to charge for,
                  same reasoning as the tax-inclusive banner above. */}
              {!isPickup && (
                <div className="flex justify-between text-[13px] SecondaryTextColor">
                  <span className="flex items-center gap-1.5">
                    {t("delivery_charge") || "Delivery Charge"}
                    {Number(deliveryChargeTax?.tax_amount) > 0 && (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                              aria-label={`${t("incl") || "Incl."} ${deliveryChargeTax?.tax_name || t("tax") || "Tax"} ${money(deliveryChargeTax?.tax_amount)}`}
                            >
                              <FiInfo size={13} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">
                            {t("incl") || "Incl."} {deliveryChargeTax?.tax_name || t("tax") || "Tax"}{" "}
                            {money(deliveryChargeTax?.tax_amount)}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                  <span className="tabular-nums">
                    {deliveryCharge > 0
                      ? money(deliveryCharge)
                      : t("free") || "Free"}
                  </span>
                </div>
              )}
              {/* Packing / handling / zone charges w/ refundable tag (checkout parity). */}
              {chargeRows.map((c, i) => (
                <div
                  key={`charge-${i}`}
                  className="flex justify-between text-[13px] SecondaryTextColor"
                >
                  <span className="flex items-center gap-1.5">
                    {c.label}
                    {c.refundable != null && (
                      <span
                        className={`text-[10px] font-semibold ${
                          c.refundable == 1 || c.refundable === true
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-gray-400"
                        }`}
                      >
                        {c.refundable == 1 || c.refundable === true
                          ? `(${t("refundable") || "Refundable"})`
                          : `(${t("non_refundable") || "Non-refundable"})`}
                      </span>
                    )}
                    {/* This charge's own amount already has taxAmount baked
                        in (same "already inclusive" shape as sub_total/
                        tax_amount) — a small (i) tooltip instead of a
                        permanent extra line, so the bill stays visually calm. */}
                    {Number(c.taxAmount) > 0 && (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                              aria-label={`${t("incl") || "Incl."} ${c.taxName || t("tax") || "Tax"} ${money(c.taxAmount)}`}
                            >
                              <FiInfo size={13} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">
                            {t("incl") || "Incl."} {c.taxName || t("tax") || "Tax"}{" "}
                            {money(c.taxAmount)}
                            {(c.refundable == 1 || c.refundable === true) && (
                              <>
                                {" "}
                                (
                                {t("tax_not_refundable") ||
                                  "tax not refundable"}
                                )
                              </>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                  <span className="tabular-nums">{money(c.amount)}</span>
                </div>
              ))}
              {/* Instant coupons only. A cashback ("wallet" apply-type) coupon
                  is credited AFTER the order, so listing it here as a negative
                  line in the bill read as money already taken off the total —
                  it gets its own "you'll earn cashback" callout below instead.
                  Same guard the cart drawer already applies. */}
              {appliedCoupon &&
                !isCashbackCoupon &&
                Number(appliedCoupon?.discount || 0) > 0 && (
                  <div className="flex justify-between text-[13px] primaryColor">
                    <span>{t("coupon_discount") || "Coupon Discount"}</span>
                    <span className="tabular-nums">
                      -{money(appliedCoupon?.discount)}
                    </span>
                  </div>
                )}
              {useWallet && walletUsedAmount > 0 && (
                <div className="flex justify-between text-[13px] primaryColor">
                  <span>{t("wallet") || "Wallet"}</span>
                  <span className="tabular-nums">
                    -{money(walletUsedAmount)}
                  </span>
                </div>
              )}
            </div>
            {/* Total savings callout — product slab savings + instant coupon discount.
            Scalloped (ticket-style) top edge via a repeating radial-gradient mask.
            Cashback ("wallet") excluded here (shown as its own reward below). */}
            {totalSaved > 0 && (
              <div
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 px-3.5 pb-3 pt-4 text-center dark:from-emerald-500/10 dark:via-green-500/10 dark:to-teal-500/10"
                style={{
                  // Scalloped top edge: transparent half-circles cut out every 16px.
                  WebkitMaskImage:
                    "radial-gradient(circle 8px at 8px -2px, transparent 8px, #000 8.5px)",
                  maskImage:
                    "radial-gradient(circle 8px at 8px -2px, transparent 8px, #000 8.5px)",
                  WebkitMaskSize: "16px 100%",
                  maskSize: "16px 100%",
                  WebkitMaskRepeat: "repeat-x",
                  maskRepeat: "repeat-x",
                  borderRadius: "0 0 8px 8px",
                }}
              >
                <MdOutlineCelebration
                  size={18}
                  className="shrink-0 text-emerald-600 dark:text-emerald-400"
                />
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {t("you_saved")}{" "}
                  <span className="font-extrabold">{money(totalSaved)}</span>{" "}
                  <span className="font-normal text-emerald-600/80 dark:text-emerald-400/70">
                    {t("you_saved_on_this_order")}
                  </span>
                </p>
              </div>
            )}
          </section>

          {/* Cashback reward — "wallet" apply-type coupon. Credited to the wallet
            AFTER the order, so it's a reward callout, never a price line. */}
          {appliedCoupon && isCashbackCoupon && (
            <div className="flex items-center gap-2.5 rounded-lg bg-amber-500/10 px-3.5 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <RiWallet3Line size={18} />
              </span>
              <div className="min-w-0 flex-grow">
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {t("you_will_earn_cashback")} {money(promoDiscount)}
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                  {t("cashback_added_to_wallet")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer — the ONLY grand-total (breakdown above has no total row) + the CTA.
          Always visible; the scroll area above never pushes it off screen. */}
        <div className="shrink-0 w-full border-t bg-white px-4 pb-4 pt-3 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.15)] dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-medium uppercase tracking-wide SecondaryTextColor">
                {t("total") || "Total"}
              </span>
              {(chargeRows.length > 0 || deliveryCharge > 0) && (
                <span className="text-[10px] SecondaryTextColor">
                  {t("inclusive_of_charges") || "Incl. all charges"}
                </span>
              )}
            </div>
            <span className="text-2xl font-extrabold primaryColor tabular-nums">
              {money(payable)}
            </span>
          </div>
          {/* Progressive CTA: guides to the next missing step (Add Address →
              Select Payment → Place Order). The guide states stay ENABLED so the
              tap can open the modal / scroll to payment; only real blockers
              (loading, missing required Rx) disable it. */}
          <button
            type="button"
            onClick={cta.action}
            disabled={paymentLoading || totalsLoading || cta.blocked}
            {...ctaClosedSpreadProps}
            className={`primaryBackColor flex w-full items-center justify-center gap-2 rounded-lg py-3.5 text-[15px] font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500 ${ctaClosedClassName}`}
          >
            {paymentLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                {t("placing_order") || "Placing order..."}
              </>
            ) : (
              cta.label
            )}
          </button>
        </div>
        {StripePortal}
      </div>

      {/* Shared add-address modal. On success it calls fetchAddress with the prior
          ids so loadAddresses can auto-select the newly created address. */}
      <NewAddressModal
        showAddAddres={showAddAddress}
        setShowAddAddres={setShowAddAddress}
        isAddressSelected={isEditingAddress}
        fetchAddress={loadAddresses}
        adoptZone={false}
      />
    </>
  );
};

export default QuickCheckoutView;
