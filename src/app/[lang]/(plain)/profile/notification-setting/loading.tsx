import Loader from "@/components/loader/Loader";

// NotificationSetting shows a plain <Loader /> while it fetches, so this
// matches it rather than drawing a card shape the page never settles into.
export default function Loading() {
  return <Loader />;
}
