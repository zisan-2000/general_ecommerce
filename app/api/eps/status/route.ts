import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { rateLimitRequest } from "@/lib/request-security";
import { verifyPaymentInitToken } from "@/lib/sslcommerz";
import { EpsError, reconcileEpsPayment } from "@/lib/eps";
import { epsObject } from "@/lib/eps-settings";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import { attachPaymentResult } from "@/lib/payment-result";
import { recordPaymentEvent } from "@/lib/payment-control/telemetry";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const limit = await rateLimitRequest(request, { scope: "eps-status", limit: 15, windowMs: 60_000 });
    if (!limit.allowed) throw new EpsError("Too many verification requests", 429);
    const body = epsObject(await request.json().catch(() => null));
    const orderId = Number(body.orderId);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new EpsError("Valid orderId is required", 400);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new EpsError("Order not found", 404);
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(session?.user as { id?: string; role?: string } | undefined);
    const owner = Boolean(order.userId && order.userId === access.userId);
    const guest = !order.userId && verifyPaymentInitToken(order.id, body.paymentInitToken);
    const admin = access.hasAny(["settings.payment.manage", "settings.manage"]);
    const adminPermission = access.hasGlobal("settings.payment.manage") ? "INITIATOR_ADMIN_PAYMENT_MANAGE"
      : access.hasGlobal("settings.manage") ? "INITIATOR_ADMIN_SETTINGS_MANAGE"
        : access.has("settings.payment.manage") ? "INITIATOR_ADMIN_SCOPED_PAYMENT_MANAGE"
          : access.has("settings.manage") ? "INITIATOR_ADMIN_SCOPED_SETTINGS_MANAGE" : "INITIATOR_ADMIN_AUTHORIZED";
    if (!owner && !guest && !admin) throw new EpsError("Forbidden", 403);
    const actorUserId = owner || admin ? access.userId ?? undefined : undefined;
    if (owner && actorUserId) await recordPaymentEvent({ provider: "EPS", requestId, orderId, actorUserId,
      operation: "DIAGNOSTIC", outcome: "SUCCESS", detailCode: "INITIATOR_AUTHENTICATED_CUSTOMER" });
    else if (admin && actorUserId) await recordPaymentEvent({ provider: "EPS", requestId, orderId, actorUserId,
      operation: "DIAGNOSTIC", outcome: "SUCCESS", detailCode: adminPermission });
    else if (guest) await recordPaymentEvent({ provider: "EPS", requestId, orderId,
      operation: "DIAGNOSTIC", outcome: "SUCCESS", detailCode: "INITIATOR_GUEST_RECONCILIATION" });
    const payment = await prisma.payment.findFirst({ where: { orderId, provider: "EPS",
      ...(typeof body.tranId === "string" ? { externalId: body.tranId } : {}),
    }, orderBy: { id: "desc" } });
    if (!payment?.externalId) throw new EpsError("EPS payment attempt was not found", 404);
    const result = await reconcileEpsPayment(payment.externalId, request, { requestId, actorUserId });
    revalidateStorefrontCatalog();
    const response = await attachPaymentResult(
      NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } }),
      payment.externalId,
      "EPS",
    );
    response.headers.set("X-Payment-Request-Id", requestId);
    return response;
  } catch (error) {
    const response = NextResponse.json({ error: error instanceof EpsError ? error.message : "EPS payment verification is unavailable" },
      { status: error instanceof EpsError ? error.status : 500 });
    response.headers.set("X-Payment-Request-Id", requestId);
    return response;
  }
}
