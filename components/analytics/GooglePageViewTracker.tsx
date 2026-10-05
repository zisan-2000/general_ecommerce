"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView, trackSessionStart } from "@/lib/analytics/data-layer";

export default function GooglePageViewTracker() {
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const last = useRef("");
  useEffect(() => {
    if (!(pathname === "/" || pathname.startsWith("/ecommerce")) || pathname.startsWith("/ecommerce/user")) return;
    const key = pathname + "?" + query;
    if (last.current === key) return;
    // URLs intentionally exclude all queries/fragments: searches and gateway returns may contain PII/tokens.
    const timer = setTimeout(() => {
      last.current = key;
      // GA4 itself owns native session_start. This dataLayer signal is for GTM visibility only;
      // do not map it to a GA4 event tag (see documentation).
      try {
        const now = Date.now();
        const previous = Number(sessionStorage.getItem("google_tracking_session_activity") || 0);
        if (!previous || now - previous > 30 * 60 * 1000) trackSessionStart();
        sessionStorage.setItem("google_tracking_session_activity", String(now));
      } catch { /* No synthetic repeated sessions when storage is unavailable. */ }
      trackPageView({ page_location: window.location.origin + pathname, page_path: pathname,
        page_title: query || pathname === "/ecommerce/checkout" || pathname === "/ecommerce/payment-result"
          ? "Storefront" : document.title.replace(/[^\s@]+@[^\s@]+/g, "[redacted]").replace(/\+?\d[\d\s()-]{7,}\d/g, "[redacted]") });
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname, query]);
  return null;
}
