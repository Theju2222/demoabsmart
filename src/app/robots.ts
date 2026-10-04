import type { MetadataRoute } from "next";
import { isDemoModeServer } from "@/api/serverApi";

// This is a white-label template deployed per-client, each on its own domain
// (NEXT_PUBLIC_BASE_URL) — a static public/robots.txt bakes in whichever
// client's domain it was last committed under, so the Sitemap: line ends up
// pointing at a DIFFERENT client's site once redeployed elsewhere. Generating
// this from the env var keeps it correct on every deploy without a manual edit.
//
// demo_mode (from the settings API, cached — see isDemoModeServer) blocks all
// crawling outright: a demo deployment getting indexed/crawled is both
// unwanted (it's not a real client site) and the exact per-request cost this
// flag exists to avoid on Vercel's free tier.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

  if (await isDemoModeServer()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
