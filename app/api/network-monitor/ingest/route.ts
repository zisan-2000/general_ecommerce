import { NextRequest, NextResponse } from "next/server";
import { PaymentControlError, paymentControlErrorResponse } from "@/lib/payment-control/authorization";
import { rateLimitRequest } from "@/lib/request-security";
import { readMonitorBody, requireCollector } from "@/lib/network-monitor/policy";
import { ingestNetworkSample } from "@/lib/network-monitor/ingestion";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const agent = await requireCollector(request);
    const limit = await rateLimitRequest(request, { scope: "network-collector", identifier: agent.id, limit: 4, windowMs: 60000 });
    if (!limit.allowed) throw new PaymentControlError("Collector rate limit exceeded", 429);
    return NextResponse.json(await ingestNetworkSample(agent.id, await readMonitorBody(request)),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
