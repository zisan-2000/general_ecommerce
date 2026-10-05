"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import type { GA4Item } from "@/lib/analytics/ecommerce";
import {
  trackSelectItem,
  trackViewItemList,
} from "@/lib/analytics/data-layer";

export default function ProductListTracker({
  children,
  listId,
  listName,
  currency,
  items,
}: {
  children: ReactNode;
  listId: string;
  listName: string;
  currency: string;
  items: GA4Item[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackedList = useRef("");
  const listKey = `${listId}:${listName}:${items.map((item) => item.item_id).join(",")}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || items.length === 0 || trackedList.current === listKey) return;
    const sendImpression = () => {
      if (trackedList.current === listKey) return;
      trackedList.current = listKey;
      trackViewItemList({
        currency,
        items,
        item_list_id: listId,
        item_list_name: listName,
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
    }, { threshold: 0.1 });
    observer.observe(container);
    return () => observer.disconnect();
  }, [currency, items, listId, listKey, listName]);

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>("a[href*='/ecommerce/products/']");
    if (!link) return;
    const productId =
      link.dataset.analyticsItemId ??
      link.pathname.split("/").filter(Boolean).at(-1);
    const item = items.find((entry) => entry.item_id === productId);
    if (!item) return;
    trackSelectItem({
      currency,
      items: [{ ...item, quantity: 1 }],
      item_list_id: listId,
      item_list_name: listName,
    });
  }

  return <div ref={containerRef} onClickCapture={handleClickCapture}>{children}</div>;
}
