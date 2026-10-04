import type { Metadata } from "next";
import Subscription from "@/components/profiledashboard/subscriptions/Subscriptions";
import AuthGate from "@/components/auth/AuthGate";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Subscription - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  // pageName kept exactly as the original (a pre-existing copy-paste value,
  // not "/profile/subscription") — preserving behavior, not fixing it here.
  pageName: "/profile/order-history",
  robots: "noindex, nofollow",
});

// requireSubscription is only meaningful on this route, so the extra gate sits
// here rather than in the shared profile layout. The layout's own AuthGate
// (requireAuth) still applies above this one.
export default function SubscriptionRoute() {
  return (
    <AuthGate requireAuth requireSubscription>
      <Subscription />
    </AuthGate>
  );
}
