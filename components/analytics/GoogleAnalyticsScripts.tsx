"use client";

import { useEffect } from "react";
import Script from "next/script";
import { configureGoogleAnalytics } from "@/lib/analytics/data-layer";
import { googleDeliveryMode, type GoogleAnalyticsSettings } from "@/lib/analytics/config";

export default function GoogleAnalyticsScripts({ settings }: { settings: GoogleAnalyticsSettings }) {
  const mode = googleDeliveryMode(settings);
  useEffect(() => {
    if (mode === "direct") {
      window.dataLayer ??= [];
      window.gtag = function () { window.dataLayer!.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", settings.googleAnalyticsMeasurementId, {
        send_page_view: false, debug_mode: settings.googleAnalyticsDebugMode,
        // Do not let the tag read sensitive query strings from checkout/payment URLs.
        page_location: window.location.origin + window.location.pathname,
        page_referrer: "",
      });
    }
    configureGoogleAnalytics(settings);
  }, [mode, settings]);
  if (mode === "gtm") return <Script id={`google-tag-manager-${settings.googleTagManagerId}`} strategy="afterInteractive">{`
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
    var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;
    j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer',${JSON.stringify(settings.googleTagManagerId)});
  `}</Script>;
  if (mode === "direct") return <Script id="google-analytics-direct" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${settings.googleAnalyticsMeasurementId}`} />;
  return null;
}
