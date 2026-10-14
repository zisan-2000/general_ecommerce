import { NextRequest, NextResponse } from "next/server";
import { paymentControlErrorResponse, requirePaymentControlAccess } from "@/lib/payment-control/authorization";
import { networkOverview } from "@/lib/network-monitor/queries";
import { jsonSafe } from "@/lib/network-monitor/policy";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    await requirePaymentControlAccess();
    return NextResponse.json(jsonSafe(await networkOverview(request.nextUrl.searchParams)), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
