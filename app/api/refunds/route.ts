import { NextRequest, NextResponse } from "next/server";
import { createOrderAdminNotifications } from "@/lib/order-admin-notifications";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@/generated/prisma";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";

const REFUND_WINDOW_DAYS = 7;
const REFUNDABLE_STATUSES = new Set(["REQUESTED", "APPROVED", "COMPLETED"]);

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toPositiveInt(value: unknown, fallback = 1) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(
      session?.user as { id?: string; role?: string } | undefined,
    );

    if (!access.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const orderItemId = Number(body?.orderItemId);
    const reason = String(body?.reason || "").trim();
    const quantity = toPositiveInt(body?.quantity, 1);

    if (!Number.isInteger(orderItemId) || orderItemId <= 0) {
      return NextResponse.json({ error: "Invalid order item." }, { status: 400 });
    }

    if (reason.length < 10) {
      return NextResponse.json(
        { error: "Please provide a clear refund reason." },
        { status: 400 },
      );
    }

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: {
          select: {
            id: true,
            userId: true,
            status: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        refunds: {
          select: {
            quantity: true,
            status: true,
          },
        },
      },
    });

    if (!orderItem) {
      return NextResponse.json({ error: "Order item not found." }, { status: 404 });
    }

    if (orderItem.order.userId !== access.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const shipment = await prisma.shipment.findUnique({
      where: { orderId: orderItem.orderId },
      select: {
        id: true,
        status: true,
        deliveredAt: true,
      },
    });

    const deliveredAt = shipment?.deliveredAt ?? null;
    if (!shipment || shipment.status?.toUpperCase() !== "DELIVERED" || !deliveredAt) {
      return NextResponse.json(
        { error: "Refunds are available only after delivery." },
        { status: 400 },
      );
    }

    const refundDeadline = addDays(new Date(deliveredAt), REFUND_WINDOW_DAYS);
    if (Date.now() > refundDeadline.getTime()) {
      return NextResponse.json(
        {
          error: `Refund window expired. You can request a refund within ${REFUND_WINDOW_DAYS} days of delivery.`,
        },
        { status: 400 },
      );
    }

    const reservedQuantity = (orderItem.refunds || []).reduce((sum, refund) => {
      if (!REFUNDABLE_STATUSES.has(String(refund.status))) {
        return sum;
      }
      return sum + Math.max(0, Number(refund.quantity) || 0);
    }, 0);

    const availableQuantity = Math.max(orderItem.quantity - reservedQuantity, 0);
    if (availableQuantity <= 0) {
      return NextResponse.json(
        { error: "This product has already been fully refunded." },
        { status: 400 },
      );
    }

    const requestedQuantity = Math.min(quantity, availableQuantity);
    if (requestedQuantity <= 0) {
      return NextResponse.json(
        { error: "Refund quantity must be at least 1." },
        { status: 400 },
      );
    }

    const amount = roundMoney(Number(orderItem.price) * requestedQuantity);

    const created = await prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          orderId: orderItem.orderId,
          orderItemId: orderItem.id,
          userId: access.userId,
          amount: new Prisma.Decimal(amount),
          quantity: requestedQuantity,
          reason,
          status: "REQUESTED",
        },
      });

      await logActivity({
        action: "create_refund",
        entity: "refund",
        entityId: refund.id,
        access,
        request,
        metadata: {
          message: `Refund requested for order #${orderItem.orderId} item #${orderItem.id}`,
        },
        after: {
          orderId: refund.orderId,
          orderItemId: refund.orderItemId,
          status: refund.status,
          amount: refund.amount,
          quantity: refund.quantity,
        },
      });

      await createOrderAdminNotifications({
        tx, orderId: orderItem.orderId, title: "Refund requested",
        message: `A refund was requested for order #${orderItem.orderId}.`,
        metadata: { event: "REFUND_REQUESTED", refundId: refund.id },
      });
      return refund;
    });

    return NextResponse.json({ refund: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create refund:", error);
    return NextResponse.json(
      { error: "Failed to create refund request." },
      { status: 500 },
    );
  }
}
