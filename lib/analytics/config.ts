export type GoogleAnalyticsSettings = {
  googleTrackingEnabled: boolean;
  googleTagManagerEnabled: boolean;
  googleTagManagerId: string | null;
  googleAnalyticsEnabled: boolean;
  googleAnalyticsMeasurementId: string | null;
  googleAnalyticsDebugMode: boolean;
};
export const GOOGLE_ANALYTICS_DEFAULTS: GoogleAnalyticsSettings = {
  googleTrackingEnabled: false, googleTagManagerEnabled: false, googleTagManagerId: null,
  googleAnalyticsEnabled: false, googleAnalyticsMeasurementId: null, googleAnalyticsDebugMode: false,
};
export const GTM_ID = /^GTM-[A-Z0-9]{6,10}$/;
export const GA4_ID = /^G-[A-Z0-9]{10}$/;
export function parseGoogleAnalyticsSettings(body: Record<string, unknown>) {
  const result = { ...GOOGLE_ANALYTICS_DEFAULTS };
  for (const key of ["googleTrackingEnabled", "googleTagManagerEnabled", "googleAnalyticsEnabled", "googleAnalyticsDebugMode"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "boolean") throw new Error(`${key} must be true or false`);
    result[key] = body[key] === true;
  }
  for (const [key, pattern, example] of [
    ["googleTagManagerId", GTM_ID, "GTM-MTXSMKW5"],
    ["googleAnalyticsMeasurementId", GA4_ID, "G-XXXXXXXXXX"],
  ] as const) {
    const value = String(body[key] ?? "").trim();
    if (value && !pattern.test(value)) throw new Error(`${key} is invalid. Expected ${example}.`);
    result[key] = value || null;
  }
  if (result.googleTagManagerEnabled && !result.googleTagManagerId) throw new Error("GTM Container ID is required when GTM is enabled.");
  if (result.googleAnalyticsEnabled && !result.googleAnalyticsMeasurementId) throw new Error("GA4 Measurement ID is required when GA4 is enabled.");
  return result;
}
export function resolveGoogleAnalyticsSettings(body?: Record<string, unknown> | null): GoogleAnalyticsSettings {
  try { return parseGoogleAnalyticsSettings(body ?? {}); } catch { return { ...GOOGLE_ANALYTICS_DEFAULTS }; }
}
export function googleDeliveryMode(settings: GoogleAnalyticsSettings) {
  if (!settings.googleTrackingEnabled) return "disabled";
  if (settings.googleTagManagerEnabled && GTM_ID.test(settings.googleTagManagerId ?? "")) return "gtm";
  if (settings.googleAnalyticsEnabled && GA4_ID.test(settings.googleAnalyticsMeasurementId ?? "")) return "direct";
  return "disabled";
}
