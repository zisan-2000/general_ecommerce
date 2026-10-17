import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { canAccessWarehouseWithPermission } from "@/lib/warehouse-scope";
import { createOrderNotification } from "@/lib/order-notifications";
import { logActivity } from "@/lib/activity-log";
import { Prisma } from "@/generated/prisma";
import { PaymentControlError } from "@/lib/payment-control/authorization";
import { recordPaymentEvent, type PaymentLogContext } from "@/lib/payment-control/telemetry";

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
    const refundTelemetry: { context?: PaymentLogContext } = {};
    const refund = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${existing.orderId} FOR UPDATE`);
      // Serialize identical payout references even when they target different orders.
      // No credential/account/reference text is logged by payment telemetry.
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${transactionId}, 0))`);
      const duplicateReference = await tx.refund.findFirst({ where: {
        payoutTransactionId: transactionId, payoutStatus: "PAID", id: { not: refundId },
      }, select: { id: true } });
      if (duplicateReference) throw new PaymentControlError("This payout reference is already recorded", 409);
      const current = await tx.refund.findUniqueOrThrow({ where: { id: refundId } });
      if (current.status !== "APPROVED" || current.payoutStatus !== "PENDING") return null;
      const order = await tx.order.findUniqueOrThrow({ where: { id: existing.orderId } });
      const paidTotal = await tx.refund.aggregate({ where: { orderId: existing.orderId, payoutStatus: "PAID" }, _sum: { amount: true } });
      const captured = await tx.payment.findFirst({ where: { orderId: existing.orderId,
        status: { in: ["CAPTURED", "REFUNDED"] } }, orderBy: { id: "desc" } });
      const online = /^(EPS|SSLCOMMERZ|AIBL_WALLET):/.test(order.payment_method);
      if (online && !captured?.amount) throw new PaymentControlError("No captured payment found; reconcile before recording a refund", 409);
      if (current.paymentId && captured && current.paymentId !== captured.id) throw new PaymentControlError("Refund does not match the captured payment", 409);
      const limit = captured?.amount && captured.amount.lessThan(order.grand_total) ? captured.amount : order.grand_total;
      if (current.amount.lessThanOrEqualTo(0) || (paidTotal._sum.amount ?? new Prisma.Decimal(0)).add(current.amount).greaterThan(limit)) {
        throw new PaymentControlError("Refund total would exceed the amount paid", 409);
      }
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
          ...(captured ? { paymentId: captured.id } : {}),
        },
      });
      if (claimed.count !== 1) return null;
      if (captured?.provider === "EPS" || captured?.provider === "SSLCOMMERZ" || captured?.provider === "AIBL_WALLET") {
        refundTelemetry.context = { provider: captured.provider, paymentId: captured.id, orderId: existing.orderId,
          transactionId: captured.externalId ?? undefined, actorUserId: access.userId! };
      }

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

    if (refundTelemetry.context) {
      await recordPaymentEvent({ ...refundTelemetry.context, operation: "REFUND",
        outcome: "SUCCESS", detailCode: "REFUND_RECORDED" });
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
    if (error instanceof PaymentControlError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to record refund payment:", error);
    return NextResponse.json(
      { error: "Failed to record refund payment." },
      { status: 500 },
    );
  }
}
