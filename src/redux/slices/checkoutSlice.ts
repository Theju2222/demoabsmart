import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CheckoutState {
  currentStep: number;
  address: any | null;
  selectedPaymentMethod: any | null;
  isWalletChecked: boolean;
  usedWalletBalance: number;
  orderNote: string;
  checkoutTotal: number;
  phonepecheckoutdetails: any;
  orderType: string;
  // Self-pickup toggle — a SEPARATE axis from orderType above (that field is
  // unrelated, pre-existing). The customer's REQUESTED delivery mode; the
  // MODE A CART WAS ACTUALLY PRICED IN is a response field
  // (checkoutData.delivery_type from getCart), read directly off the cart
  // response in the UI rather than duplicated here — the backend silently
  // falls back to "delivery" when pickup isn't available, so only the
  // response is authoritative.
  deliveryType: "delivery" | "pickup";
}

const initialState: CheckoutState = {
  currentStep: 1,
  address: null,
  selectedPaymentMethod: null,
  isWalletChecked: false,
  usedWalletBalance: 0,
  orderNote: "",
  checkoutTotal: 0,
  phonepecheckoutdetails: "",
  orderType: "doorstep",
  deliveryType: "delivery",
};

export const checkoutReducer = createSlice({
  name: "checkout",
  initialState,
  reducers: {
    setCurrentStep: (state, action: PayloadAction<{ data: number }>) => {
      state.currentStep = action.payload.data;
    },
    setAddress: (state, action: PayloadAction<{ data: any }>) => {
      state.address = action.payload.data;
    },
    setPaymentMethod: (state, action: PayloadAction<{ data: any }>) => {
      state.selectedPaymentMethod = action.payload.data;
    },
    setWalletChecked: (state, action: PayloadAction<{ data: boolean }>) => {
      state.isWalletChecked = action.payload.data;
    },
    setUserWalletBalance: (state, action: PayloadAction<{ data: number }>) => {
      state.usedWalletBalance = action.payload.data;
    },
    setOrderNote: (state, action: PayloadAction<{ data: string }>) => {
      state.orderNote = action.payload.data;
    },
    setCheckoutTotal: (state, action: PayloadAction<{ data: number }>) => {
      state.checkoutTotal = action.payload.data;
    },
    setPhonePeCheckoutDetails: (state, action: PayloadAction<any>) => {
      state.phonepecheckoutdetails = action.payload;
    },
    setOrderType: (state, action: PayloadAction<{ data: string }>) => {
      state.orderType = action.payload.data;
    },
    setDeliveryType: (
      state,
      action: PayloadAction<{ data: "delivery" | "pickup" }>,
    ) => {
      state.deliveryType = action.payload.data;
    },
    clearCheckout: (state) => {
      const phonepecheckoutdetails = state.phonepecheckoutdetails;
      Object.assign(state, {
        currentStep: 1,
        address: null,
        selectedPaymentMethod: null,
        isWalletChecked: false,
        usedWalletBalance: 0,
        orderNote: "",
        checkoutTotal: 0,
        orderType: "doorstep",
        deliveryType: "delivery",
        phonepecheckoutdetails, // preserve the existing value
      });
    },
    clearPhonePeCheckoutDetails: (state) => {
      state.phonepecheckoutdetails = null as any;
    },
  },
});

export const {
  setAddress,
  setPaymentMethod,
  setCurrentStep,
  setWalletChecked,
  setOrderNote,
  clearCheckout,
  clearPhonePeCheckoutDetails,
  setCheckoutTotal,
  setUserWalletBalance,
  setPhonePeCheckoutDetails,
  setOrderType,
  setDeliveryType,
} = checkoutReducer.actions;

export default checkoutReducer.reducer;
