import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@/generated/prisma";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimitRequest } from "@/lib/request-security";
import { recordPaymentEvent, type PaymentLogContext } from "@/lib/payment-control/telemetry";
import { verifyPaymentInitToken } from "@/lib/sslcommerz";
import { epsObject, EPS_INITIALIZE_CONTRACT } from "@/lib/eps-settings";
import { buildEpsInitializeBody, createEpsTransactionId, EpsError, epsCallbackUrls, epsConfig,
  epsGatewayId, epsMoney, epsRedirectUrl, findEpsGateway, getEpsToken, initializeEpsPayment } from "@/lib/eps";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let logContext: PaymentLogContext = { provider: "EPS" };
  try {
    const limit = await rateLimitRequest(request, { scope: "eps-init", limit: 10, windowMs: 600_000 });
    if (!limit.allowed) return NextResponse.json({ error: "Too many EPS payment attempts" }, {
      status: 429, headers: { "Retry-After": String(limit.retryAfter) },
    });
    const body = epsObject(await request.json().catch(() => null));
    const orderId = Number(body.orderId);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new EpsError("Valid orderId is required", 400);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new EpsError("Order not found", 404);
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!(order.userId ? order.userId === userId : verifyPaymentInitToken(order.id, body.paymentInitToken))) {
      throw new EpsError("Forbidden", 403);
    }
    const gatewayId = epsGatewayId(order.payment_method);
    if (!gatewayId || (body.gatewayId !== undefined && Number(body.gatewayId) !== gatewayId)) {
      throw new EpsError("EPS gateway does not match the order", 400);
    }
    const found = await findEpsGateway(gatewayId);
    if (!found) throw new EpsError("EPS gateway is unavailable", 503);
    const config = epsConfig();
    const transactionId = createEpsTransactionId();
    logContext = { provider: "EPS", transactionId, orderId };
    const urls = epsCallbackUrls(transactionId);
    // Authenticate before creating an attempt: failures here cannot create a remote payment.
    const token = await getEpsToken(logContext);
    const attempt = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`);
      const current = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: {
        orderItems: { select: { product: { select: { name: true } } } },
      } });
      if (current.payment_method !== `EPS:${gatewayId}` || current.paymentStatus !== "UNPAID" ||
          !["PENDING", "CONFIRMED"].includes(current.status)) throw new EpsError("Order is not eligible for EPS payment", 409);
      if (current.currency !== "BDT") throw new EpsError("The documented EPS contract only supports BDT orders", 400);
      const amount = epsMoney(current.grand_total);
      if (!amount || amount === "0.00") throw new EpsError("Invalid EPS order amount", 400);
      const existing = await tx.payment.findFirst({ where: { orderId, status: { in: ["INITIATED", "AUTHORIZED", "CAPTURED"] } }, orderBy: { id: "desc" } });
      if (existing) {
        const meta = epsObject(existing.paymentGatewayData);
        if (existing.provider === "EPS" && existing.status === "INITIATED" && meta.redirectUrl &&
            meta.accountFingerprint === config.accountFingerprint && Date.now() - existing.createdAt.getTime() < 30 * 60_000) {
          return { reused: true as const, redirectUrl: epsRedirectUrl(meta.redirectUrl), transactionId: existing.externalId };
        }
        // No retry for an uncertain, expired or still-running attempt; verify it first.
        throw new EpsError("A payment attempt already exists; verify its final status before retrying", 409);
      }
      const payload = buildEpsInitializeBody(current, transactionId, amount,
        current.orderItems.map((item) => item.product.name).join(", "), urls);
      const payment = await tx.payment.create({ data: {
        orderId, amount, currency: "BDT", provider: "EPS", status: "INITIATED", externalId: transactionId,
        paymentGatewayData: { type: "EPS_TRANSACTION", gatewayId, inventoryMode: "RESERVATION",
          accountFingerprint: config.accountFingerprint, initializeContract: EPS_INITIALIZE_CONTRACT,
          initiatedAt: new Date().toISOString() },
      } });
      return { reused: false as const, payment, payload };
    });
    if (attempt.reused) {
      await recordPaymentEvent({ provider: "EPS", orderId, transactionId: attempt.transactionId ?? undefined,
        operation: "INITIALIZE", outcome: "DUPLICATE" });
      return NextResponse.json({ redirectUrl: attempt.redirectUrl, tranId: attempt.transactionId, reused: true }, { headers: { "Cache-Control": "private, no-store" } });
    }
    // No DB transaction remains open across a network request. The durable attempt blocks duplicate init.
    logContext = { ...logContext, paymentId: attempt.payment.id };
    const initialized = await initializeEpsPayment(attempt.payload, token, logContext);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`);
      const current = await tx.payment.findUniqueOrThrow({ where: { id: attempt.payment.id } });
      if (current.status !== "INITIATED") throw new EpsError("EPS attempt changed while initializing; check payment status", 409);
      await tx.payment.update({ where: { id: current.id }, data: { paymentGatewayData: {
        ...epsObject(current.paymentGatewayData), redirectUrl: initialized.redirectUrl,
        epsTransactionId: initialized.epsTransactionId,
      } as Prisma.InputJsonObject } });
    });
    await recordPaymentEvent({ ...logContext, operation: "INITIALIZE", outcome: "SUCCESS" });
    return NextResponse.json({ redirectUrl: initialized.redirectUrl, tranId: transactionId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    await recordPaymentEvent({ ...logContext, operation: "INITIALIZE", outcome: "ERROR", detailCode: "INITIALIZE_REJECTED" });
    // Never log provider payloads, customer data, bearer tokens or credentials.
    return NextResponse.json({ error: error instanceof EpsError ? error.message : "Could not initialize EPS payment; check pending payment status" },
      { status: error instanceof EpsError ? error.status : 500 });
  }
}
