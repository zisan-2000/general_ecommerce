import { NextRequest } from "next/server";
import { requirePaymentControlAccess, paymentControlErrorResponse } from "@/lib/payment-control/authorization";
import { paymentCsv } from "@/lib/payment-control/queries";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    await requirePaymentControlAccess();
    return new Response(await paymentCsv(request.nextUrl.searchParams), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="payment-history.csv"',
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
