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
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No status data in selected range.</p>
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
                          <TableHead>Supplier</TableHead>
                          <TableHead className="text-right">Avg Rating</TableHead>
                          <TableHead className="text-right">Awards</TableHead>
                          <TableHead className="text-right">Returns</TableHead>
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
                              No vendor performance rows found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Low Stock Exceptions</CardTitle>
                    <CardDescription>
                      Current low stock list from latest inventory snapshot.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Warehouse</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Threshold</TableHead>
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
                              No low stock exceptions found.
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
                  title="MRF / Requisition"
                  rows={report.procurementPipeline.requisitions}
                  rowHref={(status) => buildHref("/admin/scm/purchase-requisitions", { status })}
                />
                <StatusSummary
                  title="RFQ"
                  rows={report.procurementPipeline.rfqs}
                  rowHref={(status) => buildHref("/admin/scm/rfqs", { status })}
                />
                <StatusSummary
                  title="CS"
                  rows={report.procurementPipeline.comparativeStatements}
                  rowHref={(status) => buildHref("/admin/scm/comparative-statements", { status })}
                />
                <StatusSummary
                  title="Payment Request"
                  rows={report.procurementPipeline.paymentRequests}
                  rowHref={(status) => buildHref("/admin/scm/payment-requests", { status })}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Project Procurement Plan Tracking</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">With Plan Ref</div>
                      <div className="text-2xl font-semibold">{report.planStatusTracking.totalWithPlanReference}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Routed To Procurement</div>
                      <div className="text-2xl font-semibold">{report.planStatusTracking.routedToProcurement}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Converted</div>
                      <div className="text-2xl font-semibold">{report.planStatusTracking.converted}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>MRF Status Tracking</CardTitle>
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
                      <p className="text-sm text-muted-foreground">No MRF rows found.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Plan / MRF Register</CardTitle>
                  <CardDescription>
                    Project/plan grouping currently uses planning note, requisition title, purpose, then warehouse fallback.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requisition</TableHead>
                        <TableHead>Project / Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Officer</TableHead>
                        <TableHead>Requested</TableHead>
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
                            No procurement plan rows found.
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
                  title="RFQ Status"
                  rows={report.rfqStatus.counts}
                  rowHref={(status) => buildHref("/admin/scm/rfqs", { status })}
                />
                <StatusSummary
                  title="CS Status"
                  rows={report.comparativeStatementSummary.counts}
                  rowHref={(status) => buildHref("/admin/scm/comparative-statements", { status })}
                />
                <StatusSummary
                  title="PO Status"
                  rows={report.purchaseOrderTracking.counts}
                  rowHref={(status) => buildHref("/admin/scm/purchase-orders", { status })}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <Card className="xl:col-span-1">
                  <CardHeader>
                    <CardTitle>RFQ Register</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>RFQ</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Quotes</TableHead>
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
                    <CardTitle>CS Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>CS</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Stage</TableHead>
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
                    <CardTitle>WO / PO Tracking</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PO</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
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
                  title="GRN Status"
                  rows={report.grnStockSummary.counts}
                  rowHref={(status) =>
                    status === "POSTED"
                      ? buildHref("/admin/scm/goods-receipts", { focus: "post" })
                      : "/admin/scm/goods-receipts"
                  }
                />
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Warehouse Exceptions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Pending Requester Confirmation</span>
                      <Link
                        href={buildHref("/admin/scm/goods-receipts", { focus: "pending-confirmation" })}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {report.grnStockSummary.pendingRequesterConfirmation}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Low Stock Variants</span>
                      <Link
                        href="/admin/scm/replenishment"
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {report.grnStockSummary.lowStockCount}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Latest Snapshot</span>
                      <span className="font-medium">{formatDate(report.grnStockSummary.latestSnapshotDate)}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Vendor Performance Input</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Goods Receipt Evaluations</span>
                      <Link
                        href={buildHref("/admin/scm/goods-receipts", { focus: "incomplete-evaluation" })}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {report.vendorPerformance.evaluationCount}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Supplier Return Cases</span>
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
                  <CardTitle>GRN Register</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Requester Confirmation</TableHead>
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
                            No GRN rows found.
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
                  title="PRF Status"
                  rows={report.paymentSummary.prfCounts}
                  rowHref={(status) => buildHref("/admin/scm/payment-requests", { status })}
                />
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Payment Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Requested Amount</span>
                      <span className="font-medium">{formatMoney(report.paymentSummary.totalRequestedAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Paid Amount</span>
                      <span className="font-medium">{formatMoney(report.paymentSummary.totalPaidAmount)}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Budget Coverage</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Budget Codes In Scope</span>
                      <Link
                        href="/admin/scm/dashboard?tab=finance"
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {report.budgetVsProcurement.length}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Project / Plan Rows</span>
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
                    <CardTitle>Project-wise Procurement Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project / Plan</TableHead>
                          <TableHead className="text-right">Ordered</TableHead>
                          <TableHead className="text-right">Invoiced</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
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
                              No project summary rows found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Budget vs Procurement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Budget Code</TableHead>
                          <TableHead className="text-right">Estimated</TableHead>
                          <TableHead className="text-right">Ordered</TableHead>
                          <TableHead className="text-right">Gap</TableHead>
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
                              No budget rows found.
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
                  <CardTitle>PRF & Payment Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PRF</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Paid At</TableHead>
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
                            No PRF rows found.
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
                    <CardTitle>Audit Entity Breakdown</CardTitle>
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
                      <p className="text-sm text-muted-foreground">No audit rows found.</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Audit Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Events In Range</span>
                      <span className="font-medium">{report.auditSummary.totalEvents}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Date Range</span>
                      <span className="font-medium">
                        {report.filters.from} to {report.filters.to}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent SCM Audit Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Entity ID</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Timestamp</TableHead>
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
                            No audit events found.
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
