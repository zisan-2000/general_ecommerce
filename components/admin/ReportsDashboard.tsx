"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Download,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Truck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ReportsResponse = {
  filters: { from: string; to: string };
  sales: {
    summary: {
      totalOrders: number;
      deliveredOrders: number;
      paidOrders: number;
      subtotal: number;
      shippingTotal: number;
      vatTotal: number;
      grandTotal: number;
      refundTotal: number;
      netSales: number;
      unpaidTotal: number;
      averageOrderValue: number;
    };
    daily: Array<{
      date: string;
      orders: number;
      revenue: number;
      vat: number;
    }>;
    topProducts: Array<{
      productId: number;
      name: string;
      quantity: number;
      revenue: number;
    }>;
  };
  profit: {
    summary: {
      grossSales: number;
      estimatedCost: number;
      refundedEstimatedCost: number;
      netProfit: number;
      netMarginPct: number;
      completedRefunds: number;
      refundedUnits: number;
    };
    topVariants: Array<{
      variantId: number;
      sku: string;
      productName: string;
      optionsText: string;
      quantity: number;
      revenue: number;
      estimatedCost: number;
      grossProfit: number;
    }>;
  };
  vat: {
    summary: {
      totalVatCollected: number;
      inclusiveVatTotal: number;
      exclusiveVatTotal: number;
      taxedOrders: number;
    };
    byCountry: Array<{ country: string; vatAmount: number; orders: number }>;
    byClass: Array<{
      className: string;
      classCode: string;
      rate: number;
      inclusive: boolean;
      vatAmount: number;
    }>;
  };
  inventory: {
    summary: {
      totalVariants: number;
      totalUnits: number;
      reservedUnits: number;
      lowStockCount: number;
      outOfStockCount: number;
      movementIn: number;
      movementOut: number;
    };
    warehouses: Array<{
      warehouseId: number;
      name: string;
      code: string;
      quantity: number;
      reserved: number;
    }>;
    lowStock: Array<{
      variantId: number;
      sku: string;
      productName: string;
      stock: number;
      status: string;
    }>;
    movementReasons: Array<{ reason: string; change: number; events: number }>;
    recentLogs: Array<{
      id: number;
      createdAt: string;
      productName: string;
      variantSku: string;
      warehouseName: string;
      change: number;
    }>;
  };
  delivery: {
    summary: {
      totalShipments: number;
      delivered: number;
      outForDelivery: number;
      inTransit: number;
      returned: number;
      cancelled: number;
      proofConfirmed: number;
      proofPending: number;
    };
    byCourier: Array<{
      courier: string;
      shipments: number;
      delivered: number;
      proofs: number;
    }>;
    exceptions: Array<{
      shipmentId: number;
      orderId: number;
      courier: string;
      status: string;
      customer: string;
      phone: string;
      proofStatus: string;
    }>;
  };
};

type ExportSection = "sales" | "profit" | "vat" | "inventory" | "delivery";
type ReportTab = "overview" | ExportSection;

const QUICK_RANGES = [
  { key: "last7", days: 6 },
  { key: "last30", days: 29 },
  { key: "last90", days: 89 },
] as const;

function fmtDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value || 0);
}
function fmtNum(value: number) {
  return new Intl.NumberFormat("en-BD").format(value || 0);
}
function shiftRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);
  return { from: fmtDate(from), to: fmtDate(to) };
}

function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-500/20 bg-emerald-500/5"
      : tone === "warn"
        ? "border-amber-500/20 bg-amber-500/5"
        : "border-border/60 bg-card/95";
  return (
    <Card className={`${cls} shadow-sm`}>
      <CardContent className="p-5">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-3 text-2xl font-semibold">{value}</div>
        {hint ? (
          <div className="mt-2 text-sm text-muted-foreground">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Header({
  title,
  description,
  onExport,
  exportLabel,
}: {
  title: string;
  description: string;
  onExport: () => void;
  exportLabel: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className="h-4 w-4" />
        {exportLabel}
      </Button>
    </div>
  );
}

function GridTable({
  headers,
  rows,
  empty,
  cols,
}: {
  headers: string[];
  rows: React.ReactNode;
  empty: string;
  cols: number;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows || (
          <TableRow>
            <TableCell
              colSpan={cols}
              className="text-center text-muted-foreground"
            >
              {empty}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default function ReportsDashboard() {
  const t = useTranslations("AdminReports");

  const initialFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return fmtDate(d);
  }, []);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(() => fmtDate(new Date()));
  const [tab, setTab] = useState<ReportTab>("overview");
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = async (nextFrom: string, nextTo: string) => {
    try {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams({ from: nextFrom, to: nextTo });
      const res = await fetch(`/api/reports/overview?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ||
            t("errors.loadWithStatus", { status: res.status }),
        );
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = () =>
    startTransition(() => {
      void load(from, to);
    });
  const quick = (days: number) => {
    const next = shiftRange(days);
    setFrom(next.from);
    setTo(next.to);
    startTransition(() => {
      void load(next.from, next.to);
    });
  };
  const exportTab = (section: ExportSection) => {
    const qs = new URLSearchParams({ section, from, to });
    window.open(
      `/api/reports/export?${qs.toString()}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const topMetrics = useMemo(
    () =>
      data
        ? [
            {
              label: t("metrics.netSales"),
              value: fmtMoney(data.sales.summary.netSales),
              hint: t("metrics.refundImpact", {
                amount: fmtMoney(data.sales.summary.refundTotal),
              }),
            },
            {
              label: t("metrics.netProfit"),
              value: fmtMoney(data.profit.summary.netProfit),
              hint: t("metrics.netMargin", {
                pct: data.profit.summary.netMarginPct.toFixed(2),
              }),
              tone: "good" as const,
            },
            {
              label: t("metrics.collectedVat"),
              value: fmtMoney(data.vat.summary.totalVatCollected),
              hint: t("metrics.taxedOrders", {
                count: fmtNum(data.vat.summary.taxedOrders),
              }),
            },
            {
              label: t("metrics.lowStock"),
              value: fmtNum(data.inventory.summary.lowStockCount),
              hint: t("metrics.outOfStock", {
                count: fmtNum(data.inventory.summary.outOfStockCount),
              }),
              tone:
                data.inventory.summary.lowStockCount > 0
                  ? ("warn" as const)
                  : ("good" as const),
            },
            {
              label: t("metrics.proofPending"),
              value: fmtNum(data.delivery.summary.proofPending),
              hint: t("metrics.proofConfirmed", {
                count: fmtNum(data.delivery.summary.proofConfirmed),
              }),
              tone:
                data.delivery.summary.proofPending > 0
                  ? ("warn" as const)
                  : ("good" as const),
            },
          ]
        : [],
    [data, t],
  );

  const alerts = useMemo(
    () =>
      data
        ? [
            {
              title: t("alerts.refundPressure"),
              text: t("alerts.refundPressureText", {
                count: fmtNum(data.profit.summary.completedRefunds),
              }),
              active: data.profit.summary.completedRefunds > 0,
            },
            {
              title: t("alerts.stockPressure"),
              text: t("alerts.stockPressureText", {
                count: fmtNum(data.inventory.summary.lowStockCount),
              }),
              active: data.inventory.summary.lowStockCount > 0,
            },
            {
              title: t("alerts.proofGaps"),
              text: t("alerts.proofGapsText", {
                count: fmtNum(data.delivery.summary.proofPending),
              }),
              active: data.delivery.summary.proofPending > 0,
            },
          ].filter((x) => x.active)
        : [],
    [data, t],
  );

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-[30px] border border-border/60 bg-gradient-to-br from-card via-card to-muted/35 p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                {t("hero.badge")}
              </div>

              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {t("hero.title")}
                </h1>

                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t("hero.description")}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-2 grid-cols-3">
            {QUICK_RANGES.map((item) => (
              <Button
                key={item.key}
                className="btn-outline"
                size="sm"
                onClick={() => quick(item.days)}
              >
                {t(`quickRanges.${item.key}`)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-20 rounded-[24px] border border-border/70 bg-background/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-2 gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="reports-from">
                {t("filters.from")}
              </label>
              <Input
                id="reports-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="reports-to">
                {t("filters.to")}
              </label>
              <Input
                id="reports-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {tab !== "overview" ? (
              <Button variant="outline" onClick={() => exportTab(tab)}>
                <Download className="h-4 w-4" />
                {t("actions.exportSection", { section: t(`tabs.${tab}`) })}
              </Button>
            ) : null}
            <Button onClick={apply} disabled={loading || pending}>
              {loading || pending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t("actions.applyFilters")}
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-6 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-5">
        {topMetrics.map((m) => (
          <Metric
            key={m.label}
            label={m.label}
            value={m.value}
            hint={m.hint}
            tone={m.tone}
          />
        ))}
      </div>

      {data ? (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as ReportTab)}
          className="space-y-6"
        >
          <TabsList className="w-full justify-start overflow-x-auto rounded-[20px] border border-border/60 bg-card/85 p-1.5">
            {(
              [
                "overview",
                "sales",
                "profit",
                "vat",
                "inventory",
                "delivery",
              ] as ReportTab[]
            ).map((key) => (
              <TabsTrigger
                key={key}
                value={key}
                className="rounded-2xl px-4 py-2.5 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:data-[state=active]:bg-primary hover:data-[state=active]:text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground/80"
              >
                {t(`tabs.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardContent className="flex gap-4 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {t("overview.salesPulse.title")}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {t("overview.salesPulse.description")}
                    </div>
                    <div className="mt-3 text-lg font-semibold">
                      {t("overview.salesPulse.value", {
                        gross: fmtMoney(data.sales.summary.grandTotal),
                        net: fmtMoney(data.sales.summary.netSales),
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex gap-4 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {t("overview.taxSnapshot.title")}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {t("overview.taxSnapshot.description")}
                    </div>
                    <div className="mt-3 text-lg font-semibold">
                      {t("overview.taxSnapshot.value", {
                        vat: fmtMoney(data.vat.summary.totalVatCollected),
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex gap-4 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {t("overview.deliveryConfidence.title")}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {t("overview.deliveryConfidence.description")}
                    </div>
                    <div className="mt-3 text-lg font-semibold">
                      {t("overview.deliveryConfidence.value", {
                        delivered: fmtNum(data.delivery.summary.delivered),
                        pending: fmtNum(data.delivery.summary.proofPending),
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex gap-4 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {t("overview.inventoryHealth.title")}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {t("overview.inventoryHealth.description")}
                    </div>
                    <div className="mt-3 text-lg font-semibold">
                      {t("overview.inventoryHealth.value", {
                        units: fmtNum(data.inventory.summary.totalUnits),
                        low: fmtNum(data.inventory.summary.lowStockCount),
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{t("overview.snapshot.title")}</CardTitle>
                  <CardDescription>
                    {t("overview.snapshot.range", {
                      from: data.filters.from,
                      to: data.filters.to,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 grid-cols-2 xl:grid-cols-3">
                  <Metric
                    label={t("metrics.orders")}
                    value={fmtNum(data.sales.summary.totalOrders)}
                    hint={t("metrics.deliveredHint", {
                      count: fmtNum(data.sales.summary.deliveredOrders),
                    })}
                  />
                  <Metric
                    label={t("metrics.avgOrderValue")}
                    value={fmtMoney(data.sales.summary.averageOrderValue)}
                  />
                  <Metric
                    label={t("metrics.refunds")}
                    value={fmtMoney(data.sales.summary.refundTotal)}
                    hint={t("metrics.completedRefundsHint", {
                      count: fmtNum(data.profit.summary.completedRefunds),
                    })}
                  />
                  <Metric
                    label={t("metrics.warehouseUnits")}
                    value={fmtNum(data.inventory.summary.totalUnits)}
                    hint={t("metrics.reservedHint", {
                      count: fmtNum(data.inventory.summary.reservedUnits),
                    })}
                  />
                  <Metric
                    label={t("metrics.courierDelivered")}
                    value={fmtNum(data.delivery.summary.delivered)}
                    hint={t("metrics.inTransitHint", {
                      count: fmtNum(data.delivery.summary.inTransit),
                    })}
                  />
                  <Metric
                    label={t("metrics.vat")}
                    value={fmtMoney(data.vat.summary.totalVatCollected)}
                    hint={t("metrics.exclusiveVatHint", {
                      amount: fmtMoney(data.vat.summary.exclusiveVatTotal),
                    })}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t("priorityAlerts.title")}</CardTitle>
                  <CardDescription>
                    {t("priorityAlerts.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {alerts.length ? (
                    alerts.map((a) => (
                      <div
                        key={a.title}
                        className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"
                      >
                        <div className="text-sm font-medium">{a.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {a.text}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-700">
                      {t("priorityAlerts.empty")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t("overview.topProducts.title")}</CardTitle>
                  <CardDescription>
                    {t("overview.topProducts.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {GridTable({
                    headers: [
                      t("table.product"),
                      t("table.qty"),
                      t("table.revenue"),
                    ],
                    cols: 3,
                    empty: t("empty.topProducts"),
                    rows: data.sales.topProducts.slice(0, 5).map((row) => (
                      <TableRow key={row.productId}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="text-right">
                          {fmtNum(row.quantity)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(row.revenue)}
                        </TableCell>
                      </TableRow>
                    )) as unknown as React.ReactNode,
                  })}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>
                    {t("overview.deliveryExceptions.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("overview.deliveryExceptions.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {GridTable({
                    headers: [
                      t("table.shipment"),
                      t("table.courier"),
                      t("table.status"),
                    ],
                    cols: 3,
                    empty: t("empty.deliveryExceptions"),
                    rows: data.delivery.exceptions.slice(0, 5).map((row) => (
                      <TableRow key={row.shipmentId}>
                        <TableCell>#{row.shipmentId}</TableCell>
                        <TableCell>{row.courier}</TableCell>
                        <TableCell className="text-right">
                          {row.status.replaceAll("_", " ")}
                        </TableCell>
                      </TableRow>
                    )) as unknown as React.ReactNode,
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sales" className="space-y-6">
            <Header
              title={t("sales.title")}
              description={t("sales.description", {
                from: data.filters.from,
                to: data.filters.to,
              })}
              onExport={() => exportTab("sales")}
              exportLabel={t("actions.exportCsv")}
            />
            <div className="grid gap-4 lg:grid-cols-4">
              <Metric
                label={t("sales.grossRevenue")}
                value={fmtMoney(data.sales.summary.grandTotal)}
                hint={t("sales.avgOrderHint", {
                  amount: fmtMoney(data.sales.summary.averageOrderValue),
                })}
              />
              <Metric
                label={t("sales.netSales")}
                value={fmtMoney(data.sales.summary.netSales)}
                hint={t("sales.refundsHint", {
                  amount: fmtMoney(data.sales.summary.refundTotal),
                })}
              />
              <Metric
                label={t("sales.subtotal")}
                value={fmtMoney(data.sales.summary.subtotal)}
                hint={t("sales.shippingHint", {
                  amount: fmtMoney(data.sales.summary.shippingTotal),
                })}
              />
              <Metric
                label={t("sales.paidOrders")}
                value={fmtNum(data.sales.summary.paidOrders)}
                hint={t("sales.unpaidHint", {
                  amount: fmtMoney(data.sales.summary.unpaidTotal),
                })}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{t("sales.dailyRevenue.title")}</CardTitle>
                  <CardDescription>
                    {t("sales.dailyRevenue.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {GridTable({
                    headers: [
                      t("table.date"),
                      t("table.orders"),
                      t("table.revenue"),
                      t("table.vat"),
                    ],
                    cols: 4,
                    empty: t("empty.sales"),
                    rows: data.sales.daily.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell className="text-right">
                          {fmtNum(row.orders)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(row.revenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(row.vat)}
                        </TableCell>
                      </TableRow>
                    )) as unknown as React.ReactNode,
                  })}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t("sales.topSelling.title")}</CardTitle>
                  <CardDescription>
                    {t("sales.topSelling.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {GridTable({
                    headers: [
                      t("table.product"),
                      t("table.qty"),
                      t("table.revenue"),
                    ],
                    cols: 3,
                    empty: t("empty.topProducts"),
                    rows: data.sales.topProducts.map((row) => (
                      <TableRow key={row.productId}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="text-right">
                          {fmtNum(row.quantity)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(row.revenue)}
                        </TableCell>
                      </TableRow>
                    )) as unknown as React.ReactNode,
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="profit" className="space-y-6">
            <Header
              title={t("profit.title")}
              description={t("profit.description")}
              onExport={() => exportTab("profit")}
              exportLabel={t("actions.exportCsv")}
            />
            <div className="grid gap-4 lg:grid-cols-4">
              <Metric
                label={t("profit.grossSales")}
                value={fmtMoney(data.profit.summary.grossSales)}
              />
              <Metric
                label={t("profit.estimatedCost")}
                value={fmtMoney(data.profit.summary.estimatedCost)}
              />
              <Metric
                label={t("profit.netProfit")}
                value={fmtMoney(data.profit.summary.netProfit)}
                hint={t("metrics.netMargin", {
                  pct: data.profit.summary.netMarginPct.toFixed(2),
                })}
                tone="good"
              />
              <Metric
                label={t("profit.refundImpact")}
                value={fmtNum(data.profit.summary.completedRefunds)}
                hint={t("profit.refundedUnitsHint", {
                  count: fmtNum(data.profit.summary.refundedUnits),
                })}
                tone={
                  data.profit.summary.completedRefunds > 0 ? "warn" : "default"
                }
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>{t("profit.topVariants.title")}</CardTitle>
                <CardDescription>
                  {t("profit.topVariants.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {GridTable({
                  headers: [
                    t("table.variant"),
                    t("table.product"),
                    t("table.qty"),
                    t("table.revenue"),
                    t("table.cost"),
                    t("table.profit"),
                  ],
                  cols: 6,
                  empty: t("empty.profit"),
                  rows: data.profit.topVariants.map((row) => (
                    <TableRow key={row.variantId}>
                      <TableCell>
                        <div className="font-medium">{row.sku}</div>
                        {row.optionsText ? (
                          <div className="text-xs text-muted-foreground">
                            {row.optionsText}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{row.productName}</TableCell>
                      <TableCell className="text-right">
                        {fmtNum(row.quantity)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(row.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(row.estimatedCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(row.grossProfit)}
                      </TableCell>
                    </TableRow>
                  )) as unknown as React.ReactNode,
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vat" className="space-y-6">
            <Header
              title={t("vat.title")}
              description={t("vat.description")}
              onExport={() => exportTab("vat")}
              exportLabel={t("actions.exportCsv")}
            />
            <div className="grid gap-4 lg:grid-cols-4">
              <Metric
                label={t("vat.totalVat")}
                value={fmtMoney(data.vat.summary.totalVatCollected)}
              />
              <Metric
                label={t("vat.inclusiveVat")}
                value={fmtMoney(data.vat.summary.inclusiveVatTotal)}
              />
              <Metric
                label={t("vat.exclusiveVat")}
                value={fmtMoney(data.vat.summary.exclusiveVatTotal)}
              />
              <Metric
                label={t("vat.taxedOrders")}
                value={fmtNum(data.vat.summary.taxedOrders)}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{t("vat.byCountry.title")}</CardTitle>
                  <CardDescription>
                    {t("vat.byCountry.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {GridTable({
                    headers: [
                      t("table.country"),
                      t("table.orders"),
                      t("table.vat"),
                    ],
                    cols: 3,
                    empty: t("empty.vatCountry"),
                    rows: data.vat.byCountry.map((row) => (
                      <TableRow key={row.country}>
                        <TableCell>{row.country}</TableCell>
                        <TableCell className="text-right">
                          {fmtNum(row.orders)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(row.vatAmount)}
                        </TableCell>
                      </TableRow>
                    )) as unknown as React.ReactNode,
                  })}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t("vat.byClass.title")}</CardTitle>
                  <CardDescription>
                    {t("vat.byClass.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {GridTable({
                    headers: [
                      t("table.class"),
                      t("table.rate"),
                      t("table.inclusive"),
                      t("table.vat"),
                    ],
                    cols: 4,
                    empty: t("empty.vatClass"),
                    rows: data.vat.byClass.map((row) => (
                      <TableRow
                        key={`${row.classCode}-${row.rate}-${row.inclusive ? "i" : "e"}`}
                      >
                        <TableCell>
                          <div className="font-medium">{row.className}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.classCode}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.rate.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {row.inclusive ? t("common.yes") : t("common.no")}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(row.vatAmount)}
                        </TableCell>
                      </TableRow>
                    )) as unknown as React.ReactNode,
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <Header
              title={t("inventory.title")}
              description={t("inventory.description")}
              onExport={() => exportTab("inventory")}
              exportLabel={t("actions.exportCsv")}
            />
            <div className="grid gap-4 lg:grid-cols-4">
              <Metric
                label={t("inventory.trackedVariants")}
                value={fmtNum(data.inventory.summary.totalVariants)}
              />
              <Metric
                label={t("inventory.unitsOnHand")}
                value={fmtNum(data.inventory.summary.totalUnits)}
                hint={t("metrics.reservedHint", {
                  count: fmtNum(data.inventory.summary.reservedUnits),
                })}
              />
              <Metric
                label={t("inventory.lowStock")}
                value={fmtNum(data.inventory.summary.lowStockCount)}
                hint={t("metrics.outOfStock", {
                  count: fmtNum(data.inventory.summary.outOfStockCount),
                })}
                tone={
                  data.inventory.summary.lowStockCount > 0 ? "warn" : "default"
                }
              />
              <Metric
                label={t("inventory.movement")}
                value={t("inventory.movementValue", {
                  in: fmtNum(data.inventory.summary.movementIn),
                  out: fmtNum(data.inventory.summary.movementOut),
                })}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{t("inventory.warehouseStock.title")}</CardTitle>
                  <CardDescription>
                    {t("inventory.warehouseStock.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {GridTable({
                    headers: [
                      t("table.warehouse"),
                      t("table.quantity"),
                      t("table.reserved"),
                    ],
                    cols: 3,
                    empty: t("empty.warehouseStock"),
                    rows: data.inventory.warehouses.map((row) => (
                      <TableRow key={row.warehouseId}>
                        <TableCell>
                          <div className="font-medium">{row.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.code}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtNum(row.quantity)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtNum(row.reserved)}
                        </TableCell>
                      </TableRow>
                    )) as unknown as React.ReactNode,
                  })}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t("inventory.lowStockAlerts.title")}</CardTitle>
                  <CardDescription>
                    {t("inventory.lowStockAlerts.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {GridTable({
                    headers: [
                      t("table.variant"),
                      t("table.product"),
                      t("table.stock"),
                      t("table.status"),
                    ],
                    cols: 4,
                    empty: t("empty.lowStock"),
                    rows: data.inventory.lowStock.map((row) => (
                      <TableRow key={row.variantId}>
                        <TableCell>{row.sku}</TableCell>
                        <TableCell>{row.productName}</TableCell>
                        <TableCell className="text-right">
                          {fmtNum(row.stock)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.status.replaceAll("_", " ")}
                        </TableCell>
                      </TableRow>
                    )) as unknown as React.ReactNode,
                  })}
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{t("inventory.movementReasons.title")}</CardTitle>
                  <CardDescription>
                    {t("inventory.movementReasons.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {GridTable({
                    headers: [
                      t("table.reason"),
                      t("table.events"),
                      t("table.netChange"),
                    ],
                    cols: 3,
                    empty: t("empty.movementReasons"),
                    rows: data.inventory.movementReasons
                      .slice(0, 10)
                      .map((row) => (
                        <TableRow key={row.reason}>
                          <TableCell>{row.reason}</TableCell>
                          <TableCell className="text-right">
                            {fmtNum(row.events)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmtNum(row.change)}
                          </TableCell>
                        </TableRow>
                      )) as unknown as React.ReactNode,
                  })}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t("inventory.recentLogs.title")}</CardTitle>
                  <CardDescription>
                    {t("inventory.recentLogs.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {GridTable({
                    headers: [
                      t("table.when"),
                      t("table.item"),
                      t("table.warehouse"),
                      t("table.change"),
                    ],
                    cols: 4,
                    empty: t("empty.recentLogs"),
                    rows: data.inventory.recentLogs.slice(0, 10).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {new Date(row.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.productName}</div>
                          {row.variantSku ? (
                            <div className="text-xs text-muted-foreground">
                              {row.variantSku}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {row.warehouseName || t("common.na")}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtNum(row.change)}
                        </TableCell>
                      </TableRow>
                    )) as unknown as React.ReactNode,
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="delivery" className="space-y-6">
            <Header
              title={t("delivery.title")}
              description={t("delivery.description")}
              onExport={() => exportTab("delivery")}
              exportLabel={t("actions.exportCsv")}
            />
            <div className="grid gap-4 lg:grid-cols-4">
              <Metric
                label={t("delivery.shipments")}
                value={fmtNum(data.delivery.summary.totalShipments)}
              />
              <Metric
                label={t("delivery.delivered")}
                value={fmtNum(data.delivery.summary.delivered)}
                hint={t("delivery.outForDeliveryHint", {
                  count: fmtNum(data.delivery.summary.outForDelivery),
                })}
              />
              <Metric
                label={t("delivery.proofConfirmed")}
                value={fmtNum(data.delivery.summary.proofConfirmed)}
                hint={t("metrics.proofPendingHint", {
                  count: fmtNum(data.delivery.summary.proofPending),
                })}
                tone={data.delivery.summary.proofPending > 0 ? "warn" : "good"}
              />
              <Metric
                label={t("delivery.returnsCancelled")}
                value={t("delivery.returnsCancelledValue", {
                  returned: fmtNum(data.delivery.summary.returned),
                  cancelled: fmtNum(data.delivery.summary.cancelled),
                })}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {t("delivery.courierPerformance.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("delivery.courierPerformance.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {GridTable({
                    headers: [
                      t("table.courier"),
                      t("table.shipments"),
                      t("table.delivered"),
                      t("table.proofs"),
                    ],
                    cols: 4,
                    empty: t("empty.courier"),
                    rows: data.delivery.byCourier.map((row) => (
                      <TableRow key={row.courier}>
                        <TableCell>{row.courier}</TableCell>
                        <TableCell className="text-right">
                          {fmtNum(row.shipments)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtNum(row.delivered)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtNum(row.proofs)}
                        </TableCell>
                      </TableRow>
                    )) as unknown as React.ReactNode,
                  })}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t("delivery.exceptions.title")}</CardTitle>
                  <CardDescription>
                    {t("delivery.exceptions.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {GridTable({
                    headers: [
                      t("table.shipment"),
                      t("table.customer"),
                      t("table.courier"),
                      t("table.status"),
                    ],
                    cols: 4,
                    empty: t("empty.deliveryExceptions"),
                    rows: data.delivery.exceptions.map((row) => (
                      <TableRow key={row.shipmentId}>
                        <TableCell>
                          <div className="font-medium">#{row.shipmentId}</div>
                          <div className="text-xs text-muted-foreground">
                            {t("table.orderNumber", { id: row.orderId })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{row.customer}</div>
                          {row.phone ? (
                            <div className="text-xs text-muted-foreground">
                              {row.phone}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>{row.courier}</TableCell>
                        <TableCell className="text-right">
                          <div>{row.status.replaceAll("_", " ")}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.proofStatus}
                          </div>
                        </TableCell>
                      </TableRow>
                    )) as unknown as React.ReactNode,
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      ) : !loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t("empty.report")}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
