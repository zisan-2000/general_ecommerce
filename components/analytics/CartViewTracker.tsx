"use client";
import { useEffect, useRef } from "react";
import { ecommerceFromRows } from "@/lib/analytics/ecommerce";
import { trackViewCart, trackBeginCheckout } from "@/lib/analytics/data-layer";
export default function CartViewTracker({ rows, currency, ready, checkout = false, coupon }: {
  rows: readonly unknown[]; currency: string; ready: boolean; checkout?: boolean; coupon?: string;
}) {
  const sent = useRef(false);
  const payload = ecommerceFromRows(rows, currency, coupon);
  useEffect(() => {
    if (!ready || sent.current || !payload.items?.length) return;
    sent.current = true;
    if (checkout) trackBeginCheckout(payload); else trackViewCart(payload);
  }, [ready, checkout, payload]);
  return null;
}
