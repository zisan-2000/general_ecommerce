import { googleDeliveryMode, type GoogleAnalyticsSettings } from "./config";
import type { EcommercePayload } from "./ecommerce";

type DataLayerEntry = Record<string, unknown> | IArguments;
declare global {
  interface Window {
    dataLayer?: DataLayerEntry[];
    gtag?: (...args: unknown[]) => void;
  }
}
let settings: GoogleAnalyticsSettings | null = null;
let consent = true;
let pending: Array<{ event: string; params: Record<string, unknown>; ecommerce: boolean }> = [];
const sentTransactions = new Set<string>();
function definedValues(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}
export function configureGoogleAnalytics(value: GoogleAnalyticsSettings) {
  settings = value;
  const queued = pending;
  pending = [];
  for (const item of queued) deliver(item.event, item.params, item.ecommerce);
}
// Future CMP can revoke/grant tracking here before any business event is emitted.
export function setGoogleAnalyticsConsent(granted: boolean) { consent = granted; if (!granted) pending = []; }
export function pushToDataLayer(value: Record<string, unknown>): boolean {
  try {
    if (typeof window === "undefined" || !consent || !settings || googleDeliveryMode(settings) === "disabled") return false;
    (window.dataLayer ??= []).push(value);
    return true;
  } catch { return false; }
}
function deliver(event: string, params: Record<string, unknown>, ecommerce: boolean): boolean {
  try {
    if (typeof window === "undefined" || !consent) return false;
    if (!settings) {
      if (pending.length < 100) pending.push({ event, params, ecommerce });
      return false;
    }
    const mode = googleDeliveryMode(settings);
    if (mode === "disabled") return false;
    if (event === "session_start" && mode === "direct") return false;
    const debug = settings.googleAnalyticsDebugMode ? { debug_mode: true } : {};
    if (mode === "gtm") {
      if (ecommerce) pushToDataLayer({ ecommerce: null });
      return pushToDataLayer({ event, ...debug, ...(ecommerce ? { ecommerce: params } : params) });
    }
    window.gtag?.("event", event, { ...params, ...debug, send_to: settings.googleAnalyticsMeasurementId });
    return typeof window.gtag === "function";
  } catch { return false; }
}
export function trackEvent(event: string, payload: EcommercePayload) {
  // Explicit payload allowlist: never spread business/customer objects into Google events.
  const { currency, value, tax, shipping, coupon, transaction_id, shipping_tier, payment_type,
    item_list_id, item_list_name, promotion_id, promotion_name, creative_name, creative_slot } = payload;
  const items = payload.items?.filter((item) => item.item_id && item.quantity > 0).slice(0, 200).map((item) => {
    const { item_id, item_name, item_brand, item_category, item_category2, item_category3,
      item_variant, price, quantity, discount, coupon, index } = item;
    return definedValues({ item_id, item_name, item_brand, item_category, item_category2, item_category3,
      item_variant, price, quantity, discount, coupon, index });
  });
  return deliver(event, definedValues({ currency, value, tax, shipping, coupon, transaction_id, shipping_tier, payment_type,
    item_list_id, item_list_name, promotion_id, promotion_name, creative_name, creative_slot, items }), true);
}
export const trackViewItem = (p: EcommercePayload) => trackEvent("view_item", p);
export const trackViewItemList = (p: EcommercePayload) => trackEvent("view_item_list", p);
export const trackSelectItem = (p: EcommercePayload) => trackEvent("select_item", p);
export const trackAddToCart = (p: EcommercePayload) => trackEvent("add_to_cart", p);
export const trackRemoveFromCart = (p: EcommercePayload) => trackEvent("remove_from_cart", p);
export const trackViewCart = (p: EcommercePayload) => trackEvent("view_cart", p);
export const trackBeginCheckout = (p: EcommercePayload) => trackEvent("begin_checkout", p);
export const trackAddShippingInfo = (p: EcommercePayload) => trackEvent("add_shipping_info", p);
export const trackAddPaymentInfo = (p: EcommercePayload) => trackEvent("add_payment_info", p);
export const trackAddToWishlist = (p: EcommercePayload) => trackEvent("add_to_wishlist", p);
export const trackViewPromotion = (p: EcommercePayload) => trackEvent("view_promotion", p);
export const trackSelectPromotion = (p: EcommercePayload) => trackEvent("select_promotion", p);
export function trackPurchase(payload: EcommercePayload) {
  try {
    if (typeof window === "undefined" || !payload.transaction_id || !settings || !consent || googleDeliveryMode(settings) === "disabled") return;
    const key = `analytics_purchase_${payload.transaction_id}`;
    if (sentTransactions.has(key)) return;
    try { if (localStorage.getItem(key)) return; } catch { /* In-memory fallback. */ }
    if (trackEvent("purchase", payload)) {
      sentTransactions.add(key);
      try { localStorage.setItem(key, "1"); } catch { /* In-memory fallback. */ }
    }
  } catch { /* Tracking never affects order placement. */ }
}
export function trackRefund(payload: EcommercePayload, refundId: string) {
  try {
    const key = `analytics_refund_${refundId}`;
    if (sentTransactions.has(key)) return;
    try { if (localStorage.getItem(key)) return; } catch { /* In-memory fallback. */ }
    if (trackEvent("refund", payload)) {
      sentTransactions.add(key);
      try { localStorage.setItem(key, "1"); } catch { /* In-memory fallback. */ }
    }
  } catch { /* Tracking never affects completed refunds. */ }
}
export function trackPageView(params: { page_location: string; page_path: string; page_title: string }) {
  return deliver("page_view", params, false);
}
export function trackSessionStart() {
  if (settings && googleDeliveryMode(settings) === "direct") return false;
  return deliver("session_start", {}, false);
}
