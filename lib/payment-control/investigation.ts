import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { PaymentControlError } from "./authorization";
import { paymentTraceId, diagnosticLimitations, diagnosticsEnabled } from "./diagnostic-policy";
import { checkConsistency } from "./consistency";
import { investigatePayment, type InvestigationEvent } from "./investigation-engine";
import { readTransportEvidence } from "./transport-storage";
import { captureProjection } from "./capture";
import { epsObject } from "@/lib/eps-settings";
import { diagnosticStage, paymentDiagnosticAdapter } from "./diagnostic-adapters";

export async function getPaymentInvestigation(id: number) {
  // No gateway imports, remote requests, settlement helpers or locks on financial rows.
  const snapshot = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '3000ms'");
    const payment = await tx.payment.findFirst({ where: { id, orderId: { not: null }, provider: { in: ["EPS", "AIBL_WALLET"] } },
      select: { id: true, orderId: true, provider: true, status: true, amount: true, currency: true, externalId: true,
        createdAt: true, updatedAt: true, paymentGatewayData: true,
        order: { select: { id: true, paymentStatus: true, status: true, grand_total: true, currency: true,
          orderItems: { select: { variantId: true, productId: true, quantity: true,
            product: { select: { type: true, bundleFulfillmentMode: true } },
            bundleComponents: { select: { variantId: true, productId: true, quantityPerBundle: true, product: { select: { type: true } } } } } } } } } });
    if (!payment?.order) throw new PaymentControlError("EPS/AIBL payment attempt not found", 404);
    const directWhere: Prisma.PaymentEventWhereInput = { provider: payment.provider!, OR: [{ paymentId: id },
      ...(payment.externalId ? [{ transactionId: payment.externalId }] : [])] };
    const linked = await tx.paymentEvent.findMany({ where: { ...directWhere, requestId: { not: null } },
      select: { requestId: true }, distinct: ["requestId"], orderBy: { requestId: "asc" }, take: 101 });
    // Recover pre-claim AUTH/TOKEN events through server-generated request IDs. An
    // order-only event is never assigned to an attempt by temporal proximity.
    const events = await tx.paymentEvent.findMany({ where: { provider: payment.provider!, OR: [directWhere,
      { requestId: { in: linked.slice(0, 100).flatMap(e => e.requestId ? [e.requestId] : []) } }] },
      select: { id: true, paymentId: true, requestId: true, operation: true, outcome: true, detailCode: true,
        httpStatus: true, durationMs: true, gatewayStatus: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1001 });
    const meta = epsObject(payment.paymentGatewayData);
    const referenceKey = payment.provider === "AIBL_WALLET" ? "bankTransactionId" : "epsTransactionId";
    const bankRef = meta[referenceKey];
    const duplicateBankReferences = typeof bankRef === "string" && bankRef.length > 0
      ? await tx.payment.count({ where: { provider: payment.provider, id: { not: id },
        paymentGatewayData: { path: [referenceKey], equals: bankRef } } }) : null;
    const settledPayments = await tx.payment.count({ where: { orderId: payment.orderId!, status: { in: ["CAPTURED", "REFUNDED"] } } });
    const reservations = await tx.inventoryReservation.count({ where: { orderId: payment.orderId! } }) +
      await tx.bundleStockReservation.count({ where: { orderId: payment.orderId! } });
    const variantIds = [...new Set(payment.order.orderItems.flatMap(i => [i.variantId, ...i.bundleComponents.map(c => c.variantId)])
      .filter((v): v is number => v !== null))].slice(0, 201);
    const productIds = [...new Set(payment.order.orderItems.flatMap(i => [i.productId, ...i.bundleComponents.map(c => c.productId)]))].slice(0, 201);
    const stock = await tx.$queryRaw<Array<{ id: number; kind: string; quantity: number; reserved: number; actualReserved: number }>>(Prisma.sql`
      SELECT s."id", 'VARIANT' AS "kind", s."quantity", s."reserved",
        (SELECT COALESCE(SUM(r."quantity"),0)::integer FROM "InventoryReservation" r WHERE r."stockLevelId"=s."id") AS "actualReserved"
      FROM "StockLevel" s WHERE s."productVariantId" = ANY(${variantIds}::int[])
      UNION ALL
      SELECT s."id", 'BUNDLE' AS "kind", s."quantity", s."reserved",
        (SELECT COALESCE(SUM(r."quantity"),0)::integer FROM "BundleStockReservation" r WHERE r."bundleStockLevelId"=s."id") AS "actualReserved"
      FROM "BundleStockLevel" s WHERE s."productId" = ANY(${productIds}::int[])
      LIMIT 201`);
    const rec = await tx.paymentReconciliation.findFirst({ where: { paymentId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { result: true, createdAt: true } });
    const variantTotals = await tx.$queryRaw<Array<{ id: number; storedStock: number; computedStock: number }>>(Prisma.sql`
      SELECT v."id", v."stock" AS "storedStock",
        COALESCE((SELECT SUM(GREATEST(0,s."quantity"-s."reserved"))::integer FROM "StockLevel" s WHERE s."productVariantId"=v."id"),0) AS "computedStock"
      FROM "ProductVariant" v WHERE v."id" = ANY(${variantIds}::int[])
        AND EXISTS (SELECT 1 FROM "StockLevel" s WHERE s."productVariantId"=v."id") LIMIT 201`);
    const movements = await tx.inventoryLog.groupBy({ by: ["productId", "variantId"], where: { orderId: payment.orderId!, change: { lt: 0 },
      reason: { contains: payment.provider === "EPS" ? "EPS verified capture" : "AIBL verified payment" } }, _sum: { change: true }, take: 201, orderBy: { productId: "asc" } });
    const expected = new Map<string, number>(), actual = new Map<string, number>();
    const addQuantity = (map: Map<string, number>, key: string, quantity: number) => map.set(key, (map.get(key) ?? 0) + quantity);
    for (const item of payment.order.orderItems) {
      if (item.product.type === "PHYSICAL" && item.variantId) addQuantity(expected, `V:${item.variantId}`, item.quantity);
      if (item.product.type === "BUNDLE") {
        if (item.product.bundleFulfillmentMode === "PREASSEMBLED") addQuantity(expected, `B:${item.productId}`, item.quantity);
        else for (const c of item.bundleComponents) if (c.product.type === "PHYSICAL" && c.variantId) addQuantity(expected, `V:${c.variantId}`, c.quantityPerBundle * item.quantity);
      }
    }
    const originalInventory = epsObject(meta.inventorySnapshot);
    const originalVariants = originalInventory.variants, originalBundles = originalInventory.bundles;
    const validRows = (value: unknown, length: number): value is number[][] => Array.isArray(value) && value.length <= 200 &&
      value.every(row => Array.isArray(row) && row.length === length && row.every(n => typeof n === "number" && Number.isSafeInteger(n) && n > 0));
    const originalSnapshot = payment.provider === "AIBL_WALLET" && validRows(originalVariants, 6) && validRows(originalBundles, 5);
    if (originalSnapshot) {
      expected.clear();
      for (const row of originalVariants as number[][]) addQuantity(expected, `V:${row[2]}`, row[5]);
      for (const row of originalBundles as number[][]) addQuantity(expected, `B:${row[2]}`, row[4]);
    }
    for (const m of movements) addQuantity(actual, m.variantId ? `V:${m.variantId}` : `B:${m.productId}`, -(m._sum.change ?? 0));
    const verificationRecorded = (payment.provider === "AIBL_WALLET" && meta.verification === "VERIFIED" && typeof meta.verifiedAt === "string") ||
      (payment.provider === "EPS" && meta.verifiedStatus === "Success" && typeof meta.lastCheckedAt === "string") ||
      events.some(e => e.operation === "VERIFY" && e.outcome === "SUCCESS");
    const checks = checkConsistency({ payment: { id, status: payment.status, amount: payment.amount?.toString() ?? null,
      currency: payment.currency, createdAt: payment.createdAt.toISOString() }, order: { id: payment.order.id,
      paymentStatus: payment.order.paymentStatus, status: payment.order.status, amount: payment.order.grand_total.toString(), currency: payment.order.currency },
      settledPayments, duplicateBankReferences, reservations, stock: stock.slice(0, 200),
      stockLimited: stock.length > 200 || variantIds.length > 200 || productIds.length > 200,
      variantTotals: variantTotals.slice(0, 200),
      commitLedger: movements.length > 200 ? undefined : { stockRequired: expected.size > 0, observed: actual.size > 0,
        certainty: originalSnapshot ? "SNAPSHOT" : "CURRENT_CATALOG",
        matches: expected.size === actual.size && [...expected].every(([key, quantity]) => actual.get(key) === quantity) },
      verificationRecorded, settlementRecorded: events.some(e => e.operation === "SETTLEMENT" && e.outcome === "SUCCESS"),
      reconciliation: rec ? { result: rec.result, createdAt: rec.createdAt.toISOString() } : null });
    const safeEvents: InvestigationEvent[] = events.slice(0, 1000).reverse().map(e => ({ ...e, createdAt: e.createdAt.toISOString(),
      gatewayStage: diagnosticStage(payment.provider!, e.operation, e.detailCode),
      source: e.operation === "FRONTEND" ? "CLIENT_REPORTED" : "SERVER" }));
    const unassigned = await tx.paymentEvent.findMany({ where: { orderId: payment.orderId!, provider: payment.provider!,
      operation: "FRONTEND", paymentId: null, requestId: null }, select: { id: true, detailCode: true, durationMs: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51 });
    return { payment: { id, traceId: paymentTraceId(id), provider: payment.provider!, orderId: payment.orderId!,
      reference: payment.externalId ? `reference-sha256:${createHash("sha256").update(payment.externalId).digest("hex").slice(0, 16)}` : null,
      status: payment.status, amount: payment.amount?.toString() ?? null, currency: payment.currency,
      environment: payment.provider === "EPS" ? "sandbox" : "uat", createdAt: payment.createdAt.toISOString(), updatedAt: payment.updatedAt.toISOString(),
      orderStatus: payment.order.status, orderPaymentStatus: payment.order.paymentStatus },
      checks, events: safeEvents, reconciliation: rec ? { result: rec.result, createdAt: rec.createdAt.toISOString() } : null,
      orderBrowserReports: { scope: "ORDER_ONLY_NOT_ATTEMPT_ATTRIBUTED" as const, limited: unassigned.length > 50,
        events: unassigned.slice(0, 50).map(e => ({ ...e, createdAt: e.createdAt.toISOString() })) },
      limited: events.length > 1000 || linked.length > 100 };
  }, { isolationLevel: "RepeatableRead", maxWait: 1000, timeout: 10000 });
  const requestIds = [...new Set(snapshot.events.flatMap(e => e.requestId ? [e.requestId] : []))];
  // Bound diagnostic reads independently of financial snapshot/transactions.
  const transports = [] as Awaited<ReturnType<typeof readTransportEvidence>>[];
  for (const requestId of requestIds.slice(0, 20)) transports.push(await readTransportEvidence(requestId));
  const captureEvidence = await prisma.paymentDiagnosticCapture.findMany({ where: { paymentId: id, expiresAt: { gt: new Date() } },
    select: captureProjection, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51 })
    .then(jobs => ({ availability: "AVAILABLE" as const, limited: jobs.length > 50, jobs: jobs.slice(0, 50) }))
    .catch(() => ({ availability: "UNAVAILABLE" as const, limited: false, jobs: [] }));
  const captureObservations = captureEvidence.jobs.filter(j => j.kind === "CAPTURE" && j.status === "COMPLETE").map(j => {
    const meta = epsObject(j.summary);
    const count = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= (j.packetCount ?? 0) ? v : 0;
    return { id: j.id, resets: count(meta.resets), retransmissions: count(meta.retransmissions) };
  });
  const analysis = investigatePayment({ events: snapshot.events, checks: snapshot.checks, captures: captureObservations,
    transports: transports.flatMap(t => t.attempts), pending: ["INITIATED", "AUTHORIZED"].includes(snapshot.payment.status),
    ageMs: Date.now() - Date.parse(snapshot.payment.createdAt), limited: snapshot.limited || requestIds.length > 20 || transports.some(t => t.limited) });
  return { version: 1, generatedAt: new Date().toISOString(), passiveDiagnosticsEnabled: diagnosticsEnabled(), ...snapshot,
    adapter: paymentDiagnosticAdapter(snapshot.payment.provider),
    transport: { requestsRead: transports.length, totalRequests: requestIds.length, storage: [...new Set(transports.map(t => t.storage))],
      attempts: transports.flatMap(t => t.attempts), limited: requestIds.length > 20 || transports.some(t => t.limited) },
    analysis, captureEvidence, limitations: diagnosticLimitations };
}
export type PaymentInvestigation = Awaited<ReturnType<typeof getPaymentInvestigation>>;
