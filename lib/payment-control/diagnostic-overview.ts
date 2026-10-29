import "server-only";
import { prisma } from "@/lib/prisma";
import { paymentFilters, paymentProjection } from "./queries";
import { paymentTraceId } from "./diagnostic-policy";
import { investigatePayment, latencyPercentiles, type DiagnosticCheck, type InvestigationEvent } from "./investigation-engine";
import { PaymentControlError } from "./authorization";
export async function diagnosticOverview(params: URLSearchParams) {
  if (params.get("provider") && !["EPS", "AIBL_WALLET"].includes(params.get("provider")!)) throw new PaymentControlError("Choose EPS or AIBL Wallet");
  const { where, start, end } = paymentFilters(params);
  const category = params.get("category") || "", severity = params.get("severity") || "", result = params.get("result") || "";
  if (category && !/^[A-Z_]{3,60}$/.test(category) || severity && !["LOW", "MEDIUM", "HIGH"].includes(severity) ||
    result && !["CONFIRMED", "PROBABLE", "UNKNOWN"].includes(result)) throw new PaymentControlError("Invalid investigation filter");
  const base = { ...where, provider: params.get("provider") || { in: ["EPS", "AIBL_WALLET"] } };
  const eventWhere = { provider: params.get("provider") || { in: ["EPS", "AIBL_WALLET"] }, createdAt: { gte: start, lte: end } };
  const [total, states, candidates, http, callbackStates, reconciliations, disputes] = await Promise.all([
    prisma.payment.count({ where: base }),
    prisma.payment.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    prisma.payment.findMany({ where: base, select: { ...paymentProjection, controlEvents: {
      select: { id: true, requestId: true, paymentId: true, operation: true, outcome: true, detailCode: true, httpStatus: true,
        durationMs: true, gatewayStatus: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 101 } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 101 }),
    prisma.paymentEvent.findMany({ where: { ...eventWhere, operation: { in: ["AUTH", "INITIALIZE", "STATUS_QUERY", "VERIFY"] },
      outcome: { in: ["HTTP_SUCCESS", "HTTP_ERROR", "TIMEOUT", "CONNECTION_ERROR"] } },
      select: { outcome: true, durationMs: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 2001 }),
    prisma.paymentEvent.groupBy({ by: ["outcome"], where: { ...eventWhere, operation: "CALLBACK" }, _count: { _all: true } }),
    prisma.paymentReconciliation.count({ where: { createdAt: { gte: start, lte: end }, result: { in: ["CHECK_FAILED", "MISMATCH", "INVALID_REFERENCE", "INVALID_AMOUNT"] },
      payment: { provider: base.provider } } }),
    prisma.paymentDispute.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] }, payment: base } }),
  ]);
  const payments = candidates.slice(0, 100).map(payment => {
    const checks: DiagnosticCheck[] = payment.status === "CAPTURED" && payment.order?.paymentStatus === "UNPAID"
      ? [{ code: "PAYMENT_ORDER_CONSISTENCY", status: "FAIL", evidence: ["database:payment-order"], explanation: "Captured payment has an order that is not paid." }] : [];
    const events: InvestigationEvent[] = payment.controlEvents.slice(0, 100).reverse().map(e => ({ ...e,
      createdAt: e.createdAt.toISOString(), source: e.operation === "FRONTEND" ? "CLIENT_REPORTED" : "SERVER" }));
    const analysis = investigatePayment({ events, checks, transports: [], pending: ["INITIATED", "AUTHORIZED"].includes(payment.status),
      ageMs: Date.now() - payment.createdAt.getTime(), limited: payment.controlEvents.length > 100 });
    return { id: payment.id, orderId: payment.orderId, provider: payment.provider, status: payment.status, traceId: paymentTraceId(payment.id),
      createdAt: payment.createdAt.toISOString(), result: analysis.result, categories: analysis.findings.map(f => f.category),
      severity: analysis.findings.some(f => f.severity === "HIGH") ? "HIGH" : analysis.findings.some(f => f.severity === "MEDIUM") ? "MEDIUM" : "LOW" };
  }).filter(p => (!category || p.categories.includes(category)) && (!severity || p.severity === severity) && (!result || p.result === result));
  const sample = http.slice(0, 2000), errors = sample.filter(e => e.outcome !== "HTTP_SUCCESS").length;
  const count = (status: string) => states.find(s => s.status === status)?._count._all ?? 0;
  const callbacks = callbackStates.reduce((n, s) => n + s._count._all, 0);
  const callbackFailures = callbackStates.filter(s => ["ERROR", "REJECTED", "MISMATCH"].includes(s.outcome)).reduce((n, s) => n + s._count._all, 0);
  return { payments, scan: { limit: 100, count: Math.min(100, candidates.length), limited: candidates.length > 100,
      filterScope: "LATEST_100_MATCHING_PAYMENTS", assessment: "EVENTS_AND_PAYMENT_ORDER_ONLY_OPEN_DETAIL_FOR_FULL_CHECKS" },
    overview: { total, successful: count("CAPTURED") + count("REFUNDED"), captured: count("CAPTURED"), refunded: count("REFUNDED"),
      failed: count("FAILED"), pending: count("INITIATED") + count("AUTHORIZED"),
      uncertain: candidates.slice(0, 100).filter(p => ["INITIATED", "AUTHORIZED"].includes(p.status) && Date.now() - p.createdAt.getTime() > 900000).length,
      uncertaintyScope: "LATEST_100_PAYMENTS", paymentSuccessRate: total ? (count("CAPTURED") + count("REFUNDED")) / total : null,
      gatewayHttpErrorRate: sample.length ? errors / sample.length : null,
      averageMs: sample.filter(e => e.durationMs !== null).length ? sample.reduce((n, e) => n + (e.durationMs ?? 0), 0) / sample.filter(e => e.durationMs !== null).length : null,
      ...latencyPercentiles(sample.map(e => e.durationMs)), latencySampleLimited: http.length > 2000,
      callbackFailureRate: callbacks ? callbackFailures / callbacks : null, callbackMetric: "EVENTS_NOT_UNIQUE_DELIVERIES",
      reconciliationErrors: reconciliations, openInvestigationCases: disputes }, range: { start, end } };
}
