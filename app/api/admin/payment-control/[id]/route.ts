import { NextRequest, NextResponse } from "next/server";
import { requirePaymentControlAccess, paymentControlErrorResponse, positiveId } from "@/lib/payment-control/authorization";
import { getPaymentDetails } from "@/lib/payment-control/queries";
import { compareGatewayPayment } from "@/lib/payment-control/reconciliation";

export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    await requirePaymentControlAccess();
    return NextResponse.json(await getPaymentDetails(positiveId((await context.params).id), request.nextUrl.searchParams.get("before")),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const access = await requirePaymentControlAccess(request, true);
    const result = await compareGatewayPayment(positiveId((await context.params).id), access.userId!);
    return NextResponse.json({ reconciliation: result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
