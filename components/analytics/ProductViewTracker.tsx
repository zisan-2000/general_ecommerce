"use client";

import { useEffect, useRef } from "react";
import type { GA4Item } from "@/lib/analytics/ecommerce";
import { trackViewItem } from "@/lib/analytics/data-layer";

export default function ProductViewTracker({
  item,
  currency,
}: {
  item: GA4Item;
  currency: string;
}) {
  const lastItemId = useRef("");

  useEffect(() => {
    if (!item.item_id || lastItemId.current === item.item_id) return;
    lastItemId.current = item.item_id;
    trackViewItem({
      currency,
      value: item.price,
      items: [{ ...item, quantity: 1 }],
    });
  }, [currency, item]);

  return null;
}
