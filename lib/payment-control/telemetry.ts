import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type PaymentProvider = "EPS" | "SSLCOMMERZ" | "AIBL_WALLET";
export type PaymentOperation = "AUTH" | "INITIALIZE" | "STATUS_QUERY" | "VERIFY" | "CALLBACK" | "SETTLEMENT" | "REFUND" | "DIAGNOSTIC";
export type PaymentOutcome = "REQUEST_STARTED" | "HTTP_SUCCESS" | "HTTP_ERROR" | "TIMEOUT" | "CONNECTION_ERROR" |
  "RECEIVED" | "REJECTED" | "SUCCESS" | "PENDING" | "FAILED" | "CANCELLED" | "DUPLICATE" | "MISMATCH" | "ERROR";
export type PaymentLogContext = {
  provider: PaymentProvider; paymentId?: number; orderId?: number; transactionId?: string; actorUserId?: string; requestId?: string;
};
// Fixed AIBL diagnostics only; never put runtime values in these codes.
export type AiblDiagnosticStage = "PRE_VERIFY_VALIDATION_FAILED" | "BANK_VERIFY_REQUEST_FAILED" |
  "BANK_VERIFY_RESPONSE_REJECTED" | "SETTLEMENT_VALIDATION_FAILED" | "DATABASE_SETTLEMENT_FAILED";
export type AiblCallbackDiagnosticCode = `AIBL_CB_${
  "BODY_MISSING" | "BODY_READ_FAILED" | "BODY_TOO_LARGE" | "BODY_DECODE_FAILED" |
  "BODY_JSON_INVALID" | "BODY_JSON_NOT_OBJECT" | "FORM_MALFORMED" | "FORM_DUPLICATE_FIELD" |
  "FORM_FILE_REJECTED" | "CONTENT_UNSUPPORTED" | "OUTER_BODY_PARSED" | "DATA_MISSING" |
  "DATA_PRESENT" | "ENVELOPE_CONTENT_INVALID" | "OUTER_FIELDS_UNEXPECTED" | "DATA_TYPE_INVALID" |
  "DATA_JSON_INVALID" | "DATA_JSON_NOT_OBJECT" | "DATA_RECURSIVE" | "DATA_NESTED_VALUE" |
  "DATA_JSON_DUPLICATE_KEY" | "DATA_JSON_PARSED" | "RATE_LIMIT_FAILED" | "RATE_LIMIT_REJECTED" |
  "STATE_CHECK_FAILED" | "STATE_INVALID" | "PAYMENT_LOOKUP_FAILED" | "PAYMENT_NOT_FOUND" |
  "BODY_PARSE_FAILED" | "FIELD_VALIDATION_FAILED" | "TRANSNO_INVALID" |
  "AUX_WITHOUT_DATA" | "AUX_TYPE_INVALID" | "OUTER_AUX_IGNORED" | "BODY_JSON_DUPLICATE_KEY" |
  "VERIFY_FAILED" | "RESULT_FAILED"}` |
  `AIBL_CB_OUTER_${"EXTRA" | "UNKNOWN"}_COUNT_${"0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "GT10"}` |
  `AIBL_CB_OUTER_FIELD_${"RESCODE" | "STATUS" | "AMOUNT" | "MESSAGE" | "SESSIONKEY" | "TRANSNO" | "BILLNO"}`;
export type AiblDiagnosticCode = AiblDiagnosticStage | AiblCallbackDiagnosticCode |
  `AIBL_${"CONFIG_UAT" | "CONFIG_API_URL" | "CONFIG_HOSTED_URL" | "CONFIG_CREDENTIALS_PRESENT" |
    "ORDER_ID" | "MERCHANT_BILL_FORMAT" | "BANK_ORDER_ID" | "AMOUNT_DECIMAL_INSTANCE" |
    "AMOUNT_DECIMAL_RECOGNIZED" | "AMOUNT_STRING_VALID" | "AMOUNT_VALID" | "AMOUNT_NONZERO" |
    "CURRENCY_BDT" | "ACCOUNT_FINGERPRINT_MATCH" | "INITIALIZATION_VALIDATED" |
    "ORDER_EXISTS" | "ORDER_GATEWAY_MATCH" | "ORDER_CURRENCY_BDT" | "ORDER_TOTAL_MATCH" |
    "BANK_SUCCESS_CONFIRMED" | "SETTLEMENT_DATABASE_READ" | "SETTLEMENT_ATTEMPT" |
    "SETTLEMENT_CAPTURE_STATE" | "SETTLEMENT_ORDER_STATE" | "SETTLEMENT_OTHER_PAYMENT" |
    "SETTLEMENT_OTHER_TRANSACTION" | "SETTLEMENT_INVENTORY_SNAPSHOT" | "SETTLEMENT_CALLBACK_REFERENCE" |
    "SETTLEMENT_WRITE" | "SETTLEMENT_INVENTORY_COMMIT" | "SETTLEMENT_ORDER_LIFECYCLE" |
    "SETTLEMENT_NOTIFICATIONS"}` |
  `AIBL_CB_CONTENT_${"FORM_URLENCODED" | "MULTIPART" | "JSON" | "OTHER" | "MISSING"}` |
  `AIBL_CB_${"BILLNO_PRESENT" | "AMOUNT_PRESENT" | "ALT_BILL_CAMEL" | "ALT_BILL_LOWER" |
    "ALT_BILL_SNAKE" | "ALT_BILL_PASCAL" | "ALT_AMOUNT_LOWER" | "ALT_AMOUNT_PASCAL"}` |
  `AIBL_CB_${"BILLNO" | "AMOUNT"}_TYPE_${"STRING" | "NUMBER" | "NULL" | "MISSING" | "OTHER"}`;
type PaymentEventInput = PaymentLogContext & {
  requestId?: string;
  networkAgentId?: string;
  requestStartedAt?: Date;
  requestCompletedAt?: Date;
  operation: PaymentOperation; outcome: PaymentOutcome; httpStatus?: number; durationMs?: number;
  gatewayStatus?: unknown; detailCode?: "INVALID_RESPONSE" | "INVALID_CALLBACK" | "CALLBACK_REFERENCE_MISMATCH" |
    "BILLNO_MISMATCH" | "AMOUNT_MISSING" | "AMOUNT_INVALID" | "AMOUNT_MISMATCH" |
    "VERIFICATION_MISMATCH" | "SETTLEMENT_REJECTED" | "INITIALIZE_REJECTED" | "REFUND_RECORDED" |
    "STATUS_CHECK_FAILED" | "ACCOUNT_CONFIGURATION_MISMATCH" | "RISK_REVIEW" | "INVALID_REFERENCE" |
    "AUTHENTICATION_REJECTED" | "CALLBACK_SUCCESS" | "CALLBACK_FAIL" | "CALLBACK_CANCEL" | "CALLBACK_IPN" | NetworkErrorCode | AiblDiagnosticCode;
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
      // AIBL diagnostics correlate through internal IDs; never persist full references.
      transactionId: event.provider === "AIBL_WALLET" ? null : transactionId, actorUserId: event.actorUserId ?? null,
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
  // AIBL verification shares one server-generated ID with guards and settlement.
  const requestId = context.provider === "AIBL_WALLET" && context.requestId ? context.requestId : randomUUID();
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
