import { NextRequest, NextResponse } from "next/server";
import { EpsError, epsPublicOrigin, reconcileEpsPayment, verifyEpsCallbackState } from "@/lib/eps";
import { epsObject } from "@/lib/eps-settings";
import { rateLimitRequest } from "@/lib/request-security";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import { recordPaymentEvent, type PaymentLogContext } from "@/lib/payment-control/telemetry";
import { attachPaymentResult } from "@/lib/payment-result";

export async function handleEpsCallback(request: NextRequest) {
  let status = "pending";
  let message = "EPS payment could not be verified yet. Please check payment status.";
  let logContext: PaymentLogContext = { provider: "EPS" };
  try {
    const attempt = request.nextUrl.searchParams.get("attempt") ?? "";
    const state = request.nextUrl.searchParams.get("state") ?? "";
    const limit = await rateLimitRequest(request, { scope: "eps-callback", limit: 30, windowMs: 60_000 });
    if (!limit.allowed) throw new EpsError("Payment verification is busy; please check again shortly", 429);
    if (!verifyEpsCallbackState(attempt, state)) throw new EpsError("Invalid payment callback", 400);
    logContext = { provider: "EPS", transactionId: attempt };
    await recordPaymentEvent({ ...logContext, operation: "CALLBACK", outcome: "RECEIVED", detailCode:
      request.nextUrl.pathname.endsWith("/success") ? "CALLBACK_SUCCESS" : request.nextUrl.pathname.endsWith("/fail")
        ? "CALLBACK_FAIL" : "CALLBACK_CANCEL" });
    let posted: Record<string, unknown> = Object.fromEntries(request.nextUrl.searchParams);
    if (request.method === "POST") {
      const type = request.headers.get("content-type") ?? "";
      if (type.includes("application/json")) posted = { ...posted, ...epsObject(await request.json().catch(() => null)) };
      else {
        const form = await request.formData().catch(() => null);
        if (form) posted = { ...posted, ...Object.fromEntries(form) };
      }
    }
    // Browser fields select no DB record and are never evidence of payment success.
    for (const key of ["MerchantTransactionId", "merchantTransactionId"]) {
      if (posted[key] !== undefined && posted[key] !== attempt) {
        await recordPaymentEvent({ provider: "EPS", transactionId: attempt, operation: "CALLBACK",
          outcome: "MISMATCH", detailCode: "CALLBACK_REFERENCE_MISMATCH" });
        throw new EpsError("Callback transaction ID does not match", 400);
      }
    }
    const result = await reconcileEpsPayment(attempt, request);
    status = result.status;
    message = result.message;
    revalidateStorefrontCatalog();
  } catch (error) {
    if (!(error instanceof EpsError && error.status === 429)) {
      await recordPaymentEvent({ ...logContext, operation: "CALLBACK", outcome: error instanceof EpsError && error.status === 400 ? "REJECTED" : "ERROR",
        detailCode: error instanceof EpsError && error.status === 400 ? "INVALID_CALLBACK" : "STATUS_CHECK_FAILED" });
    }
    if (error instanceof EpsError) message = error.message;
  }
  let origin: string;
  try { origin = epsPublicOrigin(); }
  catch { return NextResponse.json({ status, message: "EPS callback origin is not configured" }, { status: 503 }); }
  const url = new URL("/ecommerce/payment-result", origin);
  url.searchParams.set("status", status);
  url.searchParams.set("message", message);
  // No customer/order details or guest authorization tokens appear in the return URL.
  return attachPaymentResult(NextResponse.redirect(url, 303), logContext.transactionId, "EPS");
}
