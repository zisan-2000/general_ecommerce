import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paymentControlErrorResponse } from "@/lib/payment-control/authorization";
import { approvedTarget, requireCollector } from "@/lib/network-monitor/policy";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const agent = await requireCollector(request);
    const targets = await prisma.networkProbeTarget.findMany({ where: { agentId: agent.id, enabled: true }, take: 4,
      select: { id: true, version: true, address: true, protocol: true, port: true, intervalSeconds: true, timeoutMs: true } });
    // Removal from the operator's allowlist immediately removes a target from collector config.
    const approved = targets.filter((target) => { try { approvedTarget(target); return true; } catch { return false; } });
    return NextResponse.json({ agentId: agent.id, hostIntervalSeconds: 60, leaseSeconds: 180, targets: approved },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
