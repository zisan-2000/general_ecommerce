import { NextRequest, NextResponse } from "next/server";
import { getPublicBaseUrl, processSslcommerzCallback } from "@/lib/sslcommerz";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import { attachPaymentResult } from "@/lib/payment-result";

async function handle(request: NextRequest) {
  const result = await processSslcommerzCallback(request, "cancel");
  revalidateStorefrontCatalog();
  const url = new URL("/ecommerce/payment-result", getPublicBaseUrl(request));
  url.searchParams.set("status", result.status);
  url.searchParams.set("message", result.message);
  if (result.orderId) url.searchParams.set("orderId", String(result.orderId));
  return attachPaymentResult(NextResponse.redirect(url, 303), result.resultTransactionId, "SSLCOMMERZ");
}

export const POST = handle;
export const GET = handle;
