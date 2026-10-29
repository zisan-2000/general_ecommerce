import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { initializeAiblWalletOrder, AiblWalletError } from "@/lib/aibl-wallet";
import { aiblErrorResponse, attachAiblPending, authorizeAiblOrder, readAiblBody, requireAiblSameOrigin } from "@/lib/aibl-wallet-http";
import { rateLimitRequest } from "@/lib/request-security";
import { recordPaymentEvent } from "@/lib/payment-control/telemetry";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  let authorizedOrderId: number | undefined;
  let actorUserId: string | undefined;
  try {
    requireAiblSameOrigin(request);
    const limit = await rateLimitRequest(request, { scope: "aibl-wallet-init", limit: 10, windowMs: 600000 });
    if (!limit.allowed) throw new AiblWalletError("Too many payment initialization requests", 429);
    const body = await readAiblBody(request); const order = await authorizeAiblOrder(request, body);
    authorizedOrderId = order.id;
    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    if (sessionUserId && order.userId === sessionUserId) {
      actorUserId = sessionUserId;
      await recordPaymentEvent({ provider: "AIBL_WALLET", requestId, orderId: order.id, actorUserId,
        operation: "DIAGNOSTIC", outcome: "SUCCESS", detailCode: "INITIATOR_AUTHENTICATED_CUSTOMER" });
    } else await recordPaymentEvent({ provider: "AIBL_WALLET", requestId, orderId: order.id,
      operation: "DIAGNOSTIC", outcome: "SUCCESS", detailCode: "INITIATOR_GUEST_CHECKOUT" });
    const result = await initializeAiblWalletOrder(order.id, body.gatewayId, { requestId, actorUserId });
    const response = attachAiblPending(NextResponse.json(result), order.id);
    response.headers.set("X-Payment-Request-Id", requestId);
    return response;
  } catch (error) {
    if (authorizedOrderId) await recordPaymentEvent({ provider: "AIBL_WALLET", orderId: authorizedOrderId,
      requestId, actorUserId, operation: "INITIALIZE", outcome: "ERROR", detailCode: "INITIALIZE_REJECTED" });
    const response = aiblErrorResponse(error);
    response.headers.set("X-Payment-Request-Id", requestId);
    return authorizedOrderId ? attachAiblPending(response, authorizedOrderId) : response;
  }
}
