"use client";

import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { t } from "@/utils/translation";
import { usePathname } from "next/navigation";
import useStandalone from "@/hooks/useStandalone";

const MobileBottomSheet = () => {
  const isStandalone = useStandalone();
  const [showAppNotInstalledPopup, setShowAppNotInstalledPopup] =
    useState(false);
  const settings = useSelector((state: any) => state.Setting.setting);

  const path = usePathname();

  const androidAppLink = settings?.web_settings?.android_app_url;
  const iosAppLink = settings?.web_settings?.ios_app_url;
  const appName = process.env.NEXT_PUBLIC_WEB_NAME || "eCommerce";

  // Settings API's own deeplink_schema is the authoritative URI scheme the
  // native app actually registered — per-client and can differ from the
  // display name (NEXT_PUBLIC_WEB_NAME), which is just a fallback for a
  // client that hasn't set one.
  const appScheme =
    settings?.deeplink_schema || process.env.NEXT_PUBLIC_WEB_NAME || "eCommerce";

  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobileWidth, setIsMobileWidth] = useState(false);

  const currentStoreLink = isAndroid
    ? androidAppLink
    : isIOS
      ? iosAppLink
      : androidAppLink;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const userAgent =
      navigator.userAgent || navigator.vendor || (window as any).opera || "";
    // Intentional sync setState: derives state from the external userAgent/window APIs on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAndroid(/android/i.test(userAgent));
    setIsIOS(/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream);

    const updateWidth = () => setIsMobileWidth(window.innerWidth < 769);
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (Date.now() - (window as any).lastDeepLinkAttempt < 1000) {
          setShowAppNotInstalledPopup(false);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Silent auto-attempt on mount, once per session: fire the deep link right
  // away with no prompt shown first, so an installed app opens with zero
  // taps. Only if that attempt goes unanswered (tab never backgrounds within
  // the timeout, i.e. app not installed) does the fallback "not installed"
  // popup appear — there is no more manual "Open in App" sheet, which used
  // to show unconditionally even when the app WAS installed.
  useEffect(() => {
    if (!isMobileWidth || isStandalone) return;
    if (!isAndroid && !isIOS) return;
    if (sessionStorage.getItem("hasAttemptedDeepLink")) return;
    sessionStorage.setItem("hasAttemptedDeepLink", "true");
    attemptDeepLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per device-detection resolving; attemptDeepLink is stable enough for a single mount-time probe
  }, [isMobileWidth, isStandalone, isAndroid, isIOS]);

  const attemptDeepLink = () => {
    // Build a valid URI scheme from the app name:
    // lowercase, drop everything except letters/digits (spaces, punctuation,
    // "&", etc. are illegal in a scheme). Fall back to "app" if nothing is left.
    const sanitizedAppName =
      appScheme
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "app";

    const currentPath = path;

    const hostname =
      typeof window !== "undefined" ? window.location.hostname : "";

    let deepLink = `${sanitizedAppName}://${hostname}${currentPath}`;

    (window as any).lastDeepLinkAttempt = Date.now();

    const appCheckTimeout = setTimeout(() => {
      if (!document.hidden) {
        console.error("App not installed, showing popup");
        setShowAppNotInstalledPopup(true);
      }
    }, 2000);

    if (isIOS) {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = deepLink;
      document.body.appendChild(iframe);

      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 100);
    }

    if (isAndroid) {
      window.onerror = function (message) {
        if (
          String(message).includes("Failed to launch") &&
          String(message).includes("intent://")
        ) {
          clearTimeout(appCheckTimeout);

          setShowAppNotInstalledPopup(true);

          window.onerror = null;
          return true;
        }
      };
    }

    try {
      // Not an internal Next.js route: deepLink is a custom app URI scheme
      // (e.g. "appname://...") used to hand off to the native app.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = deepLink;
    } catch (e) {
      console.error("Error opening app:", e);
      clearTimeout(appCheckTimeout);

      setShowAppNotInstalledPopup(true);
    }
  };

  const handleDownloadApp = () => {
    setShowAppNotInstalledPopup(false);

    if (currentStoreLink) {
      window.location.href = currentStoreLink;
    } else {
      if (isAndroid) {
        window.location.href = `https://play.google.com/store/search?q=${appName}&c=apps`;
      } else if (isIOS) {
        window.location.href = `https://apps.apple.com/search?term=${appName}`;
      }
    }
  };

  if (!isMobileWidth) {
    return null;
  }
  // Already running as an installed app. Firing the appname:// scheme at the
  // very app the user is already inside would misfire the "not installed"
  // popup off its own no-response timeout, so skip entirely.
  if (isStandalone) {
    return null;
  }

  return (
    <>
      {showAppNotInstalledPopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAppNotInstalledPopup(false)}
          />

          <div className="relative footer rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold secondryTextColor mb-3">
              {t("appNotInstalled")}
            </h3>
            <p className="text-sm text-white mb-6">
              {isAndroid
                ? t("downloadPromptPlayStore")
                : t("downloadPromptAppStore")}
            </p>

            <div className="flex gap-3">
              <button
                className="flex-1 primaryBackColor text-white rounded-lg py-3 px-4 font-semibold text-base transition-opacity hover:opacity-90"
                onClick={handleDownloadApp}
              >
                {isAndroid ? t("playStore") : t("appStore")}
              </button>
              <button
                className="flex-1 text-white bg-black rounded-lg py-3 px-4 font-semibold text-base transition-colors hover:bg-gray-200"
                onClick={() => setShowAppNotInstalledPopup(false)}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileBottomSheet;
