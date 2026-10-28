import { NextRequest, NextResponse } from "next/server";
import {
  paymentControlErrorResponse,
  requirePaymentControlAccess,
} from "@/lib/payment-control/authorization";
import { getTechnicalRequestInspector } from "@/lib/payment-control/request-inspector";

export const runtime = "nodejs";
type Context = { params: Promise<{ requestId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    await requirePaymentControlAccess();
    const { requestId } = await context.params;
    const data = await getTechnicalRequestInspector(
      requestId,
      request.nextUrl.searchParams,
    );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return paymentControlErrorResponse(error);
  }
}
