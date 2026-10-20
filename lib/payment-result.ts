import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { purchaseFromOrder } from "@/lib/analytics/ecommerce";

const name = "payment_result_receipt";
const path = "/ecommerce/payment-result";
function sign(payload: string) {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("Payment result signing is not configured");
  return createHmac("sha256", secret).update("payment-result:" + payload).digest("base64url");
}
export async function attachPaymentResult<T extends NextResponse>(response: T, externalId?: string, provider?: string): Promise<T> {
  // A read-only, short-lived receipt. Never grants initialization/refund/order access.
  // Only trusted server callback/status handlers may issue it.
  const secure = provider !== "SSLCOMMERZ" || process.env.NODE_ENV === "production" ||
    !response.headers.get("location")?.startsWith("http://");
  try {
    const payment = externalId ? await prisma.payment.findUnique({ where: { externalId }, select: { id: true, provider: true, orderId: true } }) : null;
    if (!payment?.orderId || payment.provider !== provider) throw new Error();
    const payload = `${payment.id}.${Date.now() + 30 * 60000}`;
    response.cookies.set(name, `${payload}.${sign(payload)}`, { httpOnly: true, secure, sameSite: "lax", path, maxAge: 1800 });
  } catch { response.cookies.set(name, "", { httpOnly: true, secure, sameSite: "lax", path, maxAge: 0 }); }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export async function readPaymentResult() {
  const unknown = { success: false, status: "pending", orderId: null, paymentId: null, provider: null, purchase: null } as const;
  // Keep Next's request-time API outside the recovery catch so prerender bailouts
  // are not swallowed and a cached "pending" page cannot replace live DB state.
  const raw = (await cookies()).get(name)?.value || "";
  try {
    if (!/^\d{1,12}\.\d{13}\.[A-Za-z0-9_-]{43}$/.test(raw)) return unknown;
    const [id, expires, signature] = raw.split(".");
    if (Number(expires) <= Date.now() || Number(expires) > Date.now() + 31 * 60000) return unknown;
    const expected = Buffer.from(sign(`${id}.${expires}`)); const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return unknown;
    const payment = await prisma.payment.findUnique({ where: { id: Number(id) }, select: {
      id: true, provider: true, status: true, orderId: true, currency: true, amount: true,
      order: { select: { id: true, paymentStatus: true, currency: true, grand_total: true, total: true, discount_total: true,
        Vat_total: true, shipping_cost: true, orderItems: { select: { productId: true, variantId: true, quantity: true,
          price: true, currency: true, product: { select: { id: true, name: true } } } } } },
    } });
    if (!payment?.order || !["EPS", "SSLCOMMERZ", "AIBL_WALLET"].includes(payment.provider || "")) return unknown;
    const success = payment.status === "CAPTURED" && payment.order.paymentStatus === "PAID" &&
      payment.currency === payment.order.currency && payment.amount?.equals(payment.order.grand_total) === true;
    return { success, status: success ? "success" : payment.status === "VOIDED" ? "cancelled" : payment.status === "FAILED" ? "failed" : "pending",
      orderId: payment.orderId, paymentId: payment.id, provider: payment.provider,
      purchase: success ? purchaseFromOrder(payment.order, payment.currency) : null };
  } catch { return unknown; }
}
