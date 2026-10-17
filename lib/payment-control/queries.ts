import "server-only";
import { Prisma, type PaymentState } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { PaymentControlError } from "./authorization";
import { aiblWalletObject } from "@/lib/aibl-wallet-settings";

const statuses = ["INITIATED", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED", "VOIDED"] as const;
const providers = ["EPS", "SSLCOMMERZ", "AIBL_WALLET"] as const;
export const paymentProjection = {
  id: true, orderId: true, amount: true, currency: true, provider: true, status: true,
  externalId: true, createdAt: true, updatedAt: true,
  order: { select: { paymentStatus: true, status: true, grand_total: true, currency: true } },
} satisfies Prisma.PaymentSelect;

export function paymentFilters(params: URLSearchParams) {
  const provider = params.get("provider") || "";
  const status = params.get("status") || "";
  const q = (params.get("q") || "").trim();
  if (provider && !providers.includes(provider as typeof providers[number])) throw new PaymentControlError("Invalid provider");
  if (status && !statuses.includes(status as typeof statuses[number])) throw new PaymentControlError("Invalid payment status");
  if (q.length > 50 || (q && !/^[A-Za-z0-9_-]+$/.test(q))) throw new PaymentControlError("Search by numeric order ID or transaction ID");
  const from = params.get("from");
  const to = params.get("to");
  for (const date of [from, to]) if (date) {
    const parsed = new Date(date + "T00:00:00.000Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new PaymentControlError("Use valid YYYY-MM-DD dates");
    }
  }
  const end = to ? new Date(to + "T23:59:59.999Z") : new Date();
  const start = from ? new Date(from + "T00:00:00.000Z") : new Date(end.getTime() - 30 * 86400_000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end ||
      end.getTime() - start.getTime() > 90 * 86400_000) throw new PaymentControlError("Choose a valid date range of at most 90 days");
  const page = Number(params.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new PaymentControlError("Invalid page");
  const orderId = Number(q);
  const where: Prisma.PaymentWhereInput = {
    orderId: { not: null }, provider: provider || { in: [...providers] },
    ...(status ? { status: status as PaymentState } : {}),
    createdAt: { gte: start, lte: end },
    ...(q ? { OR: [{ externalId: { contains: q, mode: "insensitive" } },
      ...(Number.isSafeInteger(orderId) && orderId > 0 ? [{ orderId }] : [])] } : {}),
  };
  return { where, page, start, end, provider };
}

export async function getPaymentHistory(params: URLSearchParams) {
  const { where, page } = paymentFilters(params);
  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({ where, select: paymentProjection, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 25, take: 25 }),
  ]);
  return { payments, total, page, pageSize: 25 };
}

export async function getPaymentDetails(id: number, before?: string | null) {
  const payment = await prisma.payment.findFirst({ where: { id, orderId: { not: null }, provider: { in: [...providers] } },
    select: paymentProjection });
  if (!payment) throw new PaymentControlError("Payment not found", 404);
  let cursor: Prisma.PaymentEventWhereInput = {};
  if (before) {
    const [date, eventId, ...extra] = before.split("_");
    const beforeDate = new Date(date);
    if (extra.length || !Number.isFinite(beforeDate.getTime()) || !/^[a-f0-9-]{36}$/i.test(eventId ?? "")) {
      throw new PaymentControlError("Invalid timeline cursor");
    }
    cursor = { OR: [{ createdAt: { lt: beforeDate } }, { createdAt: beforeDate, id: { lt: eventId } }] };
  }
  // AUTH may be recorded before the Payment row is created; join by our safe transaction reference too.
  const events = await prisma.paymentEvent.findMany({ where: {
    AND: [{ OR: [{ paymentId: id }, ...(payment.externalId ? [{ transactionId: payment.externalId, provider: payment.provider! }] : [])] }, cursor],
  }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 101 });
  const [reconciliations, disputes, refunds] = await Promise.all([
    prisma.paymentReconciliation.findMany({ where: { paymentId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 }),
    prisma.paymentDispute.findMany({ where: { paymentId: id }, include: {
      assignedTo: { select: { id: true, name: true } },
      evidence: { orderBy: { createdAt: "desc" }, take: 100 },
      activities: { orderBy: { createdAt: "desc" }, take: 100 },
    }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.refund.findMany({ where: { orderId: payment.orderId! }, select: {
      id: true, paymentId: true, amount: true, status: true, payoutStatus: true,
      payoutTransactionId: true, reviewedAt: true, paidAt: true, createdAt: true,
    }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const aiblRecord = payment.provider === "AIBL_WALLET" ? await prisma.payment.findUnique({ where: { id }, select: { paymentGatewayData: true } }) : null;
  const meta = aiblWalletObject(aiblRecord?.paymentGatewayData);
  const safeRef = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value) ? value : null;
  const aibl = aiblRecord ? { bankOrderId: safeRef(meta.bankOrderId), bankTransactionId: safeRef(meta.bankTransactionId),
    initializationValidated: meta.initializationValidated === true,
    review: meta.initializeReview === "INVALID_RESPONSE_OR_AMOUNT" ? "INVALID_RESPONSE_OR_AMOUNT" : meta.verification === "PENDING_REVIEW" ? "PENDING_REVIEW" : null } : null;
  return { payment, aibl, events: events.slice(0, 100), nextBefore: events.length > 100
    ? `${events[99].createdAt.toISOString()}_${events[99].id}` : null, reconciliations, disputes, refunds };
}

export async function paymentOverview(params: URLSearchParams) {
  const { start, end, provider } = paymentFilters(params);
  const eventWhere: Prisma.PaymentEventWhereInput = {
    createdAt: { gte: start, lte: end }, ...(provider ? { provider } : {}),
    operation: { in: ["AUTH", "INITIALIZE", "VERIFY", "STATUS_QUERY"] },
    outcome: { in: ["HTTP_SUCCESS", "HTTP_ERROR", "TIMEOUT", "CONNECTION_ERROR"] },
  };
  const [summary, latency, sample, logger, recentRequests] = await Promise.all([
    prisma.paymentEvent.groupBy({ by: ["provider", "outcome"], where: eventWhere, _count: { _all: true } }),
    prisma.paymentEvent.aggregate({ where: eventWhere, _avg: { durationMs: true }, _max: { durationMs: true }, _count: { _all: true } }),
    prisma.paymentEvent.findMany({ where: eventWhere, select: { durationMs: true }, orderBy: { createdAt: "desc" }, take: 2000 }),
    prisma.paymentEvent.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.paymentEvent.findMany({ where: { ...eventWhere, outcome: { not: "REQUEST_STARTED" } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 }),
  ]);
  const durations = sample.flatMap((event) => event.durationMs === null ? [] : [event.durationMs]).sort((a, b) => a - b);
  const p95 = durations.length ? durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)] : null;
  const alertWhere: Prisma.PaymentWhereInput = {
    orderId: { not: null }, provider: provider || { in: [...providers] }, createdAt: { gte: start, lte: end },
    OR: [
      { status: "FAILED" }, { status: "VOIDED" },
      { status: { in: ["INITIATED", "AUTHORIZED"] }, createdAt: { lt: new Date(Date.now() - 15 * 60_000) } },
      { status: "CAPTURED", order: { paymentStatus: "UNPAID" } },
      { reconciliations: { some: { result: { in: ["MISMATCH", "INVALID_REFERENCE", "INVALID_AMOUNT"] } } } },
      { controlEvents: { some: { outcome: "MISMATCH" } } },
    ],
  };
  const [alertCandidateCount, candidates] = await Promise.all([
    prisma.payment.count({ where: alertWhere }),
    prisma.payment.findMany({ where: alertWhere, select: {
      ...paymentProjection,
      reconciliations: { where: { result: { in: ["MATCH", "MISMATCH", "INVALID_REFERENCE", "INVALID_AMOUNT", "REFUND_REVIEW"] } }, orderBy: { createdAt: "desc" }, take: 1 },
      controlEvents: { where: { OR: [{ outcome: "MISMATCH" }, { operation: { in: ["INITIALIZE", "SETTLEMENT"] }, outcome: "SUCCESS" }] },
        orderBy: { createdAt: "desc" }, take: 5 },
      _count: { select: { controlEvents: { where: { operation: "CALLBACK", outcome: "RECEIVED" } } } },
    }, take: 100, orderBy: { createdAt: "desc" } }),
  ]);
  const alerts = candidates.flatMap((payment) => {
    const kinds: string[] = [];
    if (payment.status === "FAILED") kinds.push("PAYMENT_FAILED");
    if (payment.status === "VOIDED") kinds.push("PAYMENT_CANCELLED");
    const pending = ["INITIATED", "AUTHORIZED"].includes(payment.status);
    if (pending && payment.createdAt.getTime() < Date.now() - 15 * 60_000) {
      kinds.push("PENDING_OVER_15_MINUTES");
      if (payment.controlEvents.some((event) => event.operation === "INITIALIZE" && event.outcome === "SUCCESS") &&
          payment._count.controlEvents === 0) kinds.push("CALLBACK_MISSING");
    }
    const last = payment.reconciliations[0];
    const settled = payment.controlEvents.find((event) => event.operation === "SETTLEMENT" && event.outcome === "SUCCESS");
    const localMismatch = payment.status === "CAPTURED" && payment.order?.paymentStatus === "UNPAID";
    const comparisonMismatch = last && last.databaseStatus === payment.status && last.orderStatus === payment.order?.paymentStatus &&
      ["MISMATCH", "INVALID_REFERENCE", "INVALID_AMOUNT"].includes(last.result) && (!settled || last.createdAt > settled.createdAt);
    const eventMismatch = payment.controlEvents.some((event) => event.outcome === "MISMATCH" &&
      (!last || event.createdAt > last.createdAt) && (!settled || event.createdAt > settled.createdAt));
    if (localMismatch || comparisonMismatch || eventMismatch) kinds.push("STATUS_MISMATCH");
    return kinds.map((kind) => ({ kind, paymentId: payment.id, orderId: payment.orderId, provider: payment.provider,
      transactionId: payment.externalId, createdAt: payment.createdAt }));
  });
  return { network: { summary, requests: latency._count._all, averageMs: latency._avg.durationMs,
    maxMs: latency._max.durationMs, p95Ms: p95, p95SampleSize: durations.length, latestEventAt: logger?.createdAt ?? null, recentRequests },
    alerts, alertCandidateCount, alertScanLimit: 100, range: { start, end } };
}

function csvCell(value: unknown) {
  // Quoting does not stop spreadsheet formula execution.
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export async function paymentCsv(params: URLSearchParams) {
  const { where } = paymentFilters(params);
  const payments = await prisma.payment.findMany({ where, select: paymentProjection,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5001 });
  if (payments.length > 5000) throw new PaymentControlError("Export exceeds 5000 rows; narrow the date range or filters", 413);
  const rows = [["Payment ID", "Order ID", "Gateway", "Transaction ID", "Amount", "Currency", "Payment status", "Order payment status", "Created (UTC)"],
    ...payments.map((p) => [p.id, p.orderId, p.provider, p.externalId, p.amount?.toString(), p.currency, p.status,
      p.order?.paymentStatus, p.createdAt.toISOString()])];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
