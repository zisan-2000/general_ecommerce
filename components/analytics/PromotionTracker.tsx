"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import type { GA4Item } from "@/lib/analytics/ecommerce";
import {
  trackSelectItem,
  trackSelectPromotion,
  trackViewItemList,
  trackViewPromotion,
} from "@/lib/analytics/data-layer";

export default function PromotionTracker({
  children,
  promotionId,
  promotionName,
  currency,
  items,
}: {
  children: ReactNode;
  promotionId: string;
  promotionName: string;
  currency: string;
  items: GA4Item[];
}) {
  const sent = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (sent.current || items.length === 0 || !container) return;
    const sendImpression = () => {
      if (sent.current) return;
      sent.current = true;
      trackViewItemList({
        currency,
        items,
        item_list_id: promotionId,
        item_list_name: promotionName,
      });
      trackViewPromotion({
        currency,
        items,
        promotion_id: promotionId,
        promotion_name: promotionName,
      });
    };
    if (!("IntersectionObserver" in window)) {
      sendImpression();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        sendImpression();
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(container);
    return () => observer.disconnect();
  }, [currency, items, promotionId, promotionName]);

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>("a[href*='/ecommerce/products/']");
    if (!link) return;

    const productId = link.pathname.split("/").filter(Boolean).at(-1);
    const item = items.find((entry) => entry.item_id === productId);
    if (!item) return;
    trackSelectItem({
      currency,
      items: [{ ...item, quantity: 1 }],
      item_list_id: promotionId,
      item_list_name: promotionName,
    });
    trackSelectPromotion({
      currency,
      items: [{ ...item, quantity: 1 }],
      promotion_id: promotionId,
      promotion_name: promotionName,
    });
  }

  return <div ref={containerRef} onClickCapture={handleClickCapture}>{children}</div>;
}
