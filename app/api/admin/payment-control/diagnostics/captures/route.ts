import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { positiveId, paymentControlErrorResponse } from "@/lib/payment-control/authorization";
import { requireDiagnosticAccess } from "@/lib/payment-control/diagnostic-authorization";
import { captureProjection, requestCapture } from "@/lib/payment-control/capture";
import { readMonitorBody } from "@/lib/network-monitor/policy";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    await requireDiagnosticAccess(request);
    const paymentId = positiveId(request.nextUrl.searchParams.get("paymentId"));
    const [jobs, agent] = await Promise.all([
      prisma.paymentDiagnosticCapture.findMany({ where: { paymentId, expiresAt: { gt: new Date() } },
        select: captureProjection, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 }),
      process.env.PAYMENT_CAPTURE_AGENT_ID ? prisma.networkMonitorAgent.findUnique({ where: { id: process.env.PAYMENT_CAPTURE_AGENT_ID },
        select: { lastSeenAt: true } }) : null,
    ]);
    return NextResponse.json({ jobs, agent: { configured: Boolean(process.env.PAYMENT_CAPTURE_AGENT_ID),
      lastSeenAt: agent?.lastSeenAt ?? null, status: agent?.lastSeenAt && Date.now() - agent.lastSeenAt.getTime() < 60000 ? "ONLINE" : "NOT_OBSERVED" },
      enabled: process.env.PAYMENT_NETWORK_CAPTURE_ENABLED === "true" && process.env.PAYMENT_DIAGNOSTICS_ENABLED === "true" },
    { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const access = await requireDiagnosticAccess(request, "payments.diagnostics.capture", true);
    return NextResponse.json(await requestCapture(await readMonitorBody(request), access.userId!),
      { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
