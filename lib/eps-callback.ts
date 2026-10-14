import { NextRequest, NextResponse } from "next/server";
import { EpsError, epsPublicOrigin, reconcileEpsPayment, verifyEpsCallbackState } from "@/lib/eps";
import { epsObject } from "@/lib/eps-settings";
import { rateLimitRequest } from "@/lib/request-security";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";

export async function handleEpsCallback(request: NextRequest) {
  let status = "pending";
  let message = "EPS payment could not be verified yet. Please check payment status.";
  try {
    const attempt = request.nextUrl.searchParams.get("attempt") ?? "";
    const state = request.nextUrl.searchParams.get("state") ?? "";
    if (!verifyEpsCallbackState(attempt, state)) throw new EpsError("Invalid payment callback", 400);
    const limit = await rateLimitRequest(request, { scope: "eps-callback", limit: 30, windowMs: 60_000 });
    if (!limit.allowed) throw new EpsError("Payment verification is busy; please check again shortly", 429);
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
      if (posted[key] !== undefined && posted[key] !== attempt) throw new EpsError("Callback transaction ID does not match", 400);
    }
    const result = await reconcileEpsPayment(attempt, request);
    status = result.status;
    message = result.message;
    revalidateStorefrontCatalog();
  } catch (error) {
    if (error instanceof EpsError) message = error.message;
  }
  let origin: string;
  try { origin = epsPublicOrigin(); }
  catch { return NextResponse.json({ status, message: "EPS callback origin is not configured" }, { status: 503 }); }
  const url = new URL("/ecommerce/payment-result", origin);
  url.searchParams.set("status", status);
  url.searchParams.set("message", message);
  // No customer/order details or guest authorization tokens appear in the return URL.
  return NextResponse.redirect(url, 303);
}
