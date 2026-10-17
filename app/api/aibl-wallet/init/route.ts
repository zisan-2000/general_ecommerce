import { NextRequest, NextResponse } from "next/server";
import { initializeAiblWalletOrder, AiblWalletError } from "@/lib/aibl-wallet";
import { aiblErrorResponse, attachAiblPending, authorizeAiblOrder, readAiblBody, requireAiblSameOrigin } from "@/lib/aibl-wallet-http";
import { rateLimitRequest } from "@/lib/request-security";
import { recordPaymentEvent } from "@/lib/payment-control/telemetry";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  let authorizedOrderId: number | undefined;
  try {
    requireAiblSameOrigin(request);
    const limit = await rateLimitRequest(request, { scope: "aibl-wallet-init", limit: 10, windowMs: 600000 });
    if (!limit.allowed) throw new AiblWalletError("Too many payment initialization requests", 429);
    const body = await readAiblBody(request); const order = await authorizeAiblOrder(request, body);
    authorizedOrderId = order.id;
    const result = await initializeAiblWalletOrder(order.id, body.gatewayId);
    return attachAiblPending(NextResponse.json(result), order.id);
  } catch (error) {
    if (authorizedOrderId) await recordPaymentEvent({ provider: "AIBL_WALLET", orderId: authorizedOrderId,
      operation: "INITIALIZE", outcome: "ERROR", detailCode: "INITIALIZE_REJECTED" });
    const response = aiblErrorResponse(error);
    return authorizedOrderId ? attachAiblPending(response, authorizedOrderId) : response;
  }
}
