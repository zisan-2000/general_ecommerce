import type { TransportAttemptEvidence } from "./transport-types";
export type CheckStatus = "PASS" | "FAIL" | "WARNING" | "UNKNOWN" | "NOT_OBSERVED";
export type Confidence = "CONFIRMED" | "PROBABLE" | "UNKNOWN";
export type DiagnosticCheck = { code: string; status: CheckStatus; evidence: string[]; explanation: string };
export type DiagnosticFinding = { category: string; confidence: Confidence; severity: "HIGH" | "MEDIUM" | "LOW";
  evidence: string[]; explanation: string; component: string; merchantCheck: CheckStatus;
  recommendedAction: string; bankConfirmationRequired: boolean };
export type InvestigationEvent = { id: string; requestId: string | null; operation: string; outcome: string;
  detailCode: string | null; httpStatus: number | null; durationMs: number | null; gatewayStatus: string | null;
  createdAt: string; paymentId: number | null; source: "SERVER" | "CLIENT_REPORTED"; gatewayStage?: string };
const networkCategories: Record<string, string> = {
  ENOTFOUND: "DNS_FAILURE", EAI_AGAIN: "DNS_FAILURE", ECONNREFUSED: "TCP_CONNECTION_FAILURE",
  ENETUNREACH: "TCP_CONNECTION_FAILURE", EHOSTUNREACH: "TCP_CONNECTION_FAILURE", UND_ERR_CONNECT_TIMEOUT: "TCP_CONNECTION_FAILURE",
  ECONNRESET: "TCP_RESET", CERT_HAS_EXPIRED: "TLS_CERTIFICATE_ERROR", ERR_TLS_CERT_ALTNAME_INVALID: "TLS_CERTIFICATE_ERROR",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "TLS_CERTIFICATE_ERROR", DEPTH_ZERO_SELF_SIGNED_CERT: "TLS_CERTIFICATE_ERROR",
  SELF_SIGNED_CERT_IN_CHAIN: "TLS_CERTIFICATE_ERROR", UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "TLS_CERTIFICATE_ERROR",
  ERR_TLS_HANDSHAKE_TIMEOUT: "TLS_HANDSHAKE_FAILURE", ERR_SSL_WRONG_VERSION_NUMBER: "TLS_HANDSHAKE_FAILURE",
  ERR_SSL_PACKET_LENGTH_TOO_LONG: "TLS_HANDSHAKE_FAILURE",
};
export function investigatePayment(input: { events: InvestigationEvent[]; checks: DiagnosticCheck[];
  transports: TransportAttemptEvidence[]; pending: boolean; ageMs: number; limited: boolean;
  captures?: Array<{ id: string; resets: number; retransmissions: number }> }) {
  const findings: DiagnosticFinding[] = [];
  const add = (category: string, confidence: Confidence, evidence: string[], explanation: string,
    component: string, recommendedAction: string, severity: DiagnosticFinding["severity"] = "MEDIUM", bank = false) => {
    findings.push({ category, confidence, severity, evidence, explanation, component,
      merchantCheck: component === "READ_ONLY_CONSISTENCY" && confidence === "CONFIRMED" ? "FAIL" : "UNKNOWN", recommendedAction, bankConfirmationRequired: bank });
  };
  for (const event of input.events) {
    if (event.source === "CLIENT_REPORTED") {
      if (["FRONTEND_API_FAILED", "FRONTEND_NETWORK_INTERRUPTED", "FRONTEND_REDIRECT_FAILED"].includes(event.detailCode ?? ""))
        add("FRONTEND_ERROR", "PROBABLE", [event.id], "Browser reported an unsuccessful checkout step; report is not server-verified.",
          "STOREFRONT", "Compare server timeline and browser developer tools; never retry an uncertain charge automatically.");
      continue;
    }
    const category = networkCategories[event.detailCode ?? ""];
    if (category) add(category, "CONFIRMED", [event.id], "Allowlisted runtime error confirms this observed failure, not its remote root cause.",
      "MERCHANT_TO_GATEWAY_TRANSPORT", "Check merchant resolver, egress, proxy, certificate chain and gateway incident logs.");
    else if (event.outcome === "TIMEOUT") add("HTTP_TIMEOUT", "CONFIRMED", [event.id],
      "A request or body deadline expired. The gateway may still have processed the request.", "GATEWAY_HTTP",
      "Use existing authorized verification/reconciliation; compare merchant egress and bank UTC logs.", "MEDIUM", true);
    else if (event.outcome === "CONNECTION_ERROR") add("TCP_CONNECTION_FAILURE", "PROBABLE", [event.id],
      "Transport request failed without an observed lower-level cause.", "GATEWAY_HTTP", "Inspect socket-correlated evidence and merchant network.");
    if (event.outcome === "HTTP_ERROR") add("HTTP_ERROR", "CONFIRMED", [event.id],
      `Gateway HTTP response status was ${event.httpStatus ?? "unrecorded"}; this is separate from business status.`, "GATEWAY_HTTP",
      "Check provider request contract, credentials and bank logs; exclude proxy responses before assigning responsibility.", "MEDIUM", true);
    if (event.detailCode === "INVALID_RESPONSE") add("INVALID_GATEWAY_RESPONSE", "CONFIRMED", [event.id],
      "Provider adapter rejected the response format.", "GATEWAY_ADAPTER", "Compare the issued provider contract and bank-side request logs.", "HIGH", true);
    if (["AMOUNT_MISMATCH", "AMOUNT_INVALID", "AMOUNT_MISSING", "AIBL_SETTLEMENT_INVENTORY_SNAPSHOT"].includes(event.detailCode ?? "") &&
        ["MISMATCH", "REJECTED", "ERROR"].includes(event.outcome)) add(event.detailCode === "AIBL_SETTLEMENT_INVENTORY_SNAPSHOT" ? "INVENTORY_INCONSISTENCY" : "PAYMENT_AMOUNT_MISMATCH",
      "CONFIRMED", [event.id], "An existing settlement guard rejected inconsistent evidence.", "PAYMENT_VERIFICATION",
      "Review authoritative order and original provider response through the existing support workflow.", "HIGH");
    if (event.operation === "CALLBACK" && ["REJECTED", "MISMATCH"].includes(event.outcome)) add("CALLBACK_INVALID", "CONFIRMED", [event.id],
      "Callback was rejected by existing validation. This does not authenticate the sender or prove a malicious replay.", "CALLBACK_HANDLER",
      "Compare signed correlation, documented callback fields and server verification.");
    if (event.detailCode === "DATABASE_SETTLEMENT_FAILED") add("DATABASE_ERROR", "PROBABLE", [event.id],
      "The settlement stage failed; the safe event does not establish the database's underlying cause.", "SETTLEMENT",
      "Inspect restricted database and transaction logs; verify current financial state before correction.", "HIGH");
    if (["VERIFY", "STATUS_QUERY"].includes(event.operation) && ["ERROR", "REJECTED", "MISMATCH"].includes(event.outcome))
      add("PAYMENT_VERIFICATION_FAILED", "CONFIRMED", [event.id], "Server verification did not complete successfully.", "VERIFICATION",
        "Keep uncertain payment pending and use existing authorized reconciliation.", "HIGH", true);
    if (["AUTH", "INITIALIZE"].includes(event.operation) && event.outcome === "REJECTED") add("GATEWAY_ERROR", "CONFIRMED", [event.id],
      "Provider adapter rejected authentication or initialization business result; HTTP status may have been successful.", "GATEWAY_ADAPTER",
      "Review provider-specific contract and safe rejection code with bank support.", "MEDIUM", true);
  }
  for (const t of input.transports) {
    const category = networkCategories[t.errorCode ?? ""];
    if (category) add(category, "CONFIRMED", [t.attemptId], "Recorded transport error; socket attribution and stage visibility remain in the evidence.",
      "TRANSPORT", "Inspect the linked request and measured connection; do not infer bank internal fault.");
  }
  const callbacks = input.events.filter(e => e.source === "SERVER" && e.operation === "CALLBACK" && e.outcome === "RECEIVED");
  for (const capture of input.captures ?? []) {
    if (capture.resets > 0) add("TCP_RESET", "PROBABLE", [capture.id],
      "TCP reset packets were observed in the approved gateway capture window; this does not establish which payment used the connection.",
      "CAPTURE_WINDOW", "Compare exact socket/stream evidence and merchant egress before attributing this payment failure.");
    if (capture.retransmissions > 0) add("TCP_RETRANSMISSION", "PROBABLE", [capture.id],
      "TShark identified retransmission observations in the capture window. Sampling, reordering and capture loss may affect interpretation.",
      "CAPTURE_WINDOW", "Inspect the header-only PCAPNG with a network engineer; do not infer packet-loss percentage or bank fault.");
  }
  if (callbacks.length > 1) add("CALLBACK_DUPLICATED", "CONFIRMED", callbacks.map(e => e.id),
    "Multiple callback receipts were recorded. Repeated receipts are not proof of duplicate capture or an attack.", "CALLBACK_HANDLER",
    "Confirm idempotent settlement and correlate delivery IDs with bank support.", "LOW");
  const initialized = input.events.find(e => e.source === "SERVER" && e.operation === "INITIALIZE" && e.outcome === "SUCCESS");
  if (initialized && callbacks[0] && Date.parse(callbacks[0].createdAt) - Date.parse(initialized.createdAt) > 900000)
    add("CALLBACK_DELAYED", "PROBABLE", [initialized.id, callbacks[0].id],
      "The first retained callback receipt is more than fifteen minutes after initialization. Customer payment time and missing earlier logs may explain this interval.",
      "CALLBACK_DELIVERY", "Compare bank payment-completion and callback-send timestamps before concluding delivery was delayed.", "LOW", true);
  if (!callbacks.length && input.pending && input.ageMs > 900000 && input.events.some(e => e.operation === "INITIALIZE" && e.outcome === "SUCCESS"))
    add("CALLBACK_MISSING", "PROBABLE", [], "No callback was found in available retained evidence after initialization; delivery cannot be ruled out.",
      "CALLBACK_DELIVERY", "Check public HTTPS ingress, logging availability, retention and bank callback delivery logs.", "MEDIUM", true);
  if (input.pending && input.ageMs > 900000) add("PAYMENT_PENDING", "CONFIRMED", ["database:payment"],
    "Current database attempt remains unsettled beyond fifteen minutes.", "PAYMENT_DATABASE", "Use existing verified reconciliation; do not release uncertain reservations automatically.");
  for (const check of input.checks.filter(c => c.status === "FAIL" || c.status === "WARNING")) {
    add(check.code, check.status === "FAIL" ? "CONFIRMED" : "PROBABLE", check.evidence, check.explanation,
      "READ_ONLY_CONSISTENCY", "Review evidence using authorized business correction workflows; diagnostics never repair financial records.", check.status === "FAIL" ? "HIGH" : "MEDIUM");
  }
  if (!findings.length) add("INSUFFICIENT_EVIDENCE", "UNKNOWN", [], "No observed failure establishes a root cause. This is not an all-clear result.",
    "INVESTIGATION", "Collect the missing request, verification and infrastructure evidence.", "LOW");
  if (input.limited) add("INSUFFICIENT_EVIDENCE", "UNKNOWN", [], "Evidence window or query limit was reached.", "COLLECTION",
    "Narrow the request-level investigation and consult retained logs.", "LOW");
  const unique = findings.filter((f, i, all) => all.findIndex(v => v.category === f.category && v.confidence === f.confidence) === i);
  return { findings: unique, result: unique.some(f => f.confidence === "CONFIRMED") ? "CONFIRMED" as const
    : unique.some(f => f.confidence === "PROBABLE") ? "PROBABLE" as const : "UNKNOWN" as const,
    // Observed failures are classified; no rule claims bank internal root cause.
    bankInternalRootCause: "UNKNOWN" as const };
}
export function latencyPercentiles(values: Array<number | null>) {
  const sorted = values.filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  const p = (n: number) => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * n) - 1)] : null;
  return { p50Ms: p(.5), p95Ms: p(.95), p99Ms: p(.99), sampleSize: sorted.length };
}
