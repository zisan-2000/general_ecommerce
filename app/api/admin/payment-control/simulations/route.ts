import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePaymentControlAccess, paymentControlErrorResponse } from "@/lib/payment-control/authorization";
import { createSandboxSimulation, sandboxSimulationAvailability } from "@/lib/payment-control/simulation";
export const runtime = "nodejs";
export async function GET() {
  try {
    await requirePaymentControlAccess();
    const runs = await prisma.paymentSandboxRun.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 25 });
    return NextResponse.json({ runs, ...sandboxSimulationAvailability() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const access = await requirePaymentControlAccess(request, true);
    return NextResponse.json({ run: await createSandboxSimulation(await request.json(), access.userId!) },
      { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
