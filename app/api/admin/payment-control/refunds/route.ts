import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePaymentControlAccess, paymentControlErrorResponse, PaymentControlError } from "@/lib/payment-control/authorization";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    await requirePaymentControlAccess();
    const status = request.nextUrl.searchParams.get("status");
    const page = Number(request.nextUrl.searchParams.get("page") || 1);
    if (status && !["REQUESTED", "APPROVED", "REJECTED", "COMPLETED"].includes(status)) throw new PaymentControlError("Invalid refund status");
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new PaymentControlError("Invalid page");
    const where = { order: { payment_method: { startsWith: "EPS:" } } };
    const refundWhere = { OR: [where, { order: { payment_method: { startsWith: "SSLCOMMERZ:" } } }, { order: { payment_method: { startsWith: "AIBL_WALLET:" } } }],
      ...(status ? { status: status as "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED" } : {}) };
    const [total, refunds] = await Promise.all([
      prisma.refund.count({ where: refundWhere }),
      prisma.refund.findMany({ where: refundWhere, select: {
        id: true, orderId: true, paymentId: true, amount: true, status: true, payoutStatus: true,
        payoutTransactionId: true, reviewedAt: true, paidAt: true, createdAt: true,
        order: { select: { payment_method: true, paymentStatus: true } },
      }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 25, take: 25 }),
    ]);
    return NextResponse.json({ refunds, total, page, pageSize: 25 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
