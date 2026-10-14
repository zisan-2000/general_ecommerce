import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePaymentControlAccess, paymentControlErrorResponse, PaymentControlError } from "@/lib/payment-control/authorization";
import { createPaymentDispute } from "@/lib/payment-control/disputes";
import { paymentProjection } from "@/lib/payment-control/queries";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    await requirePaymentControlAccess();
    const status = request.nextUrl.searchParams.get("status");
    if (status && !["OPEN", "INVESTIGATING", "RESOLVED", "REJECTED"].includes(status)) throw new PaymentControlError("Invalid dispute status");
    const page = Number(request.nextUrl.searchParams.get("page") || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new PaymentControlError("Invalid page");
    const where = status ? { status } : {};
    const [total, disputes] = await Promise.all([
      prisma.paymentDispute.count({ where }),
      prisma.paymentDispute.findMany({ where, include: { payment: { select: paymentProjection },
        assignedTo: { select: { id: true, name: true } } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 25, take: 25 }),
    ]);
    return NextResponse.json({ disputes, total, page, pageSize: 25 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const access = await requirePaymentControlAccess(request, true);
    return NextResponse.json({ dispute: await createPaymentDispute(await request.json(), access.userId!) },
      { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
