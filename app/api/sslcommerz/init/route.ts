import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { rateLimitRequest } from "@/lib/request-security";
import { Prisma } from "@/generated/prisma";
import { paymentFetch, recordPaymentEvent, type PaymentLogContext } from "@/lib/payment-control/telemetry";
import { PaymentControlError } from "@/lib/payment-control/authorization";
import {
  callbackUrls,
  createSslcommerzTransactionId,
  findSslcommerzGateway,
  gatewayIdFromMethod,
  isSslcommerzMethod,
  sslcommerzEndpoint,
  verifyPaymentInitToken,
} from "@/lib/sslcommerz";

export const runtime = "nodejs";

type SslcommerzInitBody = {
  orderId: number;
  gatewayId?: number;
  paymentInitToken?: string | null;
};

export async function POST(request: NextRequest) {
  let logContext: PaymentLogContext = { provider: "SSLCOMMERZ" };
  try {
    const rateLimit = await rateLimitRequest(request, {
      scope: "sslcommerz-init",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many payment attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
      );
    }

    const body = (await request.json().catch(() => null)) as SslcommerzInitBody | null;
    const orderId = Number(body?.orderId);

    if (!orderId || Number.isNaN(orderId)) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        _count: { select: { inventoryReservations: true } },
        orderItems: {
          select: { product: { select: { type: true } } },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const ownsAuthenticatedOrder = Boolean(
      order.userId && sessionUserId && order.userId === sessionUserId,
    );
    const hasGuestToken = Boolean(
      !order.userId && verifyPaymentInitToken(order.id, body?.paymentInitToken),
    );
    if (!ownsAuthenticatedOrder && !hasGuestToken) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      !isSslcommerzMethod(order.payment_method) ||
      order.paymentStatus === "PAID" ||
      ["FAILED", "CANCELLED", "RETURNED"].includes(order.status)
    ) {
      return NextResponse.json({ error: "Order is not eligible for SSLCommerz payment" }, { status: 409 });
    }

    const methodGatewayId = gatewayIdFromMethod(order.payment_method);
    const requestedGatewayId = Number(body?.gatewayId || methodGatewayId || 0) || null;
    if (methodGatewayId && requestedGatewayId !== methodGatewayId) {
      return NextResponse.json({ error: "Payment gateway does not match the order" }, { status: 400 });
    }

    const found = await findSslcommerzGateway(requestedGatewayId);
    const gateway = found?.gateway;
    const data: any = found?.data || {};

    const storeId = String(data.storeId || "").trim();
    const storePassword = String(data.storePassword || "").trim();
    const sandbox = Boolean(data.sandbox);

    if (!storeId || !storePassword) {
      return NextResponse.json(
        { error: "SSLCommerz credentials are not configured" },
        { status: 400 },
      );
    }

    const amount = Number((order as any).grand_total ?? (order as any).total ?? 0);
    if (!amount || Number.isNaN(amount)) {
      return NextResponse.json({ error: "Invalid order amount" }, { status: 400 });
    }

    const activePayment = await prisma.payment.findFirst({
      where: {
        orderId: order.id,
        provider: "SSLCOMMERZ",
        status: { in: ["INITIATED", "AUTHORIZED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (activePayment) {
      const sessionIsFresh =
        Date.now() - activePayment.createdAt.getTime() < 30 * 60 * 1000;
      const activeMeta = activePayment.paymentGatewayData &&
        typeof activePayment.paymentGatewayData === "object" &&
        !Array.isArray(activePayment.paymentGatewayData)
        ? activePayment.paymentGatewayData as Record<string, unknown>
        : {};
      const redirectUrl = String(activeMeta.redirectUrl || "");
      if (redirectUrl && activePayment.status === "INITIATED" && sessionIsFresh) {
        await recordPaymentEvent({ provider: "SSLCOMMERZ", paymentId: activePayment.id, orderId: order.id,
          transactionId: activePayment.externalId ?? undefined, operation: "INITIALIZE", outcome: "DUPLICATE" });
        return NextResponse.json({
          redirectUrl,
          tranId: activePayment.externalId,
          reused: true,
        });
      }
      return NextResponse.json(
        { error: "A payment attempt is already in progress; verify its status before retrying" },
        { status: 409 },
      );
    }

    const tranId = createSslcommerzTransactionId(order.id);
    logContext = { provider: "SSLCOMMERZ", transactionId: tranId, orderId: order.id };
    const urls = callbackUrls(request, data);
    const hasPhysicalItems = order.orderItems.some(
      (item) => item.product.type === "PHYSICAL",
    );
    const inventoryMode =
      !hasPhysicalItems || order._count.inventoryReservations > 0
        ? "RESERVATION"
        : "LEGACY_DEDUCTED";

    const payment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`);
      const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
      if (current.payment_method !== order.payment_method || current.paymentStatus !== "UNPAID" ||
          ["FAILED", "CANCELLED", "RETURNED", "REFUNDED"].includes(current.status) ||
          !current.grand_total.equals(order.grand_total) || current.currency !== order.currency ||
          await tx.payment.count({ where: { orderId: order.id, status: { in: ["INITIATED", "AUTHORIZED", "CAPTURED", "REFUNDED"] } } })) {
        throw new PaymentControlError("Order has changed or an attempt already exists; verify it before retrying", 409);
      }
      return tx.payment.create({
        data: {
          orderId: order.id,
          amount,
          currency: order.currency || "BDT",
          provider: "SSLCOMMERZ",
          status: "INITIATED",
          externalId: tranId,
          paymentGatewayData: {
            type: "SSLCOMMERZ_TRANSACTION",
            gatewayId: gateway!.id,
            sandbox,
            inventoryMode,
            initiatedAt: new Date().toISOString(),
          },
        },
      });
    });
    logContext = { ...logContext, paymentId: payment.id };

    const form = new URLSearchParams();
    form.set("store_id", storeId);
    form.set("store_passwd", storePassword);
    form.set("total_amount", String(amount));
    form.set("currency", order.currency || "BDT");
    form.set("tran_id", tranId);
    form.set("success_url", urls.successUrl);
    form.set("fail_url", urls.failUrl);
    form.set("cancel_url", urls.cancelUrl);
    form.set("ipn_url", urls.ipnUrl);
    form.set("value_a", String(order.id));
    form.set("value_b", String(gateway!.id));

    form.set("cus_name", String((order as any).name || "Customer"));
    form.set("cus_email", String((order as any).email || ""));
    form.set("cus_add1", String((order as any).address_details || ""));
    form.set("cus_city", String((order as any).district || ""));
    form.set("cus_country", String((order as any).country || "BD"));
    form.set("cus_phone", String((order as any).phone_number || ""));

    form.set("shipping_method", "Courier");
    form.set("product_name", "Order Payment");
    form.set("product_category", "Ecommerce");
    form.set("product_profile", "general");

    const endpoint = sslcommerzEndpoint(sandbox, "session");

    let res: Response;
    try {
      res = await paymentFetch(logContext, "INITIALIZE", endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        timeoutMs: 30_000,
      });
    } catch (error) {
      // Unknown network outcome is not proof of failure. Keep the durable attempt pending.
      return NextResponse.json({ error: "Could not connect to SSLCommerz" }, { status: 502 });
    }

    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload) {
      await recordPaymentEvent({ ...logContext, operation: "INITIALIZE", outcome: "ERROR", detailCode: "INVALID_RESPONSE" });
      return NextResponse.json(
        { error: "Failed to initiate SSLCommerz payment" },
        { status: 502 },
      );
    }

    const gatewayPageUrl = String(payload.GatewayPageURL || "");
    if (!gatewayPageUrl) {
      await recordPaymentEvent({ ...logContext, operation: "INITIALIZE", outcome: "ERROR", detailCode: "INVALID_RESPONSE" });
      return NextResponse.json(
        { error: payload.failedreason || "GatewayPageURL missing" },
        { status: 502 },
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`);
      const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      if (current.status !== "INITIATED") throw new PaymentControlError("Payment changed during initialization; check its verified status", 409);
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          paymentGatewayData: {
            type: "SSLCOMMERZ_TRANSACTION",
            gatewayId: gateway!.id,
            sandbox,
            inventoryMode,
            initiatedAt: new Date().toISOString(),
            redirectUrl: gatewayPageUrl,
            sessionKey: String(payload.sessionkey || "") || null,
          },
        },
      });
    });

    await recordPaymentEvent({ ...logContext, operation: "INITIALIZE", outcome: "SUCCESS" });
    return NextResponse.json({ redirectUrl: gatewayPageUrl, tranId });
  } catch (error) {
    await recordPaymentEvent({ ...logContext, operation: "INITIALIZE", outcome: "ERROR", detailCode: "INITIALIZE_REJECTED" });
    return NextResponse.json(
      { error: error instanceof PaymentControlError ? error.message : "Failed to initiate SSLCommerz payment" },
      { status: error instanceof PaymentControlError ? error.status : 500 },
    );
  }
}
