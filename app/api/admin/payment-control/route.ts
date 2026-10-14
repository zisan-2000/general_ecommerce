import { NextRequest, NextResponse } from "next/server";
import { requirePaymentControlAccess, paymentControlErrorResponse } from "@/lib/payment-control/authorization";
import { getPaymentHistory, paymentOverview } from "@/lib/payment-control/queries";
import { paymentStaffOptions } from "@/lib/payment-control/disputes";
import { sandboxSimulationAvailability } from "@/lib/payment-control/simulation";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const access = await requirePaymentControlAccess();
    const [history, overview, staff] = await Promise.all([
      getPaymentHistory(request.nextUrl.searchParams), paymentOverview(request.nextUrl.searchParams), paymentStaffOptions(),
    ]);
    return NextResponse.json({ ...history, ...overview, staff, simulations: sandboxSimulationAvailability(),
      canRecordRefund: access.hasGlobal("orders.update") }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
