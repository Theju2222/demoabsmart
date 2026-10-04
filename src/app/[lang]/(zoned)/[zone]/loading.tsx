import Loader from "@/components/loader/Loader";

// A spinner, not section skeletons. The home layout's section mix is
// server-driven (banners, rails, tabs, in whatever order the store
// configured), so a fixed guess here painted card rails that neither matched
// this store's real sections nor the banner shape above them. Matches the
// page-builder route's loading state, so every server-driven page in the app
// shows the same thing while its payload is in flight.
export default function Loading() {
  return <Loader screen="full" />;
}
