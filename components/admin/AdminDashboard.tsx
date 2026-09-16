"use client";

import { memo, useCallback, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  BellRing,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  MessageSquareMore,
  Package,
  PackageCheck,
  PackageSearch,
  Percent,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Target,
  Truck,
  UserRound,
  Users,
  WalletCards,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  ComposedChart,
} from "recharts";
import { StatCard } from "@/components/StatCard";
import { useFormatter, useTranslations } from "next-intl";

export type TimeRange = "today" | "week" | "month" | "year";

interface DashboardOrder {
  id: number;
  grandTotal: number;
  status: string;
  paymentStatus?: string;
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

interface DashboardProduct {
  id: number;
  name: string;
  soldCount: number;
  ratingAvg: number;
  price: number;
  currency?: string;
  stock?: number;
}

interface MetricValue {
  label: string;
  value: number;
  tone?: "default" | "good" | "warn" | "danger";
}

interface DashboardSeriesPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface DashboardListItem {
  id: string | number;
  title: string;
  subtitle?: string;
  value?: string;
  meta?: string;
  status?: string;
  tone?: "default" | "good" | "warn" | "danger";
}

interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalProducts: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockProducts: number;
  recentOrders: DashboardOrder[];
  topProducts: DashboardProduct[];
  userGrowth: number;
  revenueGrowth: number;
  orderGrowth: number;
  averageOrderValue: number;
  conversionRate: number;
  successRate: number;
  paidOrders?: number;
  deliveredOrders?: number;
  activeProducts?: number;
  totalVariants?: number;
  lowStockVariants?: number;
  outOfStockVariants?: number;
  reservedStock?: number;
  refundRequests?: number;
  failedOrders?: number;
  returnedOrders?: number;
  openChats?: number;
  activeBanners?: number;
  totalBlogs?: number;
  newsletterSubscribers?: number;
  activityCount?: number;
  inventoryHealthScore?: number;
  executive?: {
    comparisonLabel?: string;
    todayGrowth?: number;
    weekGrowth?: number;
    monthGrowth?: number;
  };
  analytics?: {
    revenueSeries?: DashboardSeriesPoint[];
    ordersSeries?: DashboardSeriesPoint[];
    refundSeries?: DashboardSeriesPoint[];
    visitorSeries?: DashboardSeriesPoint[];
    liveUsers?: number;
    paymentBreakdown?: MetricValue[];
    orderStatusBreakdown?: MetricValue[];
    topVariants?: DashboardListItem[];
    sessions?: number;
    pageViews?: number;
  };
  inventory?: {
    totalProducts?: number;
    totalVariants?: number;
    inStockVariants?: number;
    lowStockVariants?: number;
    outOfStockVariants?: number;
    reservedUnits?: number;
    warehouseDistribution?: MetricValue[];
    recentChanges?: DashboardListItem[];
    lowStockAlerts?: DashboardListItem[];
    mostSoldVariants?: DashboardListItem[];
    healthScore?: number;
  };
  orders?: {
    pending?: number;
    processing?: number;
    shipped?: number;
    delivered?: number;
    cancelled?: number;
    failed?: number;
    returned?: number;
    paid?: number;
    unpaid?: number;
    queuedFulfillment?: number;
    courierUsage?: MetricValue[];
    refundAlerts?: DashboardListItem[];
  };
  customers?: {
    totalUsers?: number;
    newUsers?: number;
    activeBuyers?: number;
    repeatCustomers?: number;
    openCarts?: number;
    reviewAverage?: number;
    reviewCount?: number;
    topCustomers?: DashboardListItem[];
    wishlistLeaders?: DashboardListItem[];
  };
  marketing?: {
    activeBanners?: number;
    totalBlogs?: number;
    newsletters?: number;
    newsletterSubscribers?: number;
    activeCoupons?: number;
    couponHealth?: number;
    sessions?: number;
    pageViews?: number;
    topPages?: DashboardListItem[];
    trafficSources?: MetricValue[];
  };
  support?: {
    openChats?: number;
    highPriorityChats?: number;
    unreadLoad?: number;
    recentConversations?: DashboardListItem[];
    latestActivity?: DashboardListItem[];
    abnormalSignals?: DashboardListItem[];
  };
}

interface AdminDashboardViewModel {
  compareLabel: string;
  paidOrders: number;
  deliveredOrders: number;
  processingOrders: number;
  shippedOrders: number;
  cancelledOrders: number;
  unpaidOrders: number;
  activeProducts: number;
  totalVariants: number;
  lowStockVariants: number;
  outOfStockVariants: number;
  inStockVariants: number;
  reservedUnits: number;
  inventoryHealthScore: number;
  openChats: number;
  refundRequests: number;
  failedOrders: number;
  returnedOrders: number;
  activeBanners: number;
  totalBlogs: number;
  newsletterSubscribers: number;
  liveUsers: number;
  sessions: number;
  pageViews: number;
  revenueSeries: DashboardSeriesPoint[];
  ordersSeries: DashboardSeriesPoint[];
  refundSeries: DashboardSeriesPoint[];
  visitorSeries: DashboardSeriesPoint[];
  paymentBreakdown: MetricValue[];
  orderStatusBreakdown: MetricValue[];
  warehouseDistribution: MetricValue[];
  topVariantLeaders: DashboardListItem[];
  recentInventoryChanges: DashboardListItem[];
  lowStockAlerts: DashboardListItem[];
  refundAlerts: DashboardListItem[];
  topCustomers: DashboardListItem[];
  wishlistLeaders: DashboardListItem[];
  topPages: DashboardListItem[];
  trafficSources: MetricValue[];
  recentConversations: DashboardListItem[];
  latestActivity: DashboardListItem[];
  abnormalSignals: DashboardListItem[];
  activeBuyers: number;
  repeatCustomers: number;
  openCarts: number;
  reviewAverage: number;
  reviewCount: number;
}

interface AdminDashboardProps {
  stats: DashboardStats | null;
  dashboard: AdminDashboardViewModel | null;
  loading: boolean;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  onRefresh: () => void;
}

const rangeOptions = [
  { value: "today", labelKey: "ranges.today" },
  { value: "week", labelKey: "ranges.week" },
  { value: "month", labelKey: "ranges.month" },
  { value: "year", labelKey: "ranges.year" },
] as const;

type Tone = "default" | "good" | "warn" | "danger";

const CHART_COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  pink: "#ec4899",
  cyan: "#06b6d4",
  orange: "#f97316",
  indigo: "#6366f1",
  teal: "#14b8a6",
};

const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.danger,
  CHART_COLORS.purple,
];

function SectionShell({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border bg-card text-card-foreground shadow-sm ${className}`}
    >
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 md:px-6">
        <div>
          <h2 className="text-base font-semibold tracking-tight md:text-lg">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-4 sm:p-5 md:p-6">{children}</div>
    </section>
  );
}

function StatusPill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: Tone;
}) {
  const toneStyles = {
    default: "status-pill-default",
    good: "status-pill-good",
    warn: "status-pill-warn",
    danger: "status-pill-danger",
  };
  return (
    <span
      className={`status-pill inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.04em] whitespace-normal ${toneStyles[tone]}`}
    >
      {label}
    </span>
  );
}

function InsightList({
  items,
  emptyLabel,
}: {
  items: DashboardListItem[];
  emptyLabel: string;
}) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-medium text-foreground sm:truncate">
              {item.title}
            </p>
            {item.subtitle && (
              <p className="break-words text-xs text-muted-foreground sm:truncate">
                {item.subtitle}
              </p>
            )}
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:justify-end sm:gap-3">
            {item.status && <StatusPill label={item.status} tone={item.tone} />}
            {item.meta && (
              <span className="break-words text-xs text-muted-foreground sm:text-right">
                {item.meta}
              </span>
            )}
            {item.value && (
              <span className="break-words text-sm font-semibold text-foreground sm:text-right">
                {item.value}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Custom Tooltip for Charts
const CustomTooltip = ({
  active,
  payload,
  label,
  valuePrefix = "",
  valueSuffix = "",
}: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-background/95 p-3 shadow-lg backdrop-blur-sm">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {payload.map((p: any, idx: number) => (
          <p key={idx} className="text-sm" style={{ color: p.color }}>
            {p.name}: {valuePrefix}
            {p.value}
            {valueSuffix}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function LoadingDashboard() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="h-36 rounded-2xl border border-border bg-card/80 animate-pulse" />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-40 rounded-xl border border-border bg-card/80 animate-pulse"
          />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-[400px] rounded-2xl border border-border bg-card/80 animate-pulse" />
        <div className="h-[400px] rounded-2xl border border-border bg-card/80 animate-pulse" />
      </div>
    </div>
  );
}

function EmptyDashboard({ onRefresh }: { onRefresh: () => void }) {
  const t = useTranslations("AdminDashboard");

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-muted/30">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">{t("empty.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("empty.description")}
        </p>
        <button
          onClick={onRefresh}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          {t("actions.retry")}
        </button>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  label,
  description,
  icon: Icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30"
    >
      <div className="rounded-lg border border-border bg-muted/30 p-2.5">
        <Icon className="h-5 w-5 text-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {description}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 shrink-0" />
    </Link>
  );
}

function AdminDashboard({
  stats,
  dashboard,
  loading,
  timeRange,
  onTimeRangeChange,
  onRefresh,
}: AdminDashboardProps) {
  const t = useTranslations("AdminDashboard");
  const formatter = useFormatter();
  const formatCurrency = (amount: number) =>
    formatter.number(amount || 0, {
      style: "currency",
      currency: "BDT",
      currencyDisplay: "code",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  const formatNumber = (amount: number) => formatter.number(amount || 0);
  const formatCompactNumber = (amount: number) =>
    formatter.number(amount || 0, {
      notation: "compact",
      maximumFractionDigits: 1,
    });
  const [primaryChart, setPrimaryChart] = useState<
    "revenue" | "orders" | "refunds"
  >("revenue");

  if (loading && !stats) return <LoadingDashboard />;
  if (!stats || !dashboard) return <EmptyDashboard onRefresh={onRefresh} />;

  // Prepare chart data
  const revenueData = dashboard.revenueSeries.map((item) => ({
    name: item.label,
    value: item.value,
  }));

  const ordersData = dashboard.ordersSeries.map((item) => ({
    name: item.label,
    value: item.value,
  }));

  const refundData = dashboard.refundSeries.map((item) => ({
    name: item.label,
    value: item.value,
  }));

  const combinedChartData = revenueData.map((item, idx) => ({
    name: item.name,
    revenue: item.value,
    orders: ordersData[idx]?.value || 0,
    refunds: refundData[idx]?.value || 0,
  }));

  const paymentPieData = dashboard.paymentBreakdown.map((item) => ({
    name: item.label,
    value: item.value,
    color:
      item.tone === "good"
        ? CHART_COLORS.success
        : item.tone === "warn"
          ? CHART_COLORS.warning
          : CHART_COLORS.primary,
  }));

  const inventoryPieData = [
    {
      name: t("inventory.inStock"),
      value: dashboard.inStockVariants,
      color: CHART_COLORS.success,
    },
    {
      name: t("inventory.lowStock"),
      value: dashboard.lowStockVariants,
      color: CHART_COLORS.warning,
    },
    {
      name: t("inventory.outOfStock"),
      value: dashboard.outOfStockVariants,
      color: CHART_COLORS.danger,
    },
  ];

  const warehouseData = dashboard.warehouseDistribution.map((item) => ({
    name: item.label,
    value: item.value,
  }));

  const topProductsData = stats.topProducts.slice(0, 5).map((product) => ({
    name:
      product.name.length > 15
        ? product.name.slice(0, 12) + "..."
        : product.name,
    sales: product.soldCount,
    revenue: product.price * product.soldCount,
  }));

  const visitorTrendData = dashboard.visitorSeries.map((item) => ({
    name: item.label,
    visitors: item.value,
  }));

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-background via-background to-muted/20 px-2 py-3 md:px-3 md:py-4 xl:px-4">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t(`rangeTitles.${timeRange}`)}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("overview")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-background p-1 shadow-sm">
              {rangeOptions.map((range) => (
                <button
                  key={range.value}
                  onClick={() => onTimeRangeChange(range.value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    timeRange === range.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {t(range.labelKey)}
                </button>
              ))}
            </div>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">{t("actions.refresh")}</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
          <StatCard
            label={t("kpis.netRevenue")}
            value={formatCurrency(stats.totalRevenue)}
            icon={CircleDollarSign}
            trend={stats.revenueGrowth}
            compareLabel={dashboard.compareLabel}
            tone="good"
          />

          <StatCard
            label={t("kpis.totalOrders")}
            value={formatNumber(stats.totalOrders)}
            icon={ShoppingCart}
            trend={stats.orderGrowth}
            compareLabel={dashboard.compareLabel}
          />

          <StatCard
            label={t("kpis.pendingOrders")}
            value={formatNumber(stats.pendingOrders)}
            icon={ReceiptText}
            compareLabel={dashboard.compareLabel}
            hint={t("kpis.operationalQueue")}
            tone={stats.pendingOrders > 0 ? "warn" : "good"}
          />

          <StatCard
            label={t("kpis.paidOrders")}
            value={formatNumber(dashboard.paidOrders)}
            icon={CreditCard}
            compareLabel={dashboard.compareLabel}
            hint={t("kpis.clearedPayments")}
            tone="good"
          />

          <StatCard
            label={t("kpis.activeProducts")}
            value={formatNumber(dashboard.activeProducts)}
            icon={Store}
            compareLabel={dashboard.compareLabel}
            hint={t("kpis.variants", { count: dashboard.totalVariants })}
          />

          <StatCard
            label={t("kpis.conversionRate")}
            value={`${stats.conversionRate.toFixed(1)}%`}
            icon={Target}
            compareLabel={dashboard.compareLabel}
            hint={t("kpis.visitorsToOrders")}
          />
        </div>

        {/* Main Charts Row */}
        <div className="grid gap-4 xl:grid-cols-2">
          {/* Revenue/Orders Trend Chart */}
          <SectionShell
            title={t("performance.title")}
            subtitle={t("performance.subtitle")}
            action={
              <div className="inline-flex flex-wrap rounded-lg border border-border bg-background p-0.5">
                {(["revenue", "orders", "refunds"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setPrimaryChart(type as any)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      primaryChart === type
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(`chartTypes.${type}`)}
                  </button>
                ))}
              </div>
            }
          >
            <div className="h-[220px] w-full sm:h-[260px] lg:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={
                    primaryChart === "revenue"
                      ? revenueData
                      : primaryChart === "orders"
                        ? ordersData
                        : refundData
                  }
                >
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={CHART_COLORS.primary}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={CHART_COLORS.primary}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(v) =>
                      primaryChart === "revenue" ? formatCompactNumber(v) : v
                    }
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        valuePrefix={primaryChart === "revenue" ? "BDT " : ""}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey={
                      primaryChart === "revenue"
                        ? "value"
                        : primaryChart === "orders"
                          ? "value"
                          : "value"
                    }
                    name={t(`chartTypes.${primaryChart}`)}
                    stroke={CHART_COLORS.primary}
                    fill="url(#colorValue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("metrics.totalRevenue")}</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("metrics.avgOrderValue")}</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(stats.averageOrderValue)}
                </p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("metrics.successRate")}</p>
                <p className="text-lg font-bold text-foreground">
                  {stats.successRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </SectionShell>

          {/* Payment & Inventory Distribution */}
          <SectionShell
            title={t("distribution.title")}
            subtitle={t("distribution.subtitle")}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                <div className="mb-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("distribution.paymentMethods")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("distribution.paymentSubtitle")}
                  </p>
                </div>
                <div className="h-[180px] sm:h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={2}
                        dataKey="value"
                        label={false}
                        labelLine={false}
                      >
                        {paymentPieData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatNumber(v as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
                  {paymentPieData.map((item) => {
                    const total = paymentPieData.reduce(
                      (sum, entry) => sum + entry.value,
                      0,
                    );

                    const percent =
                      total > 0 ? Math.round((item.value / total) * 100) : 0;

                    return (
                      <div
                        key={item.name}
                        className="flex min-h-[76px] w-full items-center justify-between rounded-xl border border-border/60 bg-background/80 px-2 py-2 sm:min-h-[84px] sm:px-3 sm:py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
                            style={{ backgroundColor: item.color }}
                          />

                          <span className="truncate text-[14px] font-medium text-foreground sm:text-sm">
                            {item.name}
                          </span>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[14px] font-semibold text-foreground sm:text-sm">
                            {formatNumber(item.value)}
                          </p>

                          <p className="text-[12px] text-muted-foreground sm:text-xs">
                            {percent}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                <div className="mb-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("distribution.inventoryStatus")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("distribution.inventorySubtitle")}
                  </p>
                </div>
                <div className="h-[180px] sm:h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={inventoryPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={2}
                        dataKey="value"
                        label={false}
                        labelLine={false}
                      >
                        {inventoryPieData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatNumber(v as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
                  {inventoryPieData.map((item) => {
                    const total = inventoryPieData.reduce(
                      (sum, entry) => sum + entry.value,
                      0,
                    );

                    const percent =
                      total > 0 ? Math.round((item.value / total) * 100) : 0;

                    return (
                      <div
                        key={item.name}
                        className="flex min-h-[76px] w-full items-center justify-between rounded-xl border border-border/60 bg-background/80 px-2 py-2 sm:min-h-[84px] sm:px-3 sm:py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
                            style={{ backgroundColor: item.color }}
                          />

                          <span className="truncate text-[12px] font-medium text-foreground sm:text-sm">
                            {item.name}
                          </span>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[10px] font-semibold text-foreground sm:text-sm">
                            {formatNumber(item.value)}
                          </p>

                          <p className="text-[12px] text-muted-foreground sm:text-xs">
                            {percent}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </SectionShell>
        </div>

        {/* Weekly Comparison Bar Chart */}
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionShell
            title={t("weekly.title")}
            subtitle={t("weekly.subtitle")}
          >
            <div className="h-[220px] sm:h-[260px] lg:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={combinedChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    yAxisId="left"
                    stroke={CHART_COLORS.primary}
                    tickFormatter={(v) => formatCompactNumber(v)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke={CHART_COLORS.success}
                  />
                  <Tooltip
                    formatter={(value: number | string, name: string) => [
                      name === t("weekly.revenueBdt")
                        ? formatCurrency(Number(value || 0))
                        : formatNumber(Number(value || 0)),
                      name,
                    ]}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="revenue"
                    fill={CHART_COLORS.primary}
                    name={t("weekly.revenueBdt")}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="orders"
                    stroke={CHART_COLORS.success}
                    name={t("chartTypes.orders")}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </SectionShell>

          {/* Top Products Horizontal Bar */}
          <SectionShell
            title={t("topProducts.title")}
            subtitle={t("topProducts.subtitle")}
          >
            <div className="h-[240px] sm:h-[280px] lg:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topProductsData}
                  layout="vertical"
                  margin={{ left: 24, right: 8, top: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatCompactNumber(v)}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    width={72}
                    fontSize={11}
                  />
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  <Bar
                    dataKey="revenue"
                    fill={CHART_COLORS.purple}
                    name={t("chartTypes.revenue")}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionShell>
        </div>

        {/* Order Pipeline & Quick Actions */}
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionShell
            title={t("orders.title")}
            subtitle={t("orders.subtitle")}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: t("orders.pending"),
                    value: stats.pendingOrders,
                    tone: "warn" as Tone,
                  },
                  { label: t("orders.processing"), value: dashboard.processingOrders },
                  { label: t("orders.shipped"), value: dashboard.shippedOrders },
                  {
                    label: t("orders.delivered"),
                    value: dashboard.deliveredOrders,
                    tone: "good" as Tone,
                  },
                  {
                    label: t("orders.cancelled"),
                    value: dashboard.cancelledOrders,
                    tone: "danger" as Tone,
                  },
                  {
                    label: t("orders.unpaid"),
                    value: dashboard.unpaidOrders,
                    tone: "warn" as Tone,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-border bg-muted/30 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {item.label}
                      </span>
                      {item.tone && (
                        <StatusPill label={t("orders.live")} tone={item.tone} />
                      )}
                    </div>
                    <p className="mt-1 text-xl font-semibold">
                      {formatNumber(item.value)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <h3 className="mb-2 text-sm font-semibold">{t("orders.recent")}</h3>
                <InsightList
                  items={stats.recentOrders.slice(0, 4).map((order) => ({
                    id: order.id,
                    title: `#${order.id}`,
                    subtitle: order.user?.name || t("orders.guest"),
                    status: order.status,
                    tone:
                      order.status === "DELIVERED"
                        ? "good"
                        : order.status === "PENDING"
                          ? "warn"
                          : "default",
                    value: formatCurrency(order.grandTotal),
                  }))}
                  emptyLabel={t("orders.empty")}
                />
              </div>
            </div>
          </SectionShell>

          <SectionShell
            title={t("warehouse.title")}
            subtitle={t("warehouse.subtitle")}
          >
            <div className="h-[220px] sm:h-[260px] lg:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={warehouseData} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    width={68}
                    fontSize={11}
                  />
                  <Tooltip formatter={(v) => formatNumber(v as number)} />
                  <Bar
                    dataKey="value"
                    fill={CHART_COLORS.cyan}
                    name={t("warehouse.units")}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("warehouse.totalVariants")}</p>
                <p className="text-lg font-bold">
                  {formatNumber(dashboard.totalVariants)}
                </p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("warehouse.reservedUnits")}</p>
                <p className="text-lg font-bold">
                  {formatNumber(dashboard.reservedUnits)}
                </p>
              </div>
            </div>
          </SectionShell>

          <SectionShell
            title={t("quickActions.title")}
            subtitle={t("quickActions.subtitle")}
          >
            <div className="space-y-3">
              {[
                {
                  href: "/admin/operations/products",
                  label: t("quickActions.addProduct"),
                  description: t("quickActions.addProductDescription"),
                  icon: Package,
                },
                {
                  href: "/admin/operations/orders",
                  label: t("quickActions.viewOrders"),
                  description: t("quickActions.viewOrdersDescription"),
                  icon: ShoppingCart,
                },
                {
                  href: "/admin/warehouse/stock",
                  label: t("quickActions.checkStock"),
                  description: t("quickActions.checkStockDescription"),
                  icon: PackageSearch,
                },
                {
                  href: "/admin/management/coupons",
                  label: t("quickActions.createCoupon"),
                  description: t("quickActions.createCouponDescription"),
                  icon: Percent,
                },
                {
                  href: "/admin/chat",
                  label: t("quickActions.supportInbox"),
                  description: t("quickActions.supportInboxDescription"),
                  icon: MessageSquareMore,
                },
              ].map((action) => (
                <QuickAction key={action.label} {...action} />
              ))}
            </div>
          </SectionShell>
        </div>

        {/* Customer & Marketing Insights */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionShell
            title={t("customers.title")}
            subtitle={t("customers.subtitle")}
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: t("customers.totalUsers"), value: stats.totalUsers, icon: Users },
                {
                  label: t("customers.activeBuyers"),
                  value: dashboard.activeBuyers,
                  icon: UserRound,
                },
                {
                  label: t("customers.repeatRate"),
                  value: `${((dashboard.repeatCustomers / stats.totalUsers) * 100).toFixed(1)}%`,
                  icon: CheckCircle2,
                },
                {
                  label: t("customers.avgRating"),
                  value: dashboard.reviewAverage.toFixed(1),
                  icon: Star,
                  suffix: "★",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border bg-muted/30 p-4 text-center"
                >
                  <item.icon className="mx-auto h-5 w-5 text-muted-foreground" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="text-xl font-bold">
                    {item.value}
                    {item.suffix || ""}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
              <h3 className="mb-2 text-sm font-semibold">{t("customers.topCustomers")}</h3>
              <InsightList
                items={dashboard.topCustomers.slice(0, 5)}
                emptyLabel={t("common.noData")}
              />
            </div>
          </SectionShell>

          <SectionShell
            title={t("marketing.title")}
            subtitle={t("marketing.subtitle")}
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("marketing.liveUsers")}</p>
                <p className="text-xl font-bold">
                  {formatNumber(dashboard.liveUsers)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("marketing.totalVisitors")}</p>
                <p className="text-xl font-bold">
                  {formatNumber(dashboard.sessions)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("marketing.pageviews")}</p>
                <p className="text-xl font-bold">
                  {formatNumber(dashboard.pageViews)}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("marketing.trafficVisitors")}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("marketing.visitorTrend")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {t("marketing.totalVisitors")}
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {formatNumber(dashboard.sessions)}
                  </p>
                </div>
              </div>
              {visitorTrendData.length ? (
                <div className="space-y-4">
                  <div className="h-[170px] sm:h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={visitorTrendData}>
                        <defs>
                          <linearGradient
                            id="visitorTrendFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={CHART_COLORS.teal}
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="95%"
                              stopColor={CHART_COLORS.teal}
                              stopOpacity={0.04}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="name"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(v) => formatCompactNumber(v)}
                        />
                        <Tooltip
                          formatter={(value: number | string) => [
                            formatNumber(Number(value || 0)),
                            t("marketing.visitors"),
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="visitors"
                          name={t("marketing.visitors")}
                          stroke={CHART_COLORS.teal}
                          fill="url(#visitorTrendFill)"
                          strokeWidth={2.5}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-background/70 p-3">
                      <p className="text-xs text-muted-foreground">
                        {t("marketing.pageViews")}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {formatNumber(dashboard.pageViews)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-background/70 p-3">
                      <p className="text-xs text-muted-foreground">
                        {t("marketing.averageSlice")}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {formatNumber(
                          Math.round(
                            dashboard.sessions /
                              Math.max(visitorTrendData.length, 1),
                          ),
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                  {t("marketing.noVisitorData")}
                </div>
              )}
            </div>
          </SectionShell>
        </div>

        {/* Support & Activity */}
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionShell
            title={t("support.title")}
            subtitle={t("support.subtitle")}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                <LifeBuoy className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-2xl font-bold">
                  {formatNumber(dashboard.openChats)}
                </p>
                <p className="text-xs text-muted-foreground">{t("support.openChats")}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                <WalletCards className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-2xl font-bold">
                  {formatNumber(dashboard.refundRequests)}
                </p>
                <p className="text-xs text-muted-foreground">{t("support.refundRequests")}</p>
              </div>
            </div>
            <div className="mt-4">
              <InsightList
                items={dashboard.recentConversations.slice(0, 4)}
                emptyLabel={t("support.noConversations")}
              />
            </div>
          </SectionShell>

          <SectionShell
            title={t("alerts.title")}
            subtitle={t("alerts.subtitle")}
          >
            <InsightList
              items={dashboard.lowStockAlerts.slice(0, 6)}
              emptyLabel={t("alerts.healthy")}
            />
          </SectionShell>

          <SectionShell
            title={t("activity.title")}
            subtitle={t("activity.subtitle")}
          >
            <InsightList
              items={dashboard.latestActivity.slice(0, 6)}
              emptyLabel={t("activity.empty")}
            />
          </SectionShell>
        </div>
      </div>
    </div>
  );
}

const MemoizedAdminDashboard = memo(AdminDashboard);
export default MemoizedAdminDashboard;
export type {
  DashboardStats,
  DashboardOrder,
  DashboardProduct,
  AdminDashboardViewModel,
};
