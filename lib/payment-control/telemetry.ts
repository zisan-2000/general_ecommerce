import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type PaymentProvider = "EPS" | "SSLCOMMERZ" | "AIBL_WALLET";
export type PaymentOperation = "AUTH" | "INITIALIZE" | "STATUS_QUERY" | "VERIFY" | "CALLBACK" | "SETTLEMENT" | "REFUND";
export type PaymentOutcome = "REQUEST_STARTED" | "HTTP_SUCCESS" | "HTTP_ERROR" | "TIMEOUT" | "CONNECTION_ERROR" |
  "RECEIVED" | "REJECTED" | "SUCCESS" | "PENDING" | "FAILED" | "CANCELLED" | "DUPLICATE" | "MISMATCH" | "ERROR";
export type PaymentLogContext = {
  provider: PaymentProvider; paymentId?: number; orderId?: number; transactionId?: string; actorUserId?: string;
};
type PaymentEventInput = PaymentLogContext & {
  requestId?: string;
  networkAgentId?: string;
  requestStartedAt?: Date;
  requestCompletedAt?: Date;
  operation: PaymentOperation; outcome: PaymentOutcome; httpStatus?: number; durationMs?: number;
  gatewayStatus?: unknown; detailCode?: "INVALID_RESPONSE" | "INVALID_CALLBACK" | "CALLBACK_REFERENCE_MISMATCH" |
    "VERIFICATION_MISMATCH" | "SETTLEMENT_REJECTED" | "INITIALIZE_REJECTED" | "REFUND_RECORDED" |
    "STATUS_CHECK_FAILED" | "ACCOUNT_CONFIGURATION_MISMATCH" | "RISK_REVIEW" | "INVALID_REFERENCE" |
    "AUTHENTICATION_REJECTED" | "CALLBACK_SUCCESS" | "CALLBACK_FAIL" | "CALLBACK_CANCEL" | "CALLBACK_IPN" | NetworkErrorCode;
};
type NetworkErrorCode = "ECONNRESET" | "ECONNREFUSED" | "ETIMEDOUT" | "ENOTFOUND" | "EAI_AGAIN" |
  "ERR_SSL_PACKET_LENGTH_TOO_LONG" | "CERT_HAS_EXPIRED" | "UNABLE_TO_VERIFY_LEAF_SIGNATURE" | "DEPTH_ZERO_SELF_SIGNED_CERT";
const networkCodes = new Set<NetworkErrorCode>(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN",
  "ERR_SSL_PACKET_LENGTH_TOO_LONG", "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "DEPTH_ZERO_SELF_SIGNED_CERT"]);
function safeNetworkCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const source = error as { code?: unknown; cause?: { code?: unknown } };
  const code = source.cause?.code ?? source.code;
  return typeof code === "string" && networkCodes.has(code as NetworkErrorCode) ? code as NetworkErrorCode : undefined;
}

const gatewayStatuses = new Set([
  "Success", "VALID", "VALIDATED", "FAILED", "CANCELLED", "UNATTEMPTED", "EXPIRED",
  "PENDING", "processing", "refunded", "cancelled",
]);
export function safeGatewayStatus(value: unknown) {
  // Never echo an arbitrary gateway value: it could contain customer data or secrets.
  return typeof value === "string" && gatewayStatuses.has(value) ? value : "UNKNOWN";
}

export async function recordPaymentEvent(event: PaymentEventInput) {
  if (process.env.PAYMENT_CONTROL_LOGGING_ENABLED === "false") return;
  try {
    const transactionId = event.transactionId && /^[A-Za-z0-9_-]{1,50}$/.test(event.transactionId)
      ? event.transactionId : null;
    const payment = event.paymentId ? null : transactionId
      ? await prisma.payment.findUnique({ where: { externalId: transactionId }, select: { id: true, orderId: true, provider: true } })
      : null;
    const matched = payment?.provider === event.provider ? payment : null;
    // Explicit field projection. No URLs, headers, body, error.message/stack or payload spreads.
    await prisma.paymentEvent.create({ data: {
      provider: event.provider, operation: event.operation, outcome: event.outcome,
      requestId: event.requestId,
      networkAgentId: event.networkAgentId,
      requestStartedAt: event.requestStartedAt, requestCompletedAt: event.requestCompletedAt,
      paymentId: event.paymentId ?? matched?.id ?? null, orderId: event.orderId ?? matched?.orderId ?? null,
      transactionId, actorUserId: event.actorUserId ?? null,
      httpStatus: event.httpStatus, durationMs: event.durationMs === undefined ? undefined
        : Math.min(2147483647, Math.max(0, Math.round(event.durationMs))),
      gatewayStatus: event.gatewayStatus === undefined ? undefined : safeGatewayStatus(event.gatewayStatus),
      detailCode: event.detailCode,
    } });
  } catch {
    // Diagnostics must never turn a successful charge into a failed checkout.
    // A missing migration/client is visible here without printing DB/credential details.
    console.warn("Payment telemetry persistence unavailable");
  }
}

export async function paymentFetch(context: PaymentLogContext, operation: "AUTH" | "INITIALIZE" | "STATUS_QUERY" | "VERIFY",
  input: string | URL, init: Omit<RequestInit, "signal"> & { timeoutMs: number }) {
  const requestId = randomUUID();
  const configuredAgent = process.env.PAYMENT_NETWORK_AGENT_ID;
  const networkAgentId = configuredAgent && /^[A-Za-z0-9_-]{1,64}$/.test(configuredAgent) ? configuredAgent : undefined;
  const { timeoutMs, ...options } = init;
  await recordPaymentEvent({ ...context, requestId, networkAgentId, requestStartedAt: new Date(), operation, outcome: "REQUEST_STARTED" });
  const requestStartedAt = new Date();
  const started = performance.now();
  try {
    // The network deadline starts at fetch, after the diagnostic insert.
    const response = await fetch(input, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    await recordPaymentEvent({ ...context, requestId, networkAgentId, requestStartedAt, requestCompletedAt: new Date(), operation, outcome: response.ok ? "HTTP_SUCCESS" : "HTTP_ERROR",
      httpStatus: response.status, durationMs: performance.now() - started });
    return response;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const code = safeNetworkCode(error);
    await recordPaymentEvent({ ...context, requestId, networkAgentId, requestStartedAt, requestCompletedAt: new Date(), operation, detailCode: code,
      outcome: name === "TimeoutError" || name === "AbortError" || code === "ETIMEDOUT" ? "TIMEOUT" : "CONNECTION_ERROR",
      durationMs: performance.now() - started });
    throw error;
  }
}
