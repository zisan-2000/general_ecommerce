import { NextRequest, NextResponse } from "next/server";
import { requireDiagnosticAccess } from "@/lib/payment-control/diagnostic-authorization";
import { paymentControlErrorResponse } from "@/lib/payment-control/authorization";
import { diagnosticOverview } from "@/lib/payment-control/diagnostic-overview";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    await requireDiagnosticAccess(request);
    return NextResponse.json(await diagnosticOverview(request.nextUrl.searchParams), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
