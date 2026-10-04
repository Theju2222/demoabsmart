import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Caveat, Playfair_Display } from "next/font/google";
import "@/styles/globals.css";
import Providers from "./Providers";
import FontAwesomeLoader from "./FontAwesomeLoader";

// Variable font: one file covering the whole wght axis, rather than four static
// cuts. Instrument Sans tops out at 700 where Nunito went to 900, and the markup
// still has ~50 font-extrabold/font-black (800/900) usages — those clamp to 700
// instead of pulling a separate file per weight.
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-family",
  display: "swap",
});

// Handwriting font for small decorative taglines (e.g. Spin & Win's "Your
// Luck Awaits!" script). Scoped to its own CSS var so it never leaks into
// --font-family / the rest of the UI, which stays on Instrument Sans.
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-script",
  display: "swap",
});

// Display serif for the Spin & Win poster lockup only. Italic 900 is what the
// reference's lettering is drawn in; Georgia (the previous fallback) has a much
// flatter stroke contrast and read as ordinary bold italic text rather than
// poster type. Scoped to its own var so it can't leak into the rest of the UI.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["900"],
  style: ["italic"],
  variable: "--font-poster",
  display: "swap",
});

export const metadata: Metadata = {
  // Without this, Next infers the base for relative OG/Twitter image URLs
  // from the incoming request host — wrong behind a reverse proxy, and noisy
  // (a build-time warning on every page). Every migrated page passes an
  // absolute ogImage/ogUrl already, so this is mostly a safety net for any
  // relative fallback (e.g. buildPageMetadata's "/favicon.webp" default).
  metadataBase: process.env.NEXT_PUBLIC_BASE_URL
    ? new URL(process.env.NEXT_PUBLIC_BASE_URL)
    : undefined,
  applicationName: process.env.NEXT_PUBLIC_WEB_NAME,
  appleWebApp: {
    title: process.env.NEXT_PUBLIC_WEB_NAME,
    statusBarStyle: "default",
  },
  // manifest.webmanifest is auto-linked from src/app/manifest.ts — no need
  // to declare it here.
  icons: {
    icon: "/favicon.webp",
    apple: "/icons/apple-touch-icon.png",
  },
};

// No maximum-scale/user-scalable=no. Blocking pinch-zoom fails WCAG 1.4.4
// (Resize Text) and is what Lighthouse's "[user-scalable=no] is used" audit
// flags. Low-vision users on mobile need to zoom; the layout is responsive,
// so nothing breaks when they do. Matches MetaData.jsx's viewport tag.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /* The font variables live on <html>, not on <main>: dialogs and toasts
       portal to document.body, OUTSIDE <main>, so anything rendered there saw
       the vars as undefined and silently fell back to the next family in the
       stack. */
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${caveat.variable} ${playfair.variable}`}
    >
      <head>
        {/* Preconnectors */}
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="" />
        {/* Instrument Sans is self-hosted via next/font above — no Google
            Fonts CDN needed (no render-blocking link, no unused families). */}
        <FontAwesomeLoader />
      </head>
      <body className="antialiased !pointer-events-auto">
        <main>
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}
