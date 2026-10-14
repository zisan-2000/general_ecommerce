import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { epsObject } from "@/lib/eps-settings";
import { PaymentControlError } from "./authorization";
import { paymentFetch } from "./telemetry";

export function paymentAmountMatches(value: unknown, expected: Prisma.Decimal | null) {
  if (expected === null || !["string", "number"].includes(typeof value) ||
      !/^\d{1,12}(\.\d{1,2})?$/.test(String(value))) return false;
  try { return expected.equals(new Prisma.Decimal(String(value))); } catch { return false; }
}

type QueryPayment = { id: number; orderId: number | null; externalId: string | null; currency: string;
  amount: Prisma.Decimal | null; paymentGatewayData: unknown };

export async function querySslcommerzPayment(payment: QueryPayment, actorUserId?: string) {
  if (!payment.orderId || !payment.externalId) throw new PaymentControlError("Payment reference is missing", 409);
  const meta = epsObject(payment.paymentGatewayData);
  const gatewayId = Number(meta.gatewayId);
  if (!Number.isSafeInteger(gatewayId) || gatewayId <= 0) throw new PaymentControlError("Original gateway is missing", 409);
  const gateway = await prisma.payment.findFirst({ where: { id: gatewayId, orderId: null }, select: { paymentGatewayData: true } });
  const settings = epsObject(gateway?.paymentGatewayData);
  if (settings.type !== "SSLCOMMERZ" || typeof settings.storeId !== "string" || !settings.storeId ||
      typeof settings.storePassword !== "string" || !settings.storePassword) {
    throw new PaymentControlError("Original SSLCommerz gateway is not configured", 409);
  }
  // Official V4 transaction query. Never send bank_tran_id/refund_amount/refund parameters.
  const sandbox = typeof meta.sandbox === "boolean" ? meta.sandbox : Boolean(settings.sandbox);
  const endpoint = new URL("/validator/api/merchantTransIDvalidationAPI.php",
    sandbox ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com");
  endpoint.searchParams.set("tran_id", payment.externalId);
  endpoint.searchParams.set("store_id", settings.storeId);
  endpoint.searchParams.set("store_passwd", settings.storePassword);
  endpoint.searchParams.set("v", "1");
  endpoint.searchParams.set("format", "json");
  const response = await paymentFetch({ provider: "SSLCOMMERZ", paymentId: payment.id,
    orderId: payment.orderId, transactionId: payment.externalId, actorUserId }, "STATUS_QUERY", endpoint, {
    method: "GET", cache: "no-store", redirect: "error", timeoutMs: 30_000,
  });
  if (!response.ok) throw new PaymentControlError("Gateway status check failed", 502);
  const payload = epsObject(await response.json());
  if (payload.APIConnect !== "DONE" || !Array.isArray(payload.element)) throw new PaymentControlError("Invalid gateway status response", 502);
  const entries = payload.element.map(epsObject).filter((entry) => entry.tran_id === payment.externalId);
  if (entries.length !== 1) return { status: "UNKNOWN", referenceMatches: false, amountMatches: null };
  const entry = entries[0];
  return {
    status: typeof entry.status === "string" ? entry.status : "UNKNOWN",
    referenceMatches: entry.tran_id === payment.externalId && (!entry.value_a || Number(entry.value_a) === payment.orderId) &&
      (!entry.value_b || Number(entry.value_b) === gatewayId),
    amountMatches: paymentAmountMatches(entry.amount, payment.amount) && entry.currency === payment.currency,
  };
}
