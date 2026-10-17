import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AiblWalletError, aiblWalletPublicOrigin, reconcileAiblWalletPayment, verifyAiblCallbackState } from "@/lib/aibl-wallet";
import { aiblMoney } from "@/lib/aibl-wallet-settings";
import { clearAiblPending, readAiblBody } from "@/lib/aibl-wallet-http";
import { attachPaymentResult } from "@/lib/payment-result";
import { recordPaymentEvent } from "@/lib/payment-control/telemetry";
import { rateLimitRequest } from "@/lib/request-security";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
export async function handleAiblWalletCallback(request: NextRequest) {
  let trustedBill: string | undefined;
  let success = false;
  try {
    const limit = await rateLimitRequest(request, { scope: "aibl-wallet-callback", limit: 30, windowMs: 60000 });
    if (!limit.allowed) throw new AiblWalletError("Payment callback rate limit exceeded", 429);
    const bill = request.nextUrl.searchParams.get("attempt") || "";
    if (!verifyAiblCallbackState(bill, request.nextUrl.searchParams.get("state") || "")) throw new AiblWalletError("Invalid signed callback state", 400);
    const payment = await prisma.payment.findUnique({ where: { externalId: bill } });
    if (!payment?.orderId || payment.provider !== "AIBL_WALLET") throw new AiblWalletError("Unknown payment callback", 400);
    const body = await readAiblBody(request);
    if (body.BILLNO !== bill || !aiblMoney(body.AMOUNT) || aiblMoney(body.AMOUNT) !== aiblMoney(payment.amount?.toString())) {
      await recordPaymentEvent({ provider: "AIBL_WALLET", transactionId: bill, operation: "CALLBACK", outcome: "MISMATCH", detailCode: "CALLBACK_REFERENCE_MISMATCH" });
      throw new AiblWalletError("Invalid callback bill or amount", 400);
    }
    const transactionId = body.TRANSNO;
    if (transactionId !== undefined && transactionId !== "" &&
        (typeof transactionId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(transactionId))) throw new AiblWalletError("Invalid callback transaction reference", 400);
    trustedBill = bill;
    // SESSIONKEY/MESSAGE are neither trusted nor persisted. STATUS/RESCODE never settle an order.
    await recordPaymentEvent({ provider: "AIBL_WALLET", paymentId: payment.id, orderId: payment.orderId,
      transactionId: bill, operation: "CALLBACK", outcome: "RECEIVED", detailCode:
        request.nextUrl.pathname.endsWith("/approved") ? "CALLBACK_SUCCESS" : request.nextUrl.pathname.endsWith("/decline") ? "CALLBACK_FAIL" : "CALLBACK_CANCEL" });
    const result = await reconcileAiblWalletPayment(bill, request, typeof transactionId === "string" && transactionId ? transactionId : undefined);
    success = result.status === "success";
    revalidateStorefrontCatalog();
  } catch (error) {
    await recordPaymentEvent({ provider: "AIBL_WALLET", transactionId: trustedBill, operation: "CALLBACK",
      outcome: error instanceof AiblWalletError && error.status === 400 ? "REJECTED" : "ERROR", detailCode: "INVALID_CALLBACK" });
  }
  let origin: string;
  try { origin = aiblWalletPublicOrigin(); } catch { return NextResponse.json({ error: "Payment result origin is unavailable" }, { status: 503 }); }
  const response = NextResponse.redirect(new URL("/ecommerce/payment-result", origin), 303);
  if (success) clearAiblPending(response);
  return attachPaymentResult(response, trustedBill, "AIBL_WALLET");
}
