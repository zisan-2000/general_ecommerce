import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { recordPaymentEvent } from "@/lib/payment-control/telemetry";
import { prisma } from "@/lib/prisma";
import { AiblWalletError, reconcileAiblWalletPayment } from "@/lib/aibl-wallet";
import { aiblErrorResponse, authorizeAiblOrder, clearAiblPending, readAiblBody, requireAiblSameOrigin } from "@/lib/aibl-wallet-http";
import { rateLimitRequest } from "@/lib/request-security";
import { attachPaymentResult } from "@/lib/payment-result";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  try {
    requireAiblSameOrigin(request);
    const limit = await rateLimitRequest(request, { scope: "aibl-wallet-status", limit: 12, windowMs: 60000 });
    if (!limit.allowed) throw new AiblWalletError("Too many payment verification requests", 429);
    const body = await readAiblBody(request); const order = await authorizeAiblOrder(request, body, true);
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(session?.user as { id?: string; role?: string } | undefined);
    const adminPermission = access.hasGlobal("settings.payment.manage") ? "INITIATOR_ADMIN_PAYMENT_MANAGE"
      : access.hasGlobal("settings.manage") ? "INITIATOR_ADMIN_SETTINGS_MANAGE" : null;
    const actorUserId = access.userId && (order.userId === access.userId ||
      adminPermission !== null)
      ? access.userId
      : undefined;
    if (actorUserId && order.userId === actorUserId) await recordPaymentEvent({ provider: "AIBL_WALLET", requestId,
      orderId: order.id, actorUserId, operation: "DIAGNOSTIC", outcome: "SUCCESS", detailCode: "INITIATOR_AUTHENTICATED_CUSTOMER" });
    else if (actorUserId) await recordPaymentEvent({ provider: "AIBL_WALLET", requestId, orderId: order.id, actorUserId,
      operation: "DIAGNOSTIC", outcome: "SUCCESS", detailCode: adminPermission ?? "INITIATOR_ADMIN_AUTHORIZED" });
    else await recordPaymentEvent({ provider: "AIBL_WALLET", requestId, orderId: order.id,
      operation: "DIAGNOSTIC", outcome: "SUCCESS", detailCode: "INITIATOR_GUEST_RECONCILIATION" });
    const payment = await prisma.payment.findFirst({ where: { orderId: order.id, provider: "AIBL_WALLET",
      ...(body.tranId !== undefined ? { externalId: String(body.tranId) } : {}) }, orderBy: { id: "desc" } });
    if (!payment?.externalId) throw new AiblWalletError("AIBL payment attempt not found", 404);
    const result = await reconcileAiblWalletPayment(payment.externalId, request, undefined, requestId, actorUserId);
    revalidateStorefrontCatalog();
    const response = NextResponse.json(result);
    response.headers.set("X-Payment-Request-Id", requestId);
    if (result.status === "success") clearAiblPending(response);
    return attachPaymentResult(response, payment.externalId, "AIBL_WALLET");
  } catch (error) {
    const response = aiblErrorResponse(error);
    response.headers.set("X-Payment-Request-Id", requestId);
    return response;
  }
}
