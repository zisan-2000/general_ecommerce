import { NextRequest, NextResponse } from "next/server";
import { Prisma, OrderStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { reconcileEpsPayment } from "@/lib/eps";
import { transitionOrderStatusWithInventory } from "@/lib/order-inventory-lifecycle";
import { syncCommissionEntriesForOrderStatus } from "@/lib/business-network/commission";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }
  const results = { checked: 0, success: 0, failed: 0, cancelled: 0, pending: 0, errors: 0, abandoned: 0 };
  try {
    // Bounded sequential batch; network calls are always outside DB transactions.
    const payments = await prisma.payment.findMany({ where: { provider: "EPS", orderId: { not: null },
      status: { in: ["INITIATED", "AUTHORIZED"] }, createdAt: { lt: new Date(Date.now() - 60_000) },
    }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: 5 });
    for (const payment of payments) {
      if (!payment.externalId) continue;
      results.checked++;
      try { const result = await reconcileEpsPayment(payment.externalId, request); results[result.status]++; }
      catch {
        results.errors++;
        // Advance failed checks so a repeatedly unavailable attempt cannot starve the queue.
        await prisma.payment.updateMany({ where: { id: payment.id, status: { in: ["INITIATED", "AUTHORIZED"] } }, data: { updatedAt: new Date() } });
      }
    }
    // An order with zero attempts cannot have reached InitializeEPS. Release after 45 minutes.
    const abandoned = await prisma.order.findMany({ where: { payment_method: { startsWith: "EPS:" },
      paymentStatus: "UNPAID", status: "PENDING", createdAt: { lt: new Date(Date.now() - 45 * 60_000) }, payments: { none: {} },
    }, select: { id: true }, take: 25 });
    for (const candidate of abandoned) {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${candidate.id} FOR UPDATE`);
        const order = await tx.order.findUniqueOrThrow({ where: { id: candidate.id } });
        if (order.paymentStatus !== "UNPAID" || order.status !== "PENDING" || await tx.payment.count({ where: { orderId: order.id } })) return;
        const transition = await transitionOrderStatusWithInventory({ tx, orderId: order.id, nextStatus: OrderStatus.FAILED,
          reason: `Order #${order.id} abandoned EPS checkout without a payment attempt` });
        if (transition.changed) {
          await syncCommissionEntriesForOrderStatus({ tx, orderId: order.id, orderStatus: OrderStatus.FAILED, request });
          if (order.couponId && Number(order.discount_total ?? 0) > 0) await tx.coupon.updateMany({
            where: { id: order.couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } },
          });
          results.abandoned++;
        }
      });
    }
    revalidateStorefrontCatalog();
    return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "EPS reconciliation could not complete", ...results }, { status: 500 }); }
}
