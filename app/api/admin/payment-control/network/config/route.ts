import { NextRequest, NextResponse } from "next/server";
import { paymentControlErrorResponse, requirePaymentControlAccess } from "@/lib/payment-control/authorization";
import { monitorConfiguration, saveMonitorConfiguration } from "@/lib/network-monitor/configuration";
import { readMonitorBody } from "@/lib/network-monitor/policy";
export const runtime = "nodejs";
export async function GET() {
  try {
    await requirePaymentControlAccess();
    return NextResponse.json(await monitorConfiguration(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const access = await requirePaymentControlAccess(request, true);
    const result = await saveMonitorConfiguration(await readMonitorBody(request), access.userId!);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
