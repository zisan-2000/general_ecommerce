import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { canAccessWarehouseWithPermission } from "@/lib/warehouse-scope";
import { createOrderNotification } from "@/lib/order-notifications";
import { logActivity } from "@/lib/activity-log";
import { syncCommissionEntriesForOrderStatus } from "@/lib/business-network/commission";
import { OrderStatus } from "@/generated/prisma";

type RefundDecision = "ACCEPT" | "REJECT";

export async function PATCH(
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
    const decision = String(body?.decision || "").toUpperCase() as RefundDecision;
    const adminNote = String(body?.adminNote || "").trim();

    if (decision !== "ACCEPT" && decision !== "REJECT") {
      return NextResponse.json(
        { error: "Decision must be ACCEPT or REJECT." },
        { status: 400 },
      );
    }
    if (decision === "REJECT" && adminNote.length < 3) {
      return NextResponse.json(
        { error: "A rejection note is required." },
        { status: 400 },
      );
    }
    if (adminNote.length > 1000) {
      return NextResponse.json(
        { error: "Admin note cannot exceed 1000 characters." },
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
        amount: true,
        quantity: true,
        orderItem: { select: { product: { select: { name: true } } } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Refund request not found." }, { status: 404 });
    }
    if (existing.status !== "REQUESTED") {
      return NextResponse.json(
        { error: "This refund request has already been reviewed." },
        { status: 409 },
      );
    }

    if (!access.hasGlobal("orders.update")) {
      const shipments = await prisma.shipment.findMany({
        where: { orderId: existing.orderId },
        select: { warehouseId: true },
      });
      const canReview = shipments.some((shipment) =>
        canAccessWarehouseWithPermission(
          access,
          "orders.update",
          shipment.warehouseId,
        ),
      );
      if (!canReview) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const nextStatus = decision === "ACCEPT" ? "APPROVED" : "REJECTED";
    const reviewedAt = new Date();
    const refund = await prisma.$transaction(async (tx) => {
      const claimed = await tx.refund.updateMany({
        where: { id: refundId, status: "REQUESTED" },
        data: {
          status: nextStatus,
          adminNote: adminNote || null,
          reviewedAt,
          reviewedById: access.userId,
        },
      });

      if (claimed.count !== 1) return null;

      if (decision === "ACCEPT") {
        await tx.order.update({
          where: { id: existing.orderId },
          data: { status: "REFUNDED" },
        });
        await syncCommissionEntriesForOrderStatus({
          tx,
          orderId: existing.orderId,
          orderStatus: OrderStatus.REFUNDED,
          actorUserId: access.userId,
          request,
        });
      }

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
        },
      });

      const productName = existing.orderItem?.product?.name || "an order item";
      await createOrderNotification({
        tx,
        userId: existing.userId,
        orderId: existing.orderId,
        title: decision === "ACCEPT" ? "Refund approved" : "Refund rejected",
        message:
          decision === "ACCEPT"
            ? `Your refund for ${productName} has been accepted. The refund payment is now pending.`
            : `Your refund request for ${productName} was rejected.${adminNote ? ` Reason: ${adminNote}` : ""}`,
        metadata: {
          event: decision === "ACCEPT" ? "REFUND_APPROVED" : "REFUND_REJECTED",
          refundId,
          status: nextStatus,
        },
      });

      return updated;
    });

    if (!refund) {
      return NextResponse.json(
        { error: "This refund request has already been reviewed." },
        { status: 409 },
      );
    }

    await logActivity({
      action: decision === "ACCEPT" ? "accept_refund" : "reject_refund",
      entity: "refund",
      entityId: refund.id,
      access,
      request,
      metadata: {
        message: `${decision === "ACCEPT" ? "Accepted" : "Rejected"} refund #${refund.id} for order #${refund.orderId}`,
      },
      before: { status: existing.status },
      after: {
        status: refund.status,
        adminNote: refund.adminNote,
        reviewedAt: refund.reviewedAt,
        reviewedById: refund.reviewedById,
      },
    });

    return NextResponse.json({
      refund,
      orderStatus: decision === "ACCEPT" ? "REFUNDED" : undefined,
    });
  } catch (error) {
    console.error("Failed to review refund:", error);
    return NextResponse.json(
      { error: "Failed to review refund request." },
      { status: 500 },
    );
  }
}
