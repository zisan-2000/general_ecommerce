import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { canAccessWarehouseWithPermission } from "@/lib/warehouse-scope";
import { createOrderNotification } from "@/lib/order-notifications";
import { logActivity } from "@/lib/activity-log";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(
      session?.user as { id?: string; role?: string } | undefined,
    );
    if (!access.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!access.has("orders.update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const refundId = Number(id);
    if (!Number.isInteger(refundId) || refundId <= 0) {
      return NextResponse.json({ error: "Invalid refund id." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const transactionId = String(body?.transactionId || "").trim();
    if (transactionId.length < 3 || transactionId.length > 200) {
      return NextResponse.json(
        { error: "Please provide a valid refund transaction/reference." },
        { status: 400 },
      );
    }

    const existing = await prisma.refund.findUnique({
      where: { id: refundId },
      select: {
        id: true,
        orderId: true,
        userId: true,
        status: true,
        payoutStatus: true,
        refundMethod: true,
        refundAccount: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Refund request not found." }, { status: 404 });
    }
    if (existing.status !== "APPROVED" || existing.payoutStatus !== "PENDING") {
      return NextResponse.json(
        { error: "This refund is not awaiting payment." },
        { status: 409 },
      );
    }

    if (!access.hasGlobal("orders.update")) {
      const shipments = await prisma.shipment.findMany({
        where: { orderId: existing.orderId },
        select: { warehouseId: true },
      });
      const canPay = shipments.some((shipment) =>
        canAccessWarehouseWithPermission(
          access,
          "orders.update",
          shipment.warehouseId,
        ),
      );
      if (!canPay) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const paidAt = new Date();
    const refund = await prisma.$transaction(async (tx) => {
      const claimed = await tx.refund.updateMany({
        where: {
          id: refundId,
          status: "APPROVED",
          payoutStatus: "PENDING",
        },
        data: {
          status: "COMPLETED",
          payoutStatus: "PAID",
          payoutTransactionId: transactionId,
          paidAt,
          paidById: access.userId,
        },
      });
      if (claimed.count !== 1) return null;

      await tx.order.update({
        where: { id: existing.orderId },
        data: { status: "REFUNDED", paymentStatus: "REFUNDED" },
      });

      const updated = await tx.refund.findUniqueOrThrow({
        where: { id: refundId },
        include: {
          orderItem: {
            select: {
              id: true,
              quantity: true,
              product: { select: { id: true, name: true } },
            },
          },
          reviewedBy: { select: { id: true, name: true } },
          paidBy: { select: { id: true, name: true } },
        },
      });

      await createOrderNotification({
        tx,
        userId: existing.userId,
        orderId: existing.orderId,
        title: "Refund payment sent",
        message: `Your refund was sent through ${existing.refundMethod}${existing.refundAccount ? ` to ${existing.refundAccount}` : ""}. Reference: ${transactionId}.`,
        metadata: {
          event: "REFUND_PAID",
          refundId,
          transactionId,
        },
      });
      return updated;
    });

    if (!refund) {
      return NextResponse.json(
        { error: "This refund payment has already been recorded." },
        { status: 409 },
      );
    }

    await logActivity({
      action: "pay_refund",
      entity: "refund",
      entityId: refund.id,
      access,
      request,
      metadata: {
        message: `Recorded refund payment #${refund.id} for order #${refund.orderId}`,
      },
      before: { status: existing.status, payoutStatus: existing.payoutStatus },
      after: {
        status: refund.status,
        payoutStatus: refund.payoutStatus,
        payoutTransactionId: refund.payoutTransactionId,
        paidAt: refund.paidAt,
      },
    });

    return NextResponse.json({
      refund,
      orderStatus: "REFUNDED",
      paymentStatus: "REFUNDED",
    });
  } catch (error) {
    console.error("Failed to record refund payment:", error);
    return NextResponse.json(
      { error: "Failed to record refund payment." },
      { status: 500 },
    );
  }
}
