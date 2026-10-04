"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export const ADMIN_NOTIFICATIONS_CHANGED = "admin-notifications-changed";
export type OrderNotification = {
  id: number;
  orderId: number;
  stage: string;
  title: string;
  message: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};
type OrderNotifications = {
  unreadCount: number;
  newOrderCount: number;
  newOrderIds: number[];
  rows: OrderNotification[];
};

export function useOrderNotifications(acknowledgeOnVisit = false) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const user = session?.user as { id?: string; globalPermissions?: string[] } | undefined;
  const enabled = user?.globalPermissions?.includes("orders.read_all") ?? false;
  const userId = user?.id;
  const [data, setData] = useState<OrderNotifications | null>(null);
  const [error, setError] = useState<string | null>(null);
  const acknowledge = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    const response = await fetch("/api/admin/order-notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seen_orders", ids }),
    });
    if (!response.ok) throw new Error("Failed to acknowledge new orders.");
    window.dispatchEvent(new Event(ADMIN_NOTIFICATIONS_CHANGED));
  }, []);
  useEffect(() => {
    if (!enabled) { setData(null); return; }
    let active = true;
    let loading = false;
    let acknowledgeVisit = acknowledgeOnVisit && pathname === "/admin/operations/orders";
    const controller = new AbortController();
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch("/api/admin/order-notifications?limit=50", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Failed to load order notifications.");
        const payload: OrderNotifications = await response.json();
        if (!active) return;
        if (acknowledgeVisit) {
          await acknowledge(payload.newOrderIds);
          acknowledgeVisit = false;
          payload.newOrderCount = 0;
          payload.newOrderIds = [];
        }
        if (active) { setData(payload); setError(null); }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load order notifications.");
      } finally { loading = false; }
    };
    void load();
    const refresh = () => { void load(); };
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener(ADMIN_NOTIFICATIONS_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false; controller.abort(); window.clearInterval(interval);
      window.removeEventListener(ADMIN_NOTIFICATIONS_CHANGED, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [enabled, userId, pathname, acknowledgeOnVisit, acknowledge]);
  const acknowledgeOrders = useCallback(() => {
    void acknowledge(data?.newOrderIds ?? []).catch((err: Error) => setError(err.message));
  }, [acknowledge, data]);
  return { data, error, acknowledgeOrders };
}
