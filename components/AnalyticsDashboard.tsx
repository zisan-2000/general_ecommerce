"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useTransition,
} from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ComposedChart,
  Legend,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  FaFileAlt,
  FaEye,
  FaGlobeAmericas,
  FaRegChartBar,
  FaChrome,
  FaFirefoxBrowser,
  FaSafari,
  FaEdge,
  FaOpera,
  FaInternetExplorer,
} from "react-icons/fa";
import { useFormatter, useTranslations } from "next-intl";

interface Blog {
  id: number;
  post_title: string;
  post_status: string;
  createdAt?: string | null;
  _d?: Date | null;
}

type TrendInfo = { value: string; isPositive: boolean };

type AnalyticsBucket = "hour" | "day";
type RangePreset = "today" | "24h" | "7d" | "30d" | "custom";
type TabKey = "traffic" | "sources" | "geo" | "devices";
type DeviceTabKey = "deviceType" | "browser" | "os";

type AnalyticsSummary = {
  kpis: {
    visitors: number;
    pageViews: number;
    activeTimeSec: number;
    avgActiveTimeSec: number;
    liveUsers: number;
  };
  series: { t: string; visitors: number; pageViews: number }[];
  topPages: { path: string; views: number; avgActiveTimeSec: number }[];
  sources: { name: string; count: number }[];
  devices: {
    deviceType: { name: string; count: number }[];
    browser: { name: string; count: number }[];
    os: { name: string; count: number }[];
  };
  geo: {
    enabled: boolean;
    countries: { name: string; count: number }[];
    cities: { name: string; count: number }[];
  };
};

// ---------- helpers ----------
function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

// ✅ idle callback helper
const runIdle = (cb: () => void) => {
  if (typeof window === "undefined") return cb();
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(cb, { timeout: 500 });
  } else {
    setTimeout(cb, 0);
  }
};

// ✅ AbortError checker
function isAbortError(err: unknown) {
  return err instanceof DOMException && err.name === "AbortError";
}

// ---------- Skeleton helpers ----------
const SkeletonBox: React.FC<{ className?: string }> = React.memo(
  function SkeletonBox({ className = "" }) {
    return <div className={`animate-pulse bg-muted rounded ${className}`} />;
  }
);
SkeletonBox.displayName = "SkeletonBox";

const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = React.memo(
  function TableSkeleton({ rows = 5, cols = 4 }) {
    return (
      <div className="p-4">
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: cols }).map((__, j) => (
                <SkeletonBox key={j} className="h-4" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
);
TableSkeleton.displayName = "TableSkeleton";

// ---------- Analytics helpers ----------
const fmtSec = (sec: number) => {
  if (!sec || sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m <= 0) return `${s}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${m}m ${s}s`;
  return `${h}h ${mm}m`;
};
function toISO(d: Date) {
  return d.toISOString();
}

// ✅ Devices UI helpers (NEW)
const pct = (part: number, total: number) =>
  total <= 0 ? 0 : Math.round((part / total) * 1000) / 10;

const PIE_COLORS = [
  "hsl(var(--analytics-chart-1))",
  "hsl(var(--analytics-chart-2))",
  "hsl(var(--analytics-chart-3))",
  "hsl(var(--analytics-chart-4))",
  "hsl(var(--analytics-chart-5))",
];

const AnalyticsDashboard: React.FC = () => {
  const t = useTranslations("AdminAnalytics");
  const formatter = useFormatter();
  const formatNumber = (value: number) => formatter.number(value || 0);
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return t("duration.seconds", { count: 0 });
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    if (minutes <= 0) return t("duration.seconds", { count: remainingSeconds });
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours <= 0) {
      return t("duration.minutesSeconds", {
        minutes,
        seconds: remainingSeconds,
      });
    }
    return t("duration.hoursMinutes", {
      hours,
      minutes: remainingMinutes,
    });
  };
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [isLoadingBlogs, setIsLoadingBlogs] = useState<boolean>(true);
  const [errorBlogs, setErrorBlogs] = useState<string | null>(null);

  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [editBlogData, setEditBlogData] = useState<Blog | null>(null);

  const [isPending, startTransition] = useTransition();


  // ---------- Analytics state ----------
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [rangePreset, setRangePreset] = useState<RangePreset>("7d");
  const [bucket, setBucket] = useState<AnalyticsBucket>("day");
  const [tab, setTab] = useState<TabKey>("traffic");

  // ✅ keep your existing selector, but devices UI now only uses deviceType/os mainly
  const [deviceTab, setDeviceTab] = useState<DeviceTabKey>("deviceType");

  const tabOptions: Array<{ key: TabKey; label: string }> = [
    { key: "traffic", label: t("tabs.traffic") },
    { key: "sources", label: t("tabs.sources") },
    { key: "geo", label: t("tabs.geo") },
    { key: "devices", label: t("tabs.devices") },
  ];

  const deviceTabOptions: Array<{ key: DeviceTabKey; label: string }> = [
    { key: "deviceType", label: t("deviceTabs.deviceType") },
    { key: "browser", label: t("deviceTabs.browser") },
    { key: "os", label: t("deviceTabs.os") },
  ];

  const BrowserLogo: React.FC<{ name?: string }> = ({ name }) => {
    const n = (name || "").toLowerCase();

    if (n.includes("chrome")) return <FaChrome className="text-analytics-chart-1" />;
    if (n.includes("firefox"))
      return <FaFirefoxBrowser className="text-analytics-chart-2" />;
    if (n.includes("safari")) return <FaSafari className="text-analytics-chart-3" />;
    if (n.includes("edge")) return <FaEdge className="text-analytics-chart-4" />;
    if (n.includes("opera")) return <FaOpera className="text-analytics-chart-5" />;
    if (n.includes("ie") || n.includes("internet explorer"))
      return <FaInternetExplorer className="text-analytics-accent" />;

    // fallback icon
    return <FaGlobeAmericas className="text-muted-foreground" />;
  };
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  // ---------- Analytics range + fetch ----------
  const resolveRange = useCallback(() => {
    const now = new Date();
    if (rangePreset === "today") {
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      return {
        from: startOfToday,
        to: now,
        bucket: "hour" as AnalyticsBucket,
      };
    }
    if (rangePreset === "24h")
      return {
        from: addDays(now, -1),
        to: now,
        bucket: "hour" as AnalyticsBucket,
      };
    if (rangePreset === "7d")
      return { from: addDays(now, -7), to: now, bucket };
    if (rangePreset === "30d")
      return { from: addDays(now, -30), to: now, bucket };
    const f = customFrom ? new Date(customFrom) : addDays(now, -7);
    const tBase = customTo ? new Date(customTo) : now;
    const t = customTo ? addDays(tBase, 1) : now; // treat custom end date as inclusive
    return { from: f, to: t, bucket };
  }, [rangePreset, bucket, customFrom, customTo]);

  useEffect(() => {
    const controller = new AbortController();

    const loadAnalytics = async () => {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      try {
        const { from, to, bucket: resolvedBucket } = resolveRange();
        if (to <= from) {
          setAnalyticsError(
            t("errors.invalidDateRange")
          );
          setAnalyticsLoading(false);
          return;
        }
        const qs = new URLSearchParams({
          from: toISO(from),
          to: toISO(to),
          bucket: resolvedBucket,
        });

        const res = await fetch(
          `/api/analytics/summary?${qs.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          let message = t("errors.loadWithStatus", { status: res.status });
          try {
            const body = await res.clone().json();
            if (typeof body?.error === "string" && body.error.trim()) {
              message = body.error;
            }
          } catch {
            // ignore
          }
          try {
            const text = await res.text();
            if (text.trim()) message = text;
          } catch {
            // ignore
          }
          throw new Error(message);
        }
        const data = (await res.json()) as AnalyticsSummary;
        startTransition(() => setAnalytics(data));
      } catch (e) {
        if (isAbortError(e)) return;
        console.error(e);
        setAnalyticsError(
          e instanceof Error ? e.message : t("errors.load")
        );
      } finally {
        setAnalyticsLoading(false);
      }
    };

    loadAnalytics();
    return () => controller.abort();
  }, [resolveRange, startTransition, t]);

  // ✅ devices data memo
  const deviceTypeRows = useMemo(
    () => analytics?.devices?.deviceType ?? [],
    [analytics]
  );
  const osRows = useMemo(() => analytics?.devices?.os ?? [], [analytics]);
  const browserRows = useMemo(
    () => analytics?.devices?.browser ?? [],
    [analytics]
  );

  const deviceTypeTotal = useMemo(
    () => deviceTypeRows.reduce((a, x) => a + (x.count || 0), 0),
    [deviceTypeRows]
  );
  const osTotal = useMemo(
    () => osRows.reduce((a, x) => a + (x.count || 0), 0),
    [osRows]
  );

  const deviceTypePie = useMemo(
    () =>
      deviceTypeRows.map((r) => ({
        name: r.name || t("common.unknown"),
        value: r.count || 0,
      })),
    [deviceTypeRows, t]
  );

  return (
    <div className="bg-background min-h-screen text-foreground">
      {/* ---------- NEW Analytics ---------- */}
      <section className="bg-card rounded-xl shadow-sm p-5 mb-8 border-border">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {t("title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={rangePreset}
              onChange={(e) => setRangePreset(e.target.value as RangePreset)}
              className="text-sm border border-border rounded-lg px-3 py-2 bg-card"
            >
              <option value="today">{t("ranges.today")}</option>
              <option value="24h">{t("ranges.last24Hours")}</option>
              <option value="7d">{t("ranges.last7Days")}</option>
              <option value="30d">{t("ranges.last30Days")}</option>
              <option value="custom">{t("ranges.custom")}</option>
            </select>

            {rangePreset === "custom" && (
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2"
                />
                <span className="text-muted-foreground text-sm">{t("ranges.to")}</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            )}

            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value as AnalyticsBucket)}
              className="text-sm border border-border rounded-lg px-3 py-2 bg-card"
              disabled={rangePreset === "24h"}
              title={rangePreset === "24h" ? t("ranges.hourlyHint") : ""}
            >
              <option value="hour">{t("ranges.hourly")}</option>
              <option value="day">{t("ranges.daily")}</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 mt-5">
          <StatCard
            title={t("kpis.liveUsers")}
            value={
              analyticsLoading
                ? "…"
                : formatNumber(analytics?.kpis.liveUsers ?? 0)
            }
            icon={<FaGlobeAmericas className="text-xl text-white" />}
            color="bg-analytics-primary"
            loading={analyticsLoading || isPending}
          />
          <StatCard
            title={t("kpis.totalVisitors")}
            value={
              analyticsLoading
                ? "…"
                : formatNumber(analytics?.kpis.visitors ?? 0)
            }
            icon={<FaEye className="text-xl text-white" />}
            color="bg-analytics-chart-1"
            loading={analyticsLoading || isPending}
          />
          <StatCard
            title={t("kpis.pageViews")}
            value={
              analyticsLoading
                ? "…"
                : formatNumber(analytics?.kpis.pageViews ?? 0)
            }
            icon={<FaRegChartBar className="text-xl text-white" />}
            color="bg-analytics-chart-2"
            loading={analyticsLoading || isPending}
          />
          <StatCard
            title={t("kpis.totalActiveTime")}
            value={
              analyticsLoading
                ? "…"
                : formatDuration(analytics?.kpis.activeTimeSec ?? 0)
            }
            icon={<FaFileAlt className="text-xl text-white" />}
            color="bg-analytics-chart-3"
            loading={analyticsLoading || isPending}
          />
          <StatCard
            title={t("kpis.avgActiveTime")}
            value={
              analyticsLoading
                ? "…"
                : formatDuration(analytics?.kpis.avgActiveTimeSec ?? 0)
            }
            icon={<FaGlobeAmericas className="text-xl text-white" />}
            color="bg-analytics-chart-4"
            loading={analyticsLoading || isPending}
          />
        </div>

        {analyticsError && (
          <div className="mt-4 text-sm text-destructive">{analyticsError}</div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mt-6 border-b border-border">
          {tabOptions.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                tab === t.key
                  ? "bg-muted text-foreground border border-border border-b-0"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="pt-5">
          {analyticsLoading ? (
            <SkeletonBox className="h-[320px] w-full" />
          ) : !analytics ? (
            <div className="text-muted-foreground text-sm">{t("empty.analytics")}</div>
          ) : tab === "traffic" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Visitors Chart */}
              <div className="bg-gradient-to-br from-card to-muted rounded-2xl p-5 border border-border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {t("traffic.visitorsOverTime")}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("traffic.uniqueVisitorsTrend")}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-analytics-primary/20 flex items-center justify-center">
                    <FaEye className="text-analytics-primary text-sm" />
                  </div>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={analytics.series}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="visitorsGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--analytics-chart-1))"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--analytics-chart-1))"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                        strokeOpacity={0.5}
                      />
                      <XAxis
                        dataKey="t"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                        tickFormatter={(value) => {
                          if (bucket === "hour") return value.slice(11, 16);
                          return value.slice(5, 10);
                        }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid hsl(var(--border))",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                          fontSize: "12px",
                        }}
                        formatter={(value) => [value, t("common.visitors")]}
                        labelFormatter={(label) => t("common.timeValue", { value: label })}
                      />
                      <Area
                        type="monotone"
                        dataKey="visitors"
                        stroke="hsl(var(--analytics-chart-1))"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#visitorsGradient)"
                        dot={{ stroke: "hsl(var(--analytics-chart-1))", strokeWidth: 2, r: 3 }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {analytics.series.length > 0 && (
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                    <div className="w-3 h-3 rounded-full bg-analytics-chart-1"></div>
                    <span className="text-xs text-muted-foreground">
                      {t("traffic.peakVisitors", {
                        count: Math.max(...analytics.series.map((s) => s.visitors)),
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Page Views Chart */}
              <div className="bg-gradient-to-br from-card to-muted rounded-2xl p-5 border border-border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {t("traffic.pageViewsOverTime")}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("traffic.pageViewsTrend")}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-analytics-chart-2/20 flex items-center justify-center">
                    <FaRegChartBar className="text-analytics-chart-2 text-sm" />
                  </div>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={analytics.series}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="pageViewsGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--analytics-chart-2))"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--analytics-chart-2))"
                            stopOpacity={0.2}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                        strokeOpacity={0.5}
                      />
                      <XAxis
                        dataKey="t"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                        tickFormatter={(value) => {
                          if (bucket === "hour") return value.slice(11, 16);
                          return value.slice(5, 10);
                        }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid hsl(var(--border))",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                          fontSize: "12px",
                        }}
                        formatter={(value) => [value, t("kpis.pageViews")]}
                        labelFormatter={(label) => t("common.timeValue", { value: label })}
                      />
                      <Bar
                        dataKey="pageViews"
                        fill="url(#pageViewsGradient)"
                        radius={[6, 6, 0, 0]}
                        barSize={bucket === "hour" ? 12 : 24}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {analytics.series.length > 0 && (
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                    <div className="w-3 h-3 rounded-full bg-analytics-chart-2"></div>
                    <span className="text-xs text-muted-foreground">
                      {t("traffic.totalPageViews", {
                        count: analytics.series.reduce(
                          (acc, s) => acc + s.pageViews,
                          0
                        ),
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Top Pages Table */}
              <div className="lg:col-span-2 bg-gradient-to-br from-card to-muted rounded-2xl border border-border overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border bg-gradient-to-r from-muted to-card">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-semibold text-foreground">
                      {t("pages.title")}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {t("pages.sortedByViews")}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-6 py-4 text-left font-medium">
                          {t("pages.path")}
                        </th>
                        <th className="px-6 py-4 text-left font-medium">
                          {t("pages.views")}
                        </th>
                        <th className="px-6 py-4 text-left font-medium">
                          {t("pages.avgActiveTime")}
                        </th>
                        <th className="px-6 py-4 text-left font-medium">
                          {t("pages.engagement")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {(analytics.topPages ?? []).length ? (
                        analytics.topPages.map((p, index) => (
                          <tr
                            key={p.path}
                            className="hover:bg-muted/50 transition-colors group"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center text-xs font-bold">
                                  {index + 1}
                                </div>
                                <span className="font-medium text-foreground truncate max-w-xs">
                                  {p.path}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">
                                  {formatNumber(p.views)}
                                </span>
                                <div className="w-24 bg-muted rounded-full h-2">
                                  <div
                                    className="bg-analytics-chart-2 h-2 rounded-full"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        (p.views /
                                          (analytics.topPages[0]?.views || 1)) *
                                          100
                                      )}%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-analytics-accent/20 text-analytics-accent rounded-full">
                                <div className="w-2 h-2 rounded-full bg-analytics-accent animate-pulse"></div>
                                <span className="text-sm font-medium">
                                  {formatDuration(p.avgActiveTimeSec)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-3 h-3 rounded-full ${
                                    p.avgActiveTimeSec > 120
                                      ? "bg-green-500"
                                      : p.avgActiveTimeSec > 60
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                  }`}
                                ></div>
                                <span className="text-sm text-muted-foreground">
                                  {p.avgActiveTimeSec > 120
                                    ? t("pages.high")
                                    : p.avgActiveTimeSec > 60
                                    ? t("pages.medium")
                                    : t("pages.low")}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-8 text-center text-muted-foreground"
                          >
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                <FaFileAlt className="text-muted-foreground" />
                              </div>
                              <p>{t("empty.pages")}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : tab === "sources" ? (
            <div className="bg-gradient-to-br from-card to-muted rounded-2xl p-5 border border-border shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {t("sources.title")}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("sources.subtitle")}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-analytics-chart-3/20 flex items-center justify-center">
                  <FaGlobeAmericas className="text-analytics-chart-3 text-sm" />
                </div>
              </div>
              <div className="h-[320px]">
                {analytics.sources?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.sources}
                      margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
                      barCategoryGap="20%"
                    >
                      <defs>
                        <linearGradient
                          id="sourceGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--analytics-chart-3))"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--analytics-chart-3))"
                            stopOpacity={0.3}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                        strokeOpacity={0.5}
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid hsl(var(--border))",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                          fontSize: "12px",
                        }}
                        formatter={(value) => [value, t("sources.visits")]}
                      />
                      <Bar
                        dataKey="count"
                        fill="url(#sourceGradient)"
                        radius={[6, 6, 0, 0]}
                        barSize={30}
                        animationDuration={1500}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                        <FaGlobeAmericas className="text-muted-foreground text-xl" />
                      </div>
                      <p>{t("empty.sources")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : tab === "geo" ? (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-card to-muted rounded-2xl p-5 border border-border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("geo.title")}
                  </h3>
                  <div className="w-10 h-10 rounded-full bg-analytics-primary/20 flex items-center justify-center">
                    <FaGlobeAmericas className="text-analytics-primary text-sm" />
                  </div>
                </div>
                {!analytics.geo?.enabled ? (
                  <div className="p-6 bg-card rounded-xl border border-border text-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <FaGlobeAmericas className="text-muted-foreground text-xl" />
                    </div>
                    <p className="text-foreground mb-2">
                      {t("geo.notConfigured")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("geo.configurationHint")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Countries */}
                    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                      <div className="p-4 border-b border-border bg-gradient-to-r from-muted/70 to-card">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-analytics-chart-4"></div>
                          {t("geo.topCountries")}
                        </h4>
                      </div>
                      <div className="p-2">
                        {(analytics.geo.countries ?? []).map((c, index) => (
                          <div
                            key={c.name}
                            className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center text-xs font-bold">
                                {index + 1}
                              </div>
                              <span className="font-medium text-foreground">
                                {c.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-foreground">
                                {formatNumber(c.count)}
                              </span>
                              <div className="w-32 bg-muted rounded-full h-2">
                                <div
                                  className="bg-analytics-chart-4 h-2 rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (c.count /
                                        (analytics.geo.countries[0]?.count ||
                                          1)) *
                                        100
                                    )}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cities */}
                    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                      <div className="p-4 border-b border-border bg-gradient-to-r from-analytics-chart-2/20 to-card">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-analytics-chart-2"></div>
                          {t("geo.topCities")}
                        </h4>
                      </div>
                      <div className="p-2">
                        {(analytics.geo.cities ?? []).map((c, index) => (
                          <div
                            key={c.name}
                            className="flex items-center justify-between p-3 hover:bg-analytics-chart-2/10 rounded-lg transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-analytics-chart-2/20 text-analytics-chart-2 flex items-center justify-center text-xs font-bold">
                                {index + 1}
                              </div>
                              <span className="font-medium text-foreground">
                                {c.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-foreground">
                                {formatNumber(c.count)}
                              </span>
                              <div className="w-32 bg-muted rounded-full h-2">
                                <div
                                  className="bg-analytics-chart-2 h-2 rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (c.count /
                                        (analytics.geo.cities[0]?.count || 1)) *
                                        100
                                    )}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // ✅✅✅ DEVICES TAB UPDATED LIKE SCREENSHOT ✅✅✅
            <div className="space-y-6">
              {/* Sub Tabs */}
              <div className="flex flex-wrap gap-2">
                {deviceTabOptions.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setDeviceTab(t.key)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${
                      deviceTab === t.key
                        ? "bg-card border-border text-foreground shadow-sm"
                        : "bg-muted border-border text-muted-foreground hover:bg-card"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {deviceTab === "deviceType" ? (
                <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                  {/* Left: Device Types Pie */}
                  <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                    <div className="mb-1">
                      <h3 className="text-sm font-semibold text-foreground">
                        Device Types
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Distribution of device categories
                      </p>
                    </div>

                    {deviceTypeTotal > 0 ? (
                      <div className="h-[280px] mt-8">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={deviceTypePie}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="45%"
                              innerRadius={55}
                              outerRadius={90}
                              paddingAngle={2}
                              labelLine={false}
                              label={({ name, value }) =>
                                `${name}: ${pct(
                                  value as number,
                                  deviceTypeTotal
                                )}%`
                              }
                            >
                              {deviceTypePie.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                                />
                              ))}
                            </Pie>

                            <Tooltip
                              formatter={(value, name) => [
                                `${numberFormatter.format(Number(value))} (${pct(
                                  Number(value),
                                  deviceTypeTotal
                                )}%)`,
                                name,
                              ]}
                            />
                            <Legend verticalAlign="bottom" height={26} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                        No device data
                      </div>
                    )}
                  </div>
                </div>
              ) : deviceTab === "browser" ? (
                <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                  <div className="mb-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      Browser Usage
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Top browsers with icons + percentage
                    </p>
                  </div>

                  {browserRows?.length ? (
                    <div className="mt-4 space-y-4">
                      {(() => {
                        const total =
                          browserRows.reduce((a, x) => a + (x.count || 0), 0) ||
                          0;

                        return browserRows.slice(0, 12).map((b, i) => {
                          const p = pct(b.count, total);
                          return (
                            <div key={`${b.name}-${i}`} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center">
                                    <BrowserLogo name={b.name} />
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-foreground">
                                      {b.name}
                                    </div>
                                    {/* <div className="text-xs text-gray-500">
                                      {numberFormatter.format(b.count)} users
                                    </div> */}
                                  </div>
                                </div>

                                <div className="text-sm text-foreground font-medium">
                                  {p.toFixed(1)}%
                                </div>
                              </div>

                              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-2 rounded-full bg-analytics-chart-1"
                                  style={{ width: `${Math.min(100, p)}%` }}
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                      No browser data
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                  <div className="mb-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      Operating Systems
                    </h3>
                    <p className="text-xs text-muted-foreground">Usage distribution</p>
                  </div>

                  {osTotal > 0 ? (
                    <div className="mt-4 space-y-4">
                      {osRows.slice(0, 12).map((r, i) => {
                        const p = pct(r.count, osTotal);
                        return (
                          <div key={`${r.name}-${i}`} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-foreground">
                                {r.name}
                              </span>
                              <span className="text-muted-foreground">
                                {p.toFixed(1)}%
                              </span>
                            </div>

                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-2 rounded-full bg-analytics-chart-3"
                                style={{ width: `${Math.min(100, p)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                      No OS data
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: TrendInfo | null;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = React.memo(function StatCard({
  title,
  value,
  icon,
  color,
  loading,
}) {
  return (
    <div className="bg-card rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="mt-1">
            {loading ? (
              <SkeletonBox className="h-7 w-20" />
            ) : (
              <h3 className="text-2xl font-bold text-foreground">{value}</h3>
            )}
          </div>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  );
});
StatCard.displayName = "StatCard";

export default AnalyticsDashboard;
