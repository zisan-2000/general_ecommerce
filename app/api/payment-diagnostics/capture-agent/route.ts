import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCaptureAgent, claimCaptureJob } from "@/lib/payment-control/capture";
import { paymentControlErrorResponse } from "@/lib/payment-control/authorization";
import { rateLimitRequest } from "@/lib/request-security";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const agentId = await requireCaptureAgent(request);
    const limit = await rateLimitRequest(request, { scope: "capture-agent-poll", identifier: agentId, limit: 30, windowMs: 60000 });
    if (!limit.allowed) return new Response(null, { status: 429 });
    await prisma.networkMonitorAgent.upsert({ where: { id: agentId }, create: { id: agentId, label: "Payment capture agent",
      enabled: false, createdById: "CAPTURE_SERVICE", lastSeenAt: new Date() }, update: { lastSeenAt: new Date() } });
    return NextResponse.json({ job: await claimCaptureJob(agentId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
