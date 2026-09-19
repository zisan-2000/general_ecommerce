"use client";


import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";
import { PdfExportButton } from "@/components/admin/PdfExportButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type StatusCount = {
  status: string;
  count: number;
};

type DashboardResponse = {
  filters: { from: string; to: string };
  overview: {
    requisitions: number;
    rfqs: number;
    comparativeStatements: number;
    purchaseOrders: number;
    goodsReceipts: number;
    supplierInvoices: number;
    paymentRequests: number;
    supplierPayments: number;
    lowStockVariants: number;
    auditEvents: number;
    totalOrderedAmount: number;
    totalInvoicedAmount: number;
    totalPaymentRequests: number;
    totalSupplierPayments: number;
    pendingApprovals: number;
  };
  procurementPipeline: {
    requisitions: StatusCount[];
    rfqs: StatusCount[];
    comparativeStatements: StatusCount[];
    purchaseOrders: StatusCount[];
    goodsReceipts: StatusCount[];
    supplierInvoices: StatusCount[];
    paymentRequests: StatusCount[];
  };
  vendorPerformance: {
    evaluationCount: number;
    supplierReturnCount: number;
    topSuppliers: Array<{
      supplierId: number;
      supplierName: string;
      supplierCode: string;
      evaluations: number;
      averageRating: number;
      returns: number;
      awards: number;
      payments: number;
    }>;
  };
  rfqStatus: {
    counts: StatusCount[];
    rows: Array<{
      id: number;
      rfqNumber: string;
      status: string;
      requestedAt: string;
      submissionDeadline: string | null;
      warehouseName: string;
      warehouseCode: string;
      inviteCount: number;
      quotationCount: number;
      awardedSupplier: string | null;
    }>;
  };
  comparativeStatementSummary: {
    counts: StatusCount[];
    rows: Array<{
      id: number;
      csNumber: string;
      status: string;
      approvalStage: string;
      generatedAt: string;
      warehouseName: string;
      warehouseCode: string;
      rfqNumber: string;
    }>;
  };
  purchaseOrderTracking: {
    counts: StatusCount[];
    rows: Array<{
      id: number;
      poNumber: string;
      status: string;
      approvalStage: string;
      orderDate: string;
      expectedAt: string | null;
      warehouseName: string;
      warehouseCode: string;
      supplierName: string;
      grandTotal: number;
    }>;
  };
  grnStockSummary: {
    counts: StatusCount[];
    pendingRequesterConfirmation: number;
    latestSnapshotDate: string | null;
    lowStockCount: number;
    rows: Array<{
      id: number;
      receiptNumber: string;
      status: string;
      receivedAt: string;
      requesterConfirmedAt: string | null;
      warehouseName: string;
      supplierName: string;
      quantityReceived: number;
    }>;
    lowStockRows: Array<{
      variantId: number;
      sku: string;
      productName: string;
      stock: number;
      status: string;
      lowStockThreshold: number | null;
      warehouse: { id: number; name: string; code: string };
    }>;
  };
  paymentSummary: {
    prfCounts: StatusCount[];
    totalRequestedAmount: number;
    totalPaidAmount: number;
    rows: Array<{
      id: number;
      prfNumber: string;
      status: string;
      approvalStage: string;
      requestedAt: string;
      paidAt: string | null;
      supplierName: string;
      amount: number;
      invoiceNumber: string | null;
    }>;
    recentPayments: Array<{
      id: number;
      paymentNumber: string;
      paymentDate: string;
      supplierName: string;
      amount: number;
      method: string;
      invoiceNumber: string | null;
    }>;
  };
  auditSummary: {
    totalEvents: number;
    entityBreakdown: Array<{ entity: string; count: number }>;
    recentEvents: Array<{
      id: string;
      action: string;
      entity: string;
      entityId: string | null;
      createdAt: string;
      actorName: string;
    }>;
  };
  projectProcurementSummary: Array<{
    projectPlan: string;
    requisitions: number;
    approvedRequisitions: number;
    convertedRequisitions: number;
    rfqs: number;
    purchaseOrders: number;
    orderedAmount: number;
    invoicedAmount: number;
    paidAmount: number;
  }>;
  budgetVsProcurement: Array<{
    budgetCode: string;
    requisitions: number;
    approvedRequisitions: number;
    estimatedAmount: number;
    purchaseOrders: number;
    orderedAmount: number;
    invoicedAmount: number;
    paidAmount: number;
    remainingBudgetGap: number;
  }>;
  planStatusTracking: {
    totalWithPlanReference: number;
    routedToProcurement: number;
    converted: number;
    rows: Array<{
      requisitionNumber: string;
      projectPlan: string;
      status: string;
      assignedProcurementOfficer: string | null;
      requestedAt: string;
    }>;
  };
  mrfStatusTracking: {
    counts: StatusCount[];
    rows: Array<{
      requisitionNumber: string;
      warehouseName: string;
      status: string;
      budgetCode: string | null;
      requestedAt: string;
      estimatedAmount: number;
      procurementOfficer: string | null;
    }>;
  };
};

type ExportSection =
  | "pipeline"
  | "vendors"
  | "rfqs"
  | "comparative"
  | "purchase-orders"
  | "grn-stock"
  | "payments"
  | "audit"
  | "projects"
  | "budgets"
  | "plans"
  | "mrf";

const EXPORT_SECTIONS: Array<{ value: ExportSection; key: string }> = [
  { value: "pipeline", key: "pipeline" },
  { value: "vendors", key: "vendors" },
  { value: "rfqs", key: "rfqs" },
  { value: "comparative", key: "comparative" },
  { value: "purchase-orders", key: "purchaseOrders" },
  { value: "grn-stock", key: "grnStock" },
  { value: "payments", key: "payments" },
  { value: "audit", key: "audit" },
  { value: "projects", key: "projects" },
  { value: "budgets", key: "budgets" },
  { value: "plans", key: "plans" },
  { value: "mrf", key: "mrf" },
];

const REPORT_READ_PERMISSIONS = [
  "dashboard.read",
  "purchase_requisitions.read",
  "rfq.read",
  "comparative_statements.read",
  "purchase_orders.read",
  "goods_receipts.read",
  "payment_requests.read",
  "payment_reports.read",
  "stock_reports.read",
  "supplier_performance.read",
  "supplier.feedback.manage",
  "sla.read",
  "supplier_ledger.read",
  "three_way_match.read",
];

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function formatMoney(value: number | null | undefined) {
  return Number(value || 0).toFixed(2);
}

function buildHref(path: string, query?: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function getAuditEntityHref(entity: string, entityId: string | null) {
  switch (entity) {
    case "purchase_requisition":
      return entityId ? `/admin/scm/purchase-requisitions/${entityId}` : "/admin/scm/purchase-requisitions";
    case "rfq":
      return entityId ? `/admin/scm/rfqs/${entityId}` : "/admin/scm/rfqs";
    case "comparative_statement":
      return buildHref("/admin/scm/comparative-statements", {
        selectedId: entityId,
        search: entityId,
      });
    case "purchase_order":
      return entityId ? `/admin/scm/purchase-orders/${entityId}` : "/admin/scm/purchase-orders";
    case "goods_receipt":
      return entityId ? `/admin/scm/goods-receipts/${entityId}` : "/admin/scm/goods-receipts";
    case "payment_request":
      return entityId ? `/admin/scm/payment-requests/${entityId}` : "/admin/scm/payment-requests";
    case "material_request":
      return entityId ? `/admin/scm/material-requests/${entityId}` : "/admin/scm/material-requests";
    case "material_release":
      return entityId ? `/admin/scm/material-releases/${entityId}` : "/admin/scm/material-releases";
    case "warehouse_transfer":
      return entityId ? `/admin/scm/warehouse-transfers/${entityId}` : "/admin/scm/warehouse-transfers";
    case "supplier_return":
      return entityId ? `/admin/scm/supplier-returns/${entityId}` : "/admin/scm/supplier-returns";
    case "inventory_verification":
      return entityId ? `/admin/scm/physical-verifications/${entityId}` : "/admin/scm/physical-verifications";
    case "asset_register":
      return entityId ? `/admin/scm/assets/${entityId}` : "/admin/scm/assets";
    default:
      return buildHref("/admin/settings/activitylog", {
        entity,
        search: entityId,
      });
  }
}

function StatusSummary({
  title,
  rows,
  rowHref,
}: {
  title: string;
  rows: StatusCount[];
  rowHref?: (status: string) => string;
}) {
  const tScm = useTranslations("ScmAuto");
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tScm("k_d41e11de4fe2")}</p>
        ) : (
          rows.map((row) => (
            <div key={`${title}-${row.status}`} className="flex items-center justify-between text-sm">
              {rowHref ? (
                <Link
                  href={rowHref(row.status)}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  {row.status}
                </Link>
              ) : (
                <span className="text-muted-foreground">{row.status}</span>
              )}
              <span className="font-medium">{row.count}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function ScmDashboardPage() {
  const tScm = useTranslations("ScmAuto");
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const t = useTranslations("AdminScmDashboard");
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];
  const canRead = permissions.some((permission) =>
    REPORT_READ_PERMISSIONS.includes(permission),
  );

  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return date.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");
  const [exportSection, setExportSection] = useState<ExportSection>("pipeline");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<DashboardResponse | null>(null);

  const loadData = async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      const response = await fetch(`/api/scm/dashboard/overview?${query.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | DashboardResponse
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error : t("errors.load"));
      }
      setReport(payload as DashboardResponse);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [canRead, from, to]);

  useEffect(() => {
    setActiveTab(searchParams.get("tab") || "overview");
  }, [searchParams]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const query = new URLSearchParams({
        section: exportSection,
      });
      if (from) query.set("from", from);
      if (to) query.set("to", to);

      const response = await fetch(`/api/scm/reports/export?${query.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || t("errors.export"));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      anchor.download = filenameMatch?.[1] || `scm-report-${exportSection}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.export"));
    } finally {
      setExporting(false);
    }
  };

  const topCards = useMemo(() => {
    if (!report) return [];
    return [
      {
        label: t("cards.pendingApprovals.label"),
        value: report.overview.pendingApprovals,
        href: "/admin/scm/my-tasks",
        hint: t("cards.pendingApprovals.hint"),
      },
      {
        label: t("cards.poValue.label"),
        value: formatMoney(report.overview.totalOrderedAmount),
        href: buildHref("/admin/scm/purchase-orders", { status: "APPROVED" }),
        hint: t("cards.poValue.hint"),
      },
      {
        label: t("cards.invoicedValue.label"),
        value: formatMoney(report.overview.totalInvoicedAmount),
        href: "/admin/scm/three-way-match",
        hint: t("cards.invoicedValue.hint"),
      },
      {
        label: t("cards.paidValue.label"),
        value: formatMoney(report.overview.totalSupplierPayments),
        href: "/admin/scm/payment-reports",
        hint: t("cards.paidValue.hint"),
      },
      {
        label: t("cards.lowStockVariants.label"),
        value: report.overview.lowStockVariants,
        href: "/admin/scm/replenishment",
        hint: t("cards.lowStockVariants.hint"),
      },
      {
        label: t("cards.auditEvents.label"),
        value: report.overview.auditEvents,
        href: "/admin/settings/activitylog",
        hint: t("cards.auditEvents.hint"),
      },
    ];
  }, [report, t]);

  if (!canRead) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t("empty.noPermission")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("header.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("header.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            {t("actions.refresh")}
          </Button>
          <PdfExportButton
            targetId="scm-dashboard-export"
            filename={`scm-dashboard-${from}-to-${to}.pdf`}
            label={t("actions.exportPdf")}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("filters.title")}</CardTitle>
          <CardDescription>
            {t("filters.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>{t("filters.from")}</Label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("filters.to")}</Label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("filters.exportSection")}</Label>
            <select
              className="min-w-[260px] rounded-md border bg-background px-3 py-2 text-sm"
              value={exportSection}
              onChange={(event) => setExportSection(event.target.value as ExportSection)}
            >
              {EXPORT_SECTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`exportSections.${option.key}` as any)}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="outline" onClick={() => void exportCsv()} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? t("filters.exporting") : t("filters.exportCsv")}
          </Button>
        </CardContent>
      </Card>

      <div id="scm-dashboard-export" className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {topCards.map((card) => (
            <Link key={card.label} href={card.href} className="block">
              <Card className="transition-colors hover:border-primary/40 hover:bg-muted/30">
                <CardContent className="pt-6">
                  <div className="text-xs uppercase text-muted-foreground">{card.label}</div>
                  <div className="text-2xl font-semibold">{card.value}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{card.hint}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {loading && !report ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {t("loading")}
            </CardContent>
          </Card>
        ) : report ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
              <TabsTrigger value="pipeline">{t("tabs.pipeline")}</TabsTrigger>
              <TabsTrigger value="sourcing">{t("tabs.sourcing")}</TabsTrigger>
              <TabsTrigger value="warehouse">{t("tabs.warehouse")}</TabsTrigger>
              <TabsTrigger value="finance">{t("tabs.finance")}</TabsTrigger>
              <TabsTrigger value="audit">{t("tabs.audit")}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("overview.vendorPerformance.title")}</CardTitle>
                    <CardDescription>
                      {t("overview.vendorPerformance.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tScm("k_55edd462872a")}</TableHead>
                          <TableHead className="text-right">{tScm("k_a78010cf73eb")}</TableHead>
                          <TableHead className="text-right">{tScm("k_75226d73db5b")}</TableHead>
                          <TableHead className="text-right">{tScm("k_9582a02f141f")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.vendorPerformance.topSuppliers.length ? (
                          report.vendorPerformance.topSuppliers.slice(0, 8).map((row) => (
                            <TableRow key={row.supplierId}>
                              <TableCell>
                                <Link
                                  href={buildHref("/admin/scm/supplier-intelligence", {
                                    search: row.supplierCode,
                                  })}
                                  className="font-medium underline-offset-4 hover:underline"
                                >
                                  {row.supplierName}
                                </Link>
                                <div className="text-xs text-muted-foreground">{row.supplierCode}</div>
                              </TableCell>
                              <TableCell className="text-right">{row.averageRating.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{row.awards}</TableCell>
                              <TableCell className="text-right">{row.returns}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              {tScm("k_d81e0f10b9e5")}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{tScm("k_68f3b5d924f5")}</CardTitle>
                    <CardDescription>
                      {tScm("k_76575d0e708f")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tScm("k_ecdda59aea5e")}</TableHead>
                          <TableHead>{tScm("k_298dff72dae2")}</TableHead>
                          <TableHead className="text-right">{tScm("k_bcecf4562f17")}</TableHead>
                          <TableHead className="text-right">{tScm("k_c51f7b72279e")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.grnStockSummary.lowStockRows.length ? (
                          report.grnStockSummary.lowStockRows.map((row) => (
                            <TableRow key={`${row.variantId}-${row.warehouse.id}`}>
                              <TableCell>
                                <Link
                                  href={buildHref("/admin/scm/replenishment", {
                                    warehouseId: row.warehouse.id,
                                    search: row.sku,
                                  })}
                                  className="font-medium underline-offset-4 hover:underline"
                                >
                                  {row.productName}
                                </Link>
                                <div className="text-xs text-muted-foreground">{row.sku}</div>
                              </TableCell>
                              <TableCell>{row.warehouse.name}</TableCell>
                              <TableCell className="text-right">{row.stock}</TableCell>
                              <TableCell className="text-right">{row.lowStockThreshold ?? "N/A"}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              {tScm("k_719743136c42")}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="pipeline" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatusSummary
                  title={tScm("k_73f0c0137897")}
                  rows={report.procurementPipeline.requisitions}
                  rowHref={(status) => buildHref("/admin/scm/purchase-requisitions", { status })}
                />
                <StatusSummary
                  title={tScm("k_97619681ade9")}
                  rows={report.procurementPipeline.rfqs}
                  rowHref={(status) => buildHref("/admin/scm/rfqs", { status })}
                />
                <StatusSummary
                  title={tScm("k_0e0bd9224cae")}
                  rows={report.procurementPipeline.comparativeStatements}
                  rowHref={(status) => buildHref("/admin/scm/comparative-statements", { status })}
                />
                <StatusSummary
                  title={tScm("k_47b96c66a290")}
                  rows={report.procurementPipeline.paymentRequests}
                  rowHref={(status) => buildHref("/admin/scm/payment-requests", { status })}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>{tScm("k_7ea30545af85")}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">{tScm("k_785720363a97")}</div>
                      <div className="text-2xl font-semibold">{report.planStatusTracking.totalWithPlanReference}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">{tScm("k_00b445f26fa1")}</div>
                      <div className="text-2xl font-semibold">{report.planStatusTracking.routedToProcurement}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">{tScm("k_312028625ca8")}</div>
                      <div className="text-2xl font-semibold">{report.planStatusTracking.converted}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{tScm("k_bffc124b58f9")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {report.mrfStatusTracking.counts.length ? (
                      report.mrfStatusTracking.counts.map((row) => (
                        <div key={row.status} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{row.status}</span>
                          <span className="font-medium">{row.count}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">{tScm("k_5063158b0eb2")}</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{tScm("k_e6540375806b")}</CardTitle>
                  <CardDescription>
                    {tScm("k_081726d2ef56")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tScm("k_7dc430086b99")}</TableHead>
                        <TableHead>{tScm("k_b256ad382eb2")}</TableHead>
                        <TableHead>{tScm("k_bae7d5be7082")}</TableHead>
                        <TableHead>{tScm("k_f58330ab22f6")}</TableHead>
                        <TableHead>{tScm("k_c26bf60fed37")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.planStatusTracking.rows.length ? (
                        report.planStatusTracking.rows.map((row) => (
                          <TableRow key={row.requisitionNumber}>
                            <TableCell>
                              <Link
                                href={buildHref("/admin/scm/purchase-requisitions", {
                                  search: row.requisitionNumber,
                                })}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {row.requisitionNumber}
                              </Link>
                            </TableCell>
                            <TableCell>{row.projectPlan}</TableCell>
                            <TableCell>{row.status}</TableCell>
                            <TableCell>{row.assignedProcurementOfficer ?? "N/A"}</TableCell>
                            <TableCell>{formatDateTime(row.requestedAt)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            {tScm("k_7fccfe006476")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sourcing" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <StatusSummary
                  title={tScm("k_403156a7706c")}
                  rows={report.rfqStatus.counts}
                  rowHref={(status) => buildHref("/admin/scm/rfqs", { status })}
                />
                <StatusSummary
                  title={tScm("k_056f5ef5d778")}
                  rows={report.comparativeStatementSummary.counts}
                  rowHref={(status) => buildHref("/admin/scm/comparative-statements", { status })}
                />
                <StatusSummary
                  title={tScm("k_761fc5615126")}
                  rows={report.purchaseOrderTracking.counts}
                  rowHref={(status) => buildHref("/admin/scm/purchase-orders", { status })}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <Card className="xl:col-span-1">
                  <CardHeader>
                    <CardTitle>{tScm("k_2eba7537a250")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tScm("k_97619681ade9")}</TableHead>
                          <TableHead>{tScm("k_bae7d5be7082")}</TableHead>
                          <TableHead className="text-right">{tScm("k_7b0257ce75ad")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.rfqStatus.rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Link
                                href={`/admin/scm/rfqs/${row.id}`}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {row.rfqNumber}
                              </Link>
                              <div className="text-xs text-muted-foreground">{row.warehouseName}</div>
                            </TableCell>
                            <TableCell>{row.status}</TableCell>
                            <TableCell className="text-right">{row.quotationCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="xl:col-span-1">
                  <CardHeader>
                    <CardTitle>{tScm("k_cd1ee2d952f6")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tScm("k_0e0bd9224cae")}</TableHead>
                          <TableHead>{tScm("k_bae7d5be7082")}</TableHead>
                          <TableHead>{tScm("k_ca6d0e3aaa7d")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.comparativeStatementSummary.rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Link
                                href={buildHref("/admin/scm/comparative-statements", {
                                  search: row.csNumber,
                                  selectedId: row.id,
                                })}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {row.csNumber}
                              </Link>
                              <div className="text-xs text-muted-foreground">{row.rfqNumber}</div>
                            </TableCell>
                            <TableCell>{row.status}</TableCell>
                            <TableCell>{row.approvalStage}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="xl:col-span-1">
                  <CardHeader>
                    <CardTitle>{tScm("k_6615cee779a0")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tScm("k_eea0c00c5051")}</TableHead>
                          <TableHead>{tScm("k_bae7d5be7082")}</TableHead>
                          <TableHead className="text-right">{tScm("k_43dc8532f7e5")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.purchaseOrderTracking.rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Link
                                href={`/admin/scm/purchase-orders/${row.id}`}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {row.poNumber}
                              </Link>
                              <div className="text-xs text-muted-foreground">{row.supplierName}</div>
                            </TableCell>
                            <TableCell>{row.status}</TableCell>
                            <TableCell className="text-right">{formatMoney(row.grandTotal)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="warehouse" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <StatusSummary
                  title={tScm("k_8eb705dee4a4")}
                  rows={report.grnStockSummary.counts}
                  rowHref={(status) =>
                    status === "POSTED"
                      ? buildHref("/admin/scm/goods-receipts", { focus: "post" })
                      : "/admin/scm/goods-receipts"
                  }
                />
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{tScm("k_95d7c9be51e0")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{tScm("k_72275756951f")}</span>
                      <Link
                        href={buildHref("/admin/scm/goods-receipts", { focus: "pending-confirmation" })}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {report.grnStockSummary.pendingRequesterConfirmation}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{tScm("k_387d367dfa86")}</span>
                      <Link
                        href="/admin/scm/replenishment"
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {report.grnStockSummary.lowStockCount}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{tScm("k_1c54aaa0b8bc")}</span>
                      <span className="font-medium">{formatDate(report.grnStockSummary.latestSnapshotDate)}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{tScm("k_1ec754a98b48")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{tScm("k_4978f395c4d0")}</span>
                      <Link
                        href={buildHref("/admin/scm/goods-receipts", { focus: "incomplete-evaluation" })}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {report.vendorPerformance.evaluationCount}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{tScm("k_501128a632c8")}</span>
                      <Link
                        href="/admin/scm/supplier-returns"
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {report.vendorPerformance.supplierReturnCount}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{tScm("k_f7e16ef9e36f")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tScm("k_f6ce3b6fcfca")}</TableHead>
                        <TableHead>{tScm("k_298dff72dae2")}</TableHead>
                        <TableHead>{tScm("k_55edd462872a")}</TableHead>
                        <TableHead>{tScm("k_bae7d5be7082")}</TableHead>
                        <TableHead className="text-right">{tScm("k_1e5ff9e500c2")}</TableHead>
                        <TableHead>{tScm("k_413722dd6d27")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.grnStockSummary.rows.length ? (
                        report.grnStockSummary.rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Link
                                href={`/admin/scm/goods-receipts/${row.id}`}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {row.receiptNumber}
                              </Link>
                              <div className="text-xs text-muted-foreground">{formatDateTime(row.receivedAt)}</div>
                            </TableCell>
                            <TableCell>{row.warehouseName}</TableCell>
                            <TableCell>{row.supplierName}</TableCell>
                            <TableCell>{row.status}</TableCell>
                            <TableCell className="text-right">{row.quantityReceived}</TableCell>
                            <TableCell>{formatDateTime(row.requesterConfirmedAt)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            {tScm("k_c3f59048b23d")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="finance" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <StatusSummary
                  title={tScm("k_f9ea40aecd65")}
                  rows={report.paymentSummary.prfCounts}
                  rowHref={(status) => buildHref("/admin/scm/payment-requests", { status })}
                />
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{tScm("k_dad7cf7fe87b")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{tScm("k_cde287cda27d")}</span>
                      <span className="font-medium">{formatMoney(report.paymentSummary.totalRequestedAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{tScm("k_1950b3cfee35")}</span>
                      <span className="font-medium">{formatMoney(report.paymentSummary.totalPaidAmount)}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{tScm("k_9691330dc5de")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{tScm("k_d89503f21f86")}</span>
                      <Link
                        href="/admin/scm/dashboard?tab=finance"
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {report.budgetVsProcurement.length}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{tScm("k_3ee53839fa70")}</span>
                      <Link
                        href="/admin/scm/dashboard?tab=finance"
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {report.projectProcurementSummary.length}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>{tScm("k_73d0debca23e")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tScm("k_b256ad382eb2")}</TableHead>
                          <TableHead className="text-right">{tScm("k_c9dd3b77c90c")}</TableHead>
                          <TableHead className="text-right">{tScm("k_4da40d1d15fd")}</TableHead>
                          <TableHead className="text-right">{tScm("k_dc9d4584a554")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.projectProcurementSummary.length ? (
                          report.projectProcurementSummary.map((row) => (
                            <TableRow key={row.projectPlan}>
                              <TableCell>
                                <Link
                                  href={buildHref("/admin/scm/purchase-requisitions", {
                                    search: row.projectPlan,
                                  })}
                                  className="underline-offset-4 hover:underline"
                                >
                                  {row.projectPlan}
                                </Link>
                              </TableCell>
                              <TableCell className="text-right">{formatMoney(row.orderedAmount)}</TableCell>
                              <TableCell className="text-right">{formatMoney(row.invoicedAmount)}</TableCell>
                              <TableCell className="text-right">{formatMoney(row.paidAmount)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              {tScm("k_d28bb5d8ce48")}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{tScm("k_8b3d60d576ba")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tScm("k_88f4ea85a48f")}</TableHead>
                          <TableHead className="text-right">{tScm("k_ae64c7cf8d54")}</TableHead>
                          <TableHead className="text-right">{tScm("k_c9dd3b77c90c")}</TableHead>
                          <TableHead className="text-right">{tScm("k_b2464742da10")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.budgetVsProcurement.length ? (
                          report.budgetVsProcurement.map((row) => (
                            <TableRow key={row.budgetCode}>
                              <TableCell>
                                <Link
                                  href={buildHref("/admin/scm/purchase-requisitions", {
                                    search: row.budgetCode,
                                  })}
                                  className="underline-offset-4 hover:underline"
                                >
                                  {row.budgetCode}
                                </Link>
                              </TableCell>
                              <TableCell className="text-right">{formatMoney(row.estimatedAmount)}</TableCell>
                              <TableCell className="text-right">{formatMoney(row.orderedAmount)}</TableCell>
                              <TableCell className="text-right">{formatMoney(row.remainingBudgetGap)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              {tScm("k_ba334d41b3ce")}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{tScm("k_97c0cb7d448d")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tScm("k_d6de20fdc9f1")}</TableHead>
                        <TableHead>{tScm("k_55edd462872a")}</TableHead>
                        <TableHead>{tScm("k_f9f38818c406")}</TableHead>
                        <TableHead>{tScm("k_bae7d5be7082")}</TableHead>
                        <TableHead className="text-right">{tScm("k_43dc8532f7e5")}</TableHead>
                        <TableHead>{tScm("k_55c62e1a5165")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.paymentSummary.rows.length ? (
                        report.paymentSummary.rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Link
                                href={`/admin/scm/payment-requests/${row.id}`}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {row.prfNumber}
                              </Link>
                              <div className="text-xs text-muted-foreground">{row.approvalStage}</div>
                            </TableCell>
                            <TableCell>{row.supplierName}</TableCell>
                            <TableCell>{row.invoiceNumber ?? "N/A"}</TableCell>
                            <TableCell>{row.status}</TableCell>
                            <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
                            <TableCell>{formatDateTime(row.paidAt)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            {tScm("k_7d94843b293c")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>{tScm("k_860fce26a4b6")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {report.auditSummary.entityBreakdown.length ? (
                      report.auditSummary.entityBreakdown.map((row) => (
                        <div key={row.entity} className="flex items-center justify-between text-sm">
                          <Link
                            href={buildHref("/admin/settings/activitylog", { entity: row.entity })}
                            className="text-muted-foreground underline-offset-4 hover:underline"
                          >
                            {row.entity}
                          </Link>
                          <span className="font-medium">{row.count}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">{tScm("k_6f31ee4f1f4e")}</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>{tScm("k_53b272d8efea")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{tScm("k_a65d74694da5")}</span>
                      <span className="font-medium">{report.auditSummary.totalEvents}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{tScm("k_6bb4b674b323")}</span>
                      <span className="font-medium">
                        {report.filters.from} {tScm("k_4374aaee247f")} {report.filters.to}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{tScm("k_f0ee847cfd2b")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tScm("k_97c89a4d6630")}</TableHead>
                        <TableHead>{tScm("k_c7fb31772579")}</TableHead>
                        <TableHead>{tScm("k_04d694e29810")}</TableHead>
                        <TableHead>{tScm("k_cbd19b5c397e")}</TableHead>
                        <TableHead>{tScm("k_19eabc961735")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.auditSummary.recentEvents.length ? (
                        report.auditSummary.recentEvents.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.action}</TableCell>
                            <TableCell>
                              <Link
                                href={buildHref("/admin/settings/activitylog", { entity: row.entity })}
                                className="underline-offset-4 hover:underline"
                              >
                                {row.entity}
                              </Link>
                            </TableCell>
                            <TableCell>
                              {row.entityId ? (
                                <Link
                                  href={getAuditEntityHref(row.entity, row.entityId)}
                                  className="underline-offset-4 hover:underline"
                                >
                                  {row.entityId}
                                </Link>
                              ) : (
                                "N/A"
                              )}
                            </TableCell>
                            <TableCell>{row.actorName}</TableCell>
                            <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            {tScm("k_c76eb4f78468")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : null}
      </div>
    </div>
  );
}
