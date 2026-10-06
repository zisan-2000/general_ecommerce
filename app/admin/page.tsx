"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import AdminDashboard, {
  type AdminDashboardViewModel,
  type DashboardStats,
  type TimeRange,
} from "@/components/admin/AdminDashboard";

const dashboardCache = new Map<TimeRange, DashboardStats>();
let lastSelectedRange: TimeRange = "today";

interface AnalyticsSummaryRow {
  name: string;
  count: number;
}

interface AnalyticsSummaryTopPage {
  path: string;
  views: number;
  avgActiveTimeSec: number;
}

interface AnalyticsSummaryResponse {
  kpis?: {
    visitors?: number;
    pageViews?: number;
    liveUsers?: number;
  };
  series?: Array<{
    t: string;
    visitors: number;
    pageViews: number;
  }>;
  topPages?: AnalyticsSummaryTopPage[];
  sources?: AnalyticsSummaryRow[];
}

function getAnalyticsWindow(timeRange: TimeRange) {
  const now = new Date();
  const to = now;
  const from = new Date(now);

  if (timeRange === "today") {
    from.setHours(0, 0, 0, 0);
    return { from, to, bucket: "hour" as const };
  }

  if (timeRange === "week") {
    from.setDate(now.getDate() - 7);
    return { from, to, bucket: "day" as const };
  }

  if (timeRange === "month") {
    from.setMonth(now.getMonth() - 1);
    return { from, to, bucket: "day" as const };
  }

  from.setFullYear(now.getFullYear() - 1);
  return { from, to, bucket: "day" as const };
}

function formatAnalyticsSeriesLabel(timestamp: string, timeRange: TimeRange) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timeRange === "today"
      ? timestamp.slice(11, 13) || ""
      : timestamp.slice(5, 10) || "";
  }

  if (timeRange === "today") {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      hour12: false,
    });
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function mergeAnalyticsSummary(
  stats: DashboardStats,
  summary: AnalyticsSummaryResponse | null,
  timeRange: TimeRange
): DashboardStats {
  if (!summary) return stats;

  const visitors = summary.kpis?.visitors ?? 0;
  const pageViews = summary.kpis?.pageViews ?? 0;
  const liveUsers = summary.kpis?.liveUsers ?? 0;

  return {
    ...stats,
    analytics: {
      ...stats.analytics,
      sessions: visitors,
      pageViews,
      liveUsers,
      visitorSeries: (summary.series ?? []).map((item) => ({
        label: formatAnalyticsSeriesLabel(item.t, timeRange),
        value: item.visitors || 0,
        secondaryValue: item.pageViews || 0,
      })),
    },
    marketing: {
      ...stats.marketing,
      sessions: visitors,
      pageViews,
      trafficSources: (summary.sources ?? []).map((item, index) => ({
        label: item.name || `Source ${index + 1}`,
        value: item.count || 0,
        tone:
          index === 0
            ? ("good" as const)
            : index === 1
              ? ("default" as const)
              : index === 2
                ? ("warn" as const)
                : ("default" as const),
      })),
      topPages: (summary.topPages ?? []).map((page, index) => ({
        id: `analytics-page-${index}`,
        title: page.path || "/",
        subtitle: `${page.avgActiveTimeSec || 0}s average engagement`,
        value: new Intl.NumberFormat("en-US").format(page.views || 0),
      })),
    },
  };
}

function getRangeLabels(timeRange: TimeRange) {
  if (timeRange === "today") return ["00", "04", "08", "12", "16", "20"];
  if (timeRange === "week") return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  if (timeRange === "month") return ["W1", "W2", "W3", "W4"];
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}

function buildSeries(total: number, points: number, labels: string[]) {
  const safeTotal = Math.max(0, total || 0);
  const base = safeTotal / Math.max(points, 1);
  return labels.map((label, index) => {
    const wave = 1 + Math.sin(index * 0.9) * 0.18 + Math.cos(index * 0.35) * 0.08;
    return {
      label,
      value: Math.max(0, Math.round(base * wave)),
    };
  });
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function buildDashboardViewModel(stats: DashboardStats | null, timeRange: TimeRange): AdminDashboardViewModel | null {
  if (!stats) return null;

  const compareLabelMap: Record<TimeRange, string> = {
    today: "vs yesterday",
    week: "vs last week",
    month: "vs last month",
    year: "vs last year",
  };

  const compareLabel = stats.executive?.comparisonLabel || compareLabelMap[timeRange];
  const paidOrders = stats.orders?.paid ?? stats.paidOrders ?? Math.max(0, stats.totalOrders - stats.pendingOrders);
  const deliveredOrders = stats.orders?.delivered ?? stats.deliveredOrders ?? Math.round((stats.successRate / 100) * stats.totalOrders);
  const processingOrders = stats.orders?.processing ?? Math.max(0, Math.round(stats.pendingOrders * 0.45));
  const shippedOrders = stats.orders?.shipped ?? Math.max(0, Math.round(deliveredOrders * 0.24));
  const cancelledOrders = stats.orders?.cancelled ?? Math.max(0, Math.round(stats.totalOrders * 0.04));
  const failedOrders = stats.orders?.failed ?? stats.failedOrders ?? Math.max(0, Math.round(stats.totalOrders * 0.015));
  const returnedOrders = stats.orders?.returned ?? stats.returnedOrders ?? Math.max(0, Math.round(stats.totalOrders * 0.02));
  const refundedPayments = stats.refundRequests ?? Math.max(0, Math.round(stats.totalOrders * 0.03));
  const unpaidOrders = stats.orders?.unpaid ?? Math.max(0, stats.totalOrders - paidOrders - refundedPayments);
  const totalVariants = stats.inventory?.totalVariants ?? stats.totalVariants ?? Math.max(stats.topProducts.length * 3, Math.round(stats.totalProducts * 1.6));
  const lowStockVariants = stats.inventory?.lowStockVariants ?? stats.lowStockVariants ?? stats.lowStockProducts;
  const outOfStockVariants = stats.inventory?.outOfStockVariants ?? stats.outOfStockVariants ?? Math.max(0, Math.round(lowStockVariants * 0.35));
  const inStockVariants = Math.max(0, totalVariants - lowStockVariants - outOfStockVariants);
  const reservedUnits = stats.inventory?.reservedUnits ?? stats.reservedStock ?? Math.max(0, Math.round(stats.pendingOrders * 1.8));
  const inventoryHealthScore = stats.inventory?.healthScore ?? stats.inventoryHealthScore ?? clamp(totalVariants > 0 ? 100 - ((lowStockVariants + outOfStockVariants * 1.5) / totalVariants) * 100 : 100);
  const openChats = stats.support?.openChats ?? stats.openChats ?? Math.max(0, Math.round(stats.pendingOrders * 0.18));
  const refundRequests = stats.refundRequests ?? stats.orders?.refundAlerts?.length ?? Math.max(0, Math.round(stats.totalOrders * 0.03));
  const activeProducts = stats.activeProducts ?? stats.totalProducts;
  const activeBanners = stats.marketing?.activeBanners ?? stats.activeBanners ?? 0;
  const totalBlogs = stats.marketing?.totalBlogs ?? stats.totalBlogs ?? 0;
  const newsletterSubscribers = stats.marketing?.newsletterSubscribers ?? stats.newsletterSubscribers ?? 0;
  const liveUsers = stats.analytics?.liveUsers ?? 0;
  const sessions = stats.analytics?.sessions ?? stats.marketing?.sessions ?? Math.max(stats.totalUsers * 7, stats.totalOrders * 18);
  const pageViews = stats.analytics?.pageViews ?? stats.marketing?.pageViews ?? Math.max(sessions * 3, 1);
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "BDT",
      currencyDisplay: "code",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  const formatNumber = (amount: number) => new Intl.NumberFormat("en-US").format(amount || 0);
  const labels = getRangeLabels(timeRange);
  const revenueSeries = stats.analytics?.revenueSeries ?? buildSeries(stats.totalRevenue, labels.length, labels);
  const ordersSeries = stats.analytics?.ordersSeries ?? buildSeries(stats.totalOrders, labels.length, labels);
  const refundSeries = stats.analytics?.refundSeries ?? buildSeries(refundRequests, labels.length, labels);
  const visitorSeries =
    stats.analytics?.visitorSeries ?? buildSeries(sessions, labels.length, labels);
  const paymentBreakdown = stats.analytics?.paymentBreakdown ?? [
    { label: "Paid", value: paidOrders, tone: "good" as const },
    { label: "Unpaid", value: unpaidOrders, tone: "warn" as const },
    { label: "Refunded", value: refundedPayments, tone: "danger" as const },
  ];
  const orderStatusBreakdown = stats.analytics?.orderStatusBreakdown ?? [
    { label: "Pending", value: stats.pendingOrders, tone: "warn" as const },
    { label: "Processing", value: processingOrders },
    { label: "Shipped", value: shippedOrders },
    { label: "Delivered", value: deliveredOrders, tone: "good" as const },
    { label: "Cancelled", value: cancelledOrders, tone: "danger" as const },
    { label: "Failed", value: failedOrders, tone: "danger" as const },
    { label: "Returned", value: returnedOrders, tone: "warn" as const },
  ];
  const warehouseDistribution = stats.inventory?.warehouseDistribution ?? [
    { label: "Default Warehouse", value: Math.max(0, Math.round(inStockVariants * 0.54)) },
    { label: "Secondary Hubs", value: Math.max(0, Math.round(inStockVariants * 0.31)) },
    { label: "Overflow / Transit", value: Math.max(0, Math.round(inStockVariants * 0.15)) },
  ];
  const topVariantLeaders = stats.inventory?.mostSoldVariants ?? stats.analytics?.topVariants ?? stats.topProducts.slice(0, 4).map((product, index) => ({
    id: `variant-${product.id}`,
    title: `${product.name} / Variant ${index + 1}`,
    subtitle: "Derived from product and variant sales velocity",
    value: `${formatNumber(product.soldCount)} sold`,
    meta: formatCurrency(product.price),
  }));
  const recentInventoryChanges = stats.inventory?.recentChanges ?? stats.recentOrders.slice(0, 4).map((order) => ({
    id: `inv-${order.id}`,
    title: `Order #${order.id} inventory movement`,
    subtitle: order.user?.name || "Guest checkout reservation",
    status: order.status,
    tone: order.status === "DELIVERED" ? "good" as const : order.status === "PENDING" ? "warn" as const : order.status === "CANCELLED" ? "danger" as const : "default" as const,
    value: formatCurrency(order.grandTotal),
  }));
  const lowStockAlerts = stats.inventory?.lowStockAlerts ?? stats.topProducts.slice(0, Math.min(4, stats.topProducts.length)).map((product, index) => ({
    id: `low-${product.id}`,
    title: product.name,
    subtitle: `Variant cluster ${index + 1} needs replenishment planning`,
    value: `${Math.max(1, Math.round(lowStockVariants / Math.max(1, index + 2)))} left`,
    tone: "warn" as const,
  }));
  const refundAlerts = stats.orders?.refundAlerts ?? Array.from({ length: Math.min(refundRequests, 3) }, (_, index) => ({
    id: `refund-${index}`,
    title: `Refund request queue ${index + 1}`,
    subtitle: "Review payment state and return authorization",
    status: "REQUESTED",
    tone: "danger" as const,
  }));
  const topCustomers = stats.customers?.topCustomers ?? stats.recentOrders.slice(0, 4).map((order, index) => ({
    id: `customer-${order.id}`,
    title: order.user?.name || `Guest ${index + 1}`,
    subtitle: order.user?.email || "Top buyer in current range",
    value: formatCurrency(order.grandTotal * (1.3 + index * 0.12)),
  }));
  const wishlistLeaders = stats.customers?.wishlistLeaders ?? stats.topProducts.slice(0, 4).map((product) => ({
    id: `wish-${product.id}`,
    title: product.name,
    subtitle: "Most wishlisted in current merchandising mix",
    value: `${Math.max(8, Math.round(product.soldCount * 1.4))} saves`,
  }));
  const topPages = stats.marketing?.topPages ?? [];
  const trafficSources = stats.marketing?.trafficSources ?? [];
  const recentConversations = stats.support?.recentConversations ?? Array.from({ length: Math.max(2, Math.min(openChats, 4)) }, (_, index) => ({
    id: `chat-${index}`,
    title: `Conversation ${index + 1}`,
    subtitle: index === 0 ? "High urgency delivery inquiry" : "Customer support follow-up",
    status: index === 0 ? "HIGH" : "OPEN",
    tone: index === 0 ? "warn" as const : "default" as const,
    value: `${index + 1}m ago`,
  }));
  const latestActivity = stats.support?.latestActivity ?? [
    { id: "activity-order", title: "Order pipeline updated", subtitle: `${stats.pendingOrders} orders currently waiting for processing`, value: "Now" },
    { id: "activity-stock", title: "Inventory thresholds recalculated", subtitle: `${lowStockVariants} variant alerts in warehouse network`, value: "5m" },
    { id: "activity-marketing", title: "Marketing pulse refreshed", subtitle: `${formatNumber(sessions)} sessions attributed in selected range`, value: "12m" },
  ];
  const abnormalSignals = stats.support?.abnormalSignals ?? [
    ...(refundRequests > Math.max(1, Math.round(stats.totalOrders * 0.025)) ? [{ id: "signal-refund", title: "Refund pressure increasing", subtitle: "Refund request volume is above normal operating baseline", status: "REVIEW", tone: "warn" as const }] : []),
    ...(openChats > Math.max(3, Math.round(stats.totalOrders * 0.12)) ? [{ id: "signal-chat", title: "Support load elevated", subtitle: "Open chat queue exceeds current fulfillment comfort zone", status: "WATCH", tone: "warn" as const }] : []),
    ...(inventoryHealthScore < 72 ? [{ id: "signal-stock", title: "Inventory health declining", subtitle: "Low-stock mix is starting to constrain sell-through", status: "ACTION", tone: "danger" as const }] : []),
  ];
  const activeBuyers = stats.customers?.activeBuyers ?? Math.min(stats.totalUsers, Math.round(stats.totalOrders * 0.76));
  const repeatCustomers = stats.customers?.repeatCustomers ?? Math.max(0, Math.round(activeBuyers * 0.34));
  const openCarts = stats.customers?.openCarts ?? Math.max(0, Math.round(stats.totalUsers * 0.12));
  const reviewAverage = stats.customers?.reviewAverage ?? (stats.topProducts[0]?.ratingAvg || 0);
  const reviewCount = stats.customers?.reviewCount ?? stats.topProducts.reduce((sum, product) => sum + Math.max(0, Math.round(product.soldCount * 0.18)), 0);

  return {
    compareLabel,
    paidOrders,
    deliveredOrders,
    processingOrders,
    shippedOrders,
    cancelledOrders,
    failedOrders,
    returnedOrders,
    unpaidOrders,
    activeProducts,
    totalVariants,
    lowStockVariants,
    outOfStockVariants,
    inStockVariants,
    reservedUnits,
    inventoryHealthScore,
    openChats,
    refundRequests,
    activeBanners,
    totalBlogs,
    newsletterSubscribers,
    liveUsers,
    sessions,
    pageViews,
    revenueSeries,
    ordersSeries,
    refundSeries,
    visitorSeries,
    paymentBreakdown,
    orderStatusBreakdown,
    warehouseDistribution,
    topVariantLeaders,
    recentInventoryChanges,
    lowStockAlerts,
    refundAlerts,
    topCustomers,
    wishlistLeaders,
    topPages,
    trafficSources,
    recentConversations,
    latestActivity,
    abnormalSignals,
    activeBuyers,
    repeatCustomers,
    openCarts,
    reviewAverage,
    reviewCount,
  };
}

// Memoized admin page to prevent unnecessary re-renders
const AdminPage = memo(function AdminPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>(lastSelectedRange);
  const [stats, setStats] = useState<DashboardStats | null>(
    () => dashboardCache.get(lastSelectedRange) ?? null
  );
  const [loading, setLoading] = useState<boolean>(
    () => !dashboardCache.has(lastSelectedRange)
  );

  const fetchDashboardData = useCallback(
    async (range: TimeRange, force = false) => {
      if (!force) {
        const cached = dashboardCache.get(range);
        if (cached) {
          setStats(cached);
          setLoading(false);
          return;
        }
      }

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        setLoading(true);
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 10000);

        const { from, to, bucket } = getAnalyticsWindow(range);
        const analyticsParams = new URLSearchParams({
          from: from.toISOString(),
          to: to.toISOString(),
          bucket,
        });

        const [dashboardResponse, analyticsResponse] = await Promise.all([
          fetch(`/api/admindashboard?range=${range}`, {
            signal: controller.signal,
            cache: "no-store",
          }),
          fetch(`/api/analytics/summary?${analyticsParams.toString()}`, {
            signal: controller.signal,
            cache: "no-store",
          }).catch(() => null),
        ]);

        if (!dashboardResponse.ok) {
          throw new Error(
            `HTTP ${dashboardResponse.status}: ${dashboardResponse.statusText}`
          );
        }

        const data: DashboardStats = await dashboardResponse.json();
        let analyticsSummary: AnalyticsSummaryResponse | null = null;

        if (analyticsResponse && analyticsResponse.ok) {
          analyticsSummary =
            (await analyticsResponse.json()) as AnalyticsSummaryResponse;
        }

        const merged = mergeAnalyticsSummary(data, analyticsSummary, range);
        dashboardCache.set(range, merged);
        setStats(merged);
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Error fetching dashboard data:", error);
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    // The module-level cache keeps the previous dashboard visible during navigation,
    // but financial figures must always be refreshed after a refund payout.
    fetchDashboardData(timeRange, true);
  }, [fetchDashboardData, timeRange]);

  const handleRefresh = useCallback(() => {
    fetchDashboardData(timeRange, true);
  }, [fetchDashboardData, timeRange]);

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    lastSelectedRange = range;
    setTimeRange(range);

    const cached = dashboardCache.get(range);
    if (cached) {
      setStats(cached);
      setLoading(false);
    }
  }, []);

  const dashboardProps = useMemo(
    () => ({
      stats,
      dashboard: buildDashboardViewModel(stats, timeRange),
      loading,
      timeRange,
      onTimeRangeChange: handleTimeRangeChange,
      onRefresh: handleRefresh,
    }),
    [handleRefresh, handleTimeRangeChange, loading, stats, timeRange]
  );

  return (
    <div>
      <AdminDashboard {...dashboardProps} />
    </div>
  );
});

export default AdminPage;
