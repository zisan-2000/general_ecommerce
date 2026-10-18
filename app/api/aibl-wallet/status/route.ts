import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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
    const payment = await prisma.payment.findFirst({ where: { orderId: order.id, provider: "AIBL_WALLET",
      ...(body.tranId !== undefined ? { externalId: String(body.tranId) } : {}) }, orderBy: { id: "desc" } });
    if (!payment?.externalId) throw new AiblWalletError("AIBL payment attempt not found", 404);
    const result = await reconcileAiblWalletPayment(payment.externalId, request, undefined, requestId);
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
