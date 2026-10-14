import { NextRequest, NextResponse } from "next/server";
import { requirePaymentControlAccess, paymentControlErrorResponse, PaymentControlError } from "@/lib/payment-control/authorization";
import { updatePaymentDispute } from "@/lib/payment-control/disputes";
import { prisma } from "@/lib/prisma";
import { paymentProjection } from "@/lib/payment-control/queries";
export const runtime = "nodejs";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePaymentControlAccess();
    const dispute = await prisma.paymentDispute.findUnique({ where: { id: (await params).id }, include: {
      assignedTo: { select: { id: true, name: true } }, payment: { select: paymentProjection },
      evidence: { orderBy: { createdAt: "desc" }, take: 100 }, activities: { orderBy: { createdAt: "desc" }, take: 100 },
    } });
    if (!dispute) throw new PaymentControlError("Dispute not found", 404);
    return NextResponse.json({ dispute }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requirePaymentControlAccess(request, true);
    return NextResponse.json({ dispute: await updatePaymentDispute((await params).id, await request.json(), access.userId!) },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
