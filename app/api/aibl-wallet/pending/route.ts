import { NextRequest, NextResponse } from "next/server";
import { aiblPendingCookie, authorizeAiblOrder, clearAiblPending } from "@/lib/aibl-wallet-http";
import { prisma } from "@/lib/prisma";
import { attachPaymentResult } from "@/lib/payment-result";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const pending = aiblPendingCookie(request);
    const order = pending ? await authorizeAiblOrder(request, { orderId: pending.orderId }) : null;
    if (order?.paymentStatus === "PAID") {
      const payment = await prisma.payment.findFirst({ where: { orderId: order.id, provider: "AIBL_WALLET", status: "CAPTURED" }, select: { externalId: true } });
      if (payment?.externalId) return attachPaymentResult(clearAiblPending(NextResponse.json({ pending: null, completed: true })), payment.externalId, "AIBL_WALLET");
    }
    return NextResponse.json({ pending: order && order.paymentStatus === "UNPAID" && ["PENDING", "CONFIRMED"].includes(order.status)
      ? { orderId: order.id } : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ pending: null }, { headers: { "Cache-Control": "private, no-store" } }); }
}
