// Client-side editor policy only. Server authorization, verified settlement and
// inventory/status-transition rules remain authoritative.
type PaymentOrder = {
  payment_method: string;
  status: string;
  paymentStatus: string;
  transactionId?: string | null;
};

export function adminOrderGateway(order: Pick<PaymentOrder, "payment_method">) {
  if (order.payment_method.startsWith("EPS:")) return "EPS";
  if (order.payment_method.startsWith("AIBL_WALLET:")) return "AIBL_WALLET";
  return null;
}

export function gatewayConfirmationBlocked(order: PaymentOrder, nextStatus: string) {
  return !!adminOrderGateway(order) && order.status === "PENDING" && nextStatus === "CONFIRMED" && order.paymentStatus !== "PAID";
}

export class AdminOrderEditError extends Error {
  constructor() { super("PAYMENT_VERIFICATION_REQUIRED"); }
}

export function buildAdminOrderPatch<S extends string, P extends string>(
  order: PaymentOrder & { status: S; paymentStatus: P },
  edited: { status: S; paymentStatus: P; transactionId: string },
) {
  if (gatewayConfirmationBlocked(order, edited.status)) throw new AdminOrderEditError();
  const patch: { status?: S; paymentStatus?: P; transactionId?: string | null } = {};
  if (edited.status !== order.status) patch.status = edited.status;
  if (!adminOrderGateway(order)) {
    if (edited.paymentStatus !== order.paymentStatus) patch.paymentStatus = edited.paymentStatus;
    if ((edited.transactionId || null) !== (order.transactionId || null)) patch.transactionId = edited.transactionId || null;
  }
  return Object.keys(patch).length ? patch : null;
}

export function shipmentOrderStatusUpdate(previousStatus: string | undefined, nextStatus: string, orderStatus: string) {
  if (nextStatus === (previousStatus ?? "PENDING")) return null;
  const status = nextStatus === "DELIVERED" ? "DELIVERED" : nextStatus === "RETURNED" ? "RETURNED"
    : nextStatus === "FAILED" ? "FAILED" : nextStatus === "CANCELLED" ? "CANCELLED" : null;
  return status !== orderStatus ? status : null;
}

export async function verifyAdminOrderPayment<T extends PaymentOrder & { id: number }>(order: T, fetcher: typeof fetch = fetch) {
  const gateway = adminOrderGateway(order);
  if (!gateway) throw new Error("This order does not use EPS or AIBL Wallet");
  const response = await fetcher(gateway === "EPS" ? "/api/eps/status" : "/api/aibl-wallet/status", {
    method: "POST", cache: "no-store", credentials: "same-origin",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "Payment verification failed");
  if (!result || !["success", "pending", "failed", "cancelled"].includes(result.status)) throw new Error("Invalid payment verification response");
  const refreshed = await fetcher(`/api/orders/${order.id}`, { cache: "no-store", credentials: "same-origin" });
  if (!refreshed.ok) throw new Error("Verification completed but order refresh failed. Reload order details before confirming.");
  const updated: T = await refreshed.json();
  if (!updated || updated.id !== order.id || adminOrderGateway(updated) !== gateway ||
    !["PAID", "UNPAID", "REFUNDED"].includes(updated.paymentStatus)) throw new Error("Invalid refreshed order");
  return { order: updated, status: result.status as "success" | "pending" | "failed" | "cancelled" };
}
