"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useCart } from "@/components/ecommarce/CartContext";
import {
  PC_BUILDER_EXTRA_ITEMS_STORAGE_KEY,
  PC_BUILDER_STORAGE_KEY,
} from "@/lib/pc-builder";
import { trackPurchase } from "@/lib/analytics/data-layer";
import type { EcommercePayload } from "@/lib/analytics/ecommerce";

function clearCompletedPcBuilderDraft() {
  try {
    localStorage.removeItem(PC_BUILDER_STORAGE_KEY);
    localStorage.removeItem(PC_BUILDER_EXTRA_ITEMS_STORAGE_KEY);
  } catch {
    // A verified payment remains successful when browser storage is unavailable.
  }
}

export default function PaymentResultClient({ success, paymentId, orderId, provider, purchase }: {
  success: boolean; paymentId: number | null; orderId: number | null; provider: string | null; purchase: EcommercePayload | null;
}) {
  const { clearCart } = useCart();
  const { data: session, status: sessionStatus } = useSession();
  const handled = useRef(false);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!success || !paymentId) return;
    if (purchase) trackPurchase(purchase); // Analytics consent and transaction dedupe remain in trackPurchase.
    if (sessionStatus === "loading") return;
    if (handled.current) return;
    handled.current = true;
    const key = `payment_cart_cleared_${paymentId}`;
    try { if (localStorage.getItem(key)) return; } catch { /* In-memory fallback. */ }
    clearCompletedPcBuilderDraft();
    clearCart();
    if (session?.user) {
      fetch("/api/cart", { method: "DELETE" })
        .then(() => window.dispatchEvent(new Event("serverCartCleared")))
        .catch(() => undefined);
    }
    try { localStorage.setItem(key, "1"); } catch { /* Browser storage is optional. */ }
  }, [clearCart, session?.user, sessionStatus, success, paymentId, purchase]);

  async function verify() {
    if (busy || !orderId) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/aibl-wallet/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
      const value = await response.json();
      if (!response.ok) { setNotice(value.error || "Payment verification unavailable"); return; }
      if (value.status === "success") { window.location.reload(); return; }
      setNotice(value.message || "Payment remains pending. Inventory is reserved.");
    } catch { setNotice("Payment could not be confirmed. Please check again later."); }
    finally { setBusy(false); }
  }
  return !success && provider === "AIBL_WALLET" ? <div className="mt-4 space-y-2">
    <button className="rounded border px-3 py-2 disabled:opacity-50" onClick={verify} disabled={busy}>Verify pending payment</button>
    {notice && <p role="status" className="text-sm">{notice}</p>}
  </div> : null;
}
