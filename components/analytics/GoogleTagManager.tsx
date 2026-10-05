import type { GoogleAnalyticsSettings } from "@/lib/analytics/config";
import { googleDeliveryMode } from "@/lib/analytics/config";
import GoogleAnalyticsScripts from "./GoogleAnalyticsScripts";

export default function GoogleTagManager({ settings }: { settings: GoogleAnalyticsSettings }) {
  // Only public identifiers/flags cross the server/client boundary.
  const publicSettings: GoogleAnalyticsSettings = {
    googleTrackingEnabled: settings.googleTrackingEnabled,
    googleTagManagerEnabled: settings.googleTagManagerEnabled,
    googleTagManagerId: settings.googleTagManagerId,
    googleAnalyticsEnabled: settings.googleAnalyticsEnabled,
    googleAnalyticsMeasurementId: settings.googleAnalyticsMeasurementId,
    googleAnalyticsDebugMode: settings.googleAnalyticsDebugMode,
  };
  return <>
    {googleDeliveryMode(publicSettings) === "gtm" && <noscript><iframe
      src={`https://www.googletagmanager.com/ns.html?id=${publicSettings.googleTagManagerId}`}
      height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="Google Tag Manager" /></noscript>}
    <GoogleAnalyticsScripts settings={publicSettings} />
  </>;
}
