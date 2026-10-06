import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { getInventoryStatus } from "@/lib/stock-status";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

type DashboardRange = "today" | "week" | "month" | "year";
type RevenueOrder = { order_date: Date; grand_total: unknown };
type PaidRefund = { paidAt: Date | null; amount: unknown };

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function asMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDateWindows(range: DashboardRange, now: Date) {
  const start = new Date(now);

  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (range === "month") {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setMonth(start.getMonth() - 11, 1);
    start.setHours(0, 0, 0, 0);
  }

  const duration = now.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - duration);

  return { start, end: now, previousStart, previousEnd: start };
}

function formatDay(value: Date) {
  return value.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function buildFinancialSeries(
  range: DashboardRange,
  start: Date,
  end: Date,
  orders: RevenueOrder[],
  refunds: PaidRefund[],
) {
  const buckets: Array<{
    label: string;
    from: Date;
    to: Date;
    revenue: number;
    orders: number;
    refunds: number;
  }> = [];

  if (range === "today") {
    for (let hour = 0; hour < 24; hour += 4) {
      const from = new Date(start);
      from.setHours(hour, 0, 0, 0);
      const to = new Date(from);
      to.setHours(hour + 4, 0, 0, 0);
      buckets.push({
        label: String(hour).padStart(2, "0"),
        from,
        to,
        revenue: 0,
        orders: 0,
        refunds: 0,
      });
    }
  } else if (range === "year") {
    const cursor = new Date(start);
    while (cursor < end) {
      const from = new Date(cursor);
      const to = new Date(from);
      to.setMonth(to.getMonth() + 1, 1);
      buckets.push({
        label: from.toLocaleDateString("en-GB", { month: "short" }),
        from,
        to,
        revenue: 0,
        orders: 0,
        refunds: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1, 1);
    }
  } else {
    const bucketDays = range === "week" ? 1 : 7;
    const cursor = new Date(start);
    while (cursor < end) {
      const from = new Date(cursor);
      const to = new Date(from);
      to.setDate(to.getDate() + bucketDays);
      buckets.push({
        label: formatDay(from),
        from,
        to,
        revenue: 0,
        orders: 0,
        refunds: 0,
      });
      cursor.setDate(cursor.getDate() + bucketDays);
    }
  }

  for (const order of orders) {
    const bucket = buckets.find(
      (item) => order.order_date >= item.from && order.order_date < item.to,
    );
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.revenue = roundMoney(bucket.revenue + asMoney(order.grand_total));
  }

  for (const refund of refunds) {
    const paidAt = refund.paidAt;
    if (!paidAt) continue;
    const bucket = buckets.find(
      (item) => paidAt >= item.from && paidAt < item.to,
    );
    if (!bucket) continue;
    bucket.refunds += 1;
    bucket.revenue = roundMoney(bucket.revenue - asMoney(refund.amount));
  }

  return {
    revenueSeries: buckets.map(({ label, revenue }) => ({ label, value: revenue })),
    ordersSeries: buckets.map(({ label, orders: value }) => ({ label, value })),
    refundSeries: buckets.map(({ label, refunds: value }) => ({ label, value })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(
      session?.user as { id?: string; role?: string } | undefined,
    );
    if (!access.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!access.has("dashboard.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requestedRange = new URL(request.url).searchParams.get("range");
    const range: DashboardRange =
      requestedRange === "today" ||
      requestedRange === "week" ||
      requestedRange === "month" ||
      requestedRange === "year"
        ? requestedRange
        : "month";
    const window = getDateWindows(range, new Date());
    const currentDate = { gte: window.start, lte: window.end };
    const previousDate = { gte: window.previousStart, lt: window.previousEnd };
    const revenueOrderWhere: Prisma.OrderWhereInput = {
      paymentStatus: { in: ["PAID", "REFUNDED"] },
      status: { notIn: ["CANCELLED", "FAILED", "RETURNED"] },
    };
    const paidRefundWhere: Prisma.RefundWhereInput = {
      status: "COMPLETED",
      payoutStatus: "PAID",
    };

    const [
      totalUsers,
      prevTotalUsers,
      totalOrders,
      prevTotalOrders,
      deliveredOrders,
      totalProducts,
      pendingOrders,
      lowStockProducts,
      recentOrders,
      topProducts,
      revenueOrders,
      previousRevenueOrders,
      paidRefunds,
      previousPaidRefunds,
      refundCount,
      recentRefunds,
      failedOrders,
      returnedOrders,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: currentDate } }),
      prisma.user.count({ where: { createdAt: previousDate } }),
      prisma.order.count({ where: { order_date: currentDate } }),
      prisma.order.count({ where: { order_date: previousDate } }),
      prisma.order.count({
        where: { order_date: currentDate, status: "DELIVERED" },
      }),
      prisma.product.count(),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.product.findMany({
        where: { deleted: false },
        select: {
          id: true,
          type: true,
          variants: { select: { stock: true, lowStockThreshold: true } },
        },
      }),
      prisma.order.findMany({
        take: 5,
        orderBy: { order_date: "desc" },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.product.findMany({
        take: 5,
        orderBy: { soldCount: "desc" },
        select: {
          id: true,
          name: true,
          basePrice: true,
          currency: true,
          soldCount: true,
          ratingAvg: true,
        },
      }),
      prisma.order.findMany({
        where: { order_date: currentDate, ...revenueOrderWhere },
        select: { order_date: true, grand_total: true },
      }),
      prisma.order.findMany({
        where: { order_date: previousDate, ...revenueOrderWhere },
        select: { order_date: true, grand_total: true },
      }),
      prisma.refund.findMany({
        where: { ...paidRefundWhere, paidAt: currentDate },
        select: { paidAt: true, amount: true },
      }),
      prisma.refund.findMany({
        where: { ...paidRefundWhere, paidAt: previousDate },
        select: { paidAt: true, amount: true },
      }),
      prisma.refund.count({
        where: {
          createdAt: currentDate,
          status: { in: ["REQUESTED", "APPROVED", "COMPLETED"] },
        },
      }),
      prisma.refund.findMany({
        where: {
          createdAt: currentDate,
          status: { in: ["REQUESTED", "APPROVED", "COMPLETED"] },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          order: { select: { id: true, name: true, phone_number: true } },
          orderItem: {
            select: {
              id: true,
              quantity: true,
              product: { select: { name: true } },
            },
          },
        },
      }),
      prisma.order.count({ where: { order_date: currentDate, status: "FAILED" } }),
      prisma.order.count({ where: { order_date: currentDate, status: "RETURNED" } }),
    ]);

    const grossRevenue = roundMoney(
      revenueOrders.reduce((sum, order) => sum + asMoney(order.grand_total), 0),
    );
    const refundTotal = roundMoney(
      paidRefunds.reduce((sum, refund) => sum + asMoney(refund.amount), 0),
    );
    const currentRevenue = roundMoney(grossRevenue - refundTotal);
    const previousGrossRevenue = roundMoney(
      previousRevenueOrders.reduce(
        (sum, order) => sum + asMoney(order.grand_total),
        0,
      ),
    );
    const previousRefundTotal = roundMoney(
      previousPaidRefunds.reduce(
        (sum, refund) => sum + asMoney(refund.amount),
        0,
      ),
    );
    const previousRevenue = roundMoney(previousGrossRevenue - previousRefundTotal);

    const userGrowth =
      prevTotalUsers > 0
        ? ((totalUsers - prevTotalUsers) / prevTotalUsers) * 100
        : totalUsers > 0
          ? 100
          : 0;
    const orderGrowth =
      prevTotalOrders > 0
        ? ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100
        : totalOrders > 0
          ? 100
          : 0;
    const revenueGrowth =
      previousRevenue !== 0
        ? ((currentRevenue - previousRevenue) / Math.abs(previousRevenue)) * 100
        : currentRevenue !== 0
          ? 100
          : 0;

    const lowStockProductsCount = lowStockProducts.filter((product) => {
      if (product.type !== "PHYSICAL") return false;
      return product.variants.some((variant) => {
        const status = getInventoryStatus(variant.stock, variant.lowStockThreshold);
        return status === "LOW_STOCK" || status === "OUT_OF_STOCK";
      });
    }).length;
    const financialSeries = buildFinancialSeries(
      range,
      window.start,
      window.end,
      revenueOrders,
      paidRefunds,
    );

    return NextResponse.json({
      totalUsers,
      totalOrders,
      totalProducts,
      totalRevenue: currentRevenue,
      grossRevenue,
      refundTotal,
      completedRefunds: paidRefunds.length,
      pendingOrders,
      failedOrders,
      returnedOrders,
      lowStockProducts: lowStockProductsCount,
      refundRequests: refundCount,
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        grandTotal: Number(order.grand_total),
        status: order.status,
        paymentStatus: order.paymentStatus,
        user: order.user,
      })),
      topProducts: topProducts.map((product) => ({
        id: product.id,
        name: product.name,
        price: Number(product.basePrice),
        currency: product.currency,
        soldCount: product.soldCount,
        ratingAvg: product.ratingAvg,
      })),
      userGrowth: roundMoney(userGrowth),
      revenueGrowth: roundMoney(revenueGrowth),
      orderGrowth: roundMoney(orderGrowth),
      successRate:
        totalOrders > 0 ? roundMoney((deliveredOrders / totalOrders) * 100) : 0,
      averageOrderValue:
        totalOrders > 0 ? roundMoney(currentRevenue / totalOrders) : 0,
      conversionRate:
        totalUsers > 0 ? roundMoney((totalOrders / totalUsers) * 100) : 0,
      analytics: financialSeries,
      orders: {
        refundAlerts: recentRefunds.map((refund) => ({
          id: refund.id,
          title: refund.orderItem?.product?.name || `Order #${refund.orderId}`,
          subtitle: `Order #${refund.orderId} • Qty ${refund.quantity || refund.orderItem?.quantity || 1}`,
          status: refund.status,
          tone:
            refund.status === "COMPLETED"
              ? ("good" as const)
              : refund.status === "APPROVED"
                ? ("warn" as const)
                : ("danger" as const),
          value: `৳${Number(refund.amount || 0).toFixed(2)}`,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
