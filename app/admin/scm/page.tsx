"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Bell,
  ClipboardCheck,
  ClipboardList,
  ReceiptText,
  FileText,
  GitCompareArrows,
  PackageCheck,
  Radar,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScmActionList, type ScmActionItem } from "@/components/admin/scm/ScmActionList";
import {
  ScmEmptyState,
} from "@/components/admin/scm/ScmEmptyState";
import {
  ScmExceptionList,
  type ScmExceptionItem,
} from "@/components/admin/scm/ScmExceptionList";
import { ScmSectionHeader } from "@/components/admin/scm/ScmSectionHeader";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { ScmStatusChip } from "@/components/admin/scm/ScmStatusChip";
import { useLocale, useTranslations } from "next-intl";

type DashboardOverview = {
  overview: {
    pendingApprovals: number;
    lowStockVariants: number;
    totalOrderedAmount: number;
    totalSupplierPayments: number;
    auditEvents: number;
  };
};

type NotificationsResponse = {
  unreadCount: number;
  rows: Array<{
    id: number;
    type: string;
    title: string;
    message: string;
    href: string;
    createdAt: string;
    readAt: string | null;
  }>;
};

type MyTasksResponse = {
  summary: {
    needsMyAction: number;
    waitingOnOthers: number;
    recentlyCompleted: number;
    overdue: number;
  };
  needsMyAction: ScmActionItem[];
  waitingOnOthers: ScmActionItem[];
  recentlyCompleted: ScmActionItem[];
};

type ExceptionsResponse = {
  summary: {
    critical: number;
    needsReview: number;
    operationalRisks: number;
  };
  critical: ScmExceptionItem[];
  needsReview: ScmExceptionItem[];
  operationalRisks: ScmExceptionItem[];
};

type WorkspaceLink = {
  key: string;
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
  permissions?: string[];
  globalPermissions?: string[];
};

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
] as const;

const quickStartLinks: WorkspaceLink[] = [
  {
    key: "createRequisition",
    title: "Create Requisition",
    href: "/admin/scm/purchase-requisitions/new",
    description: "Start a new internal purchase demand.",
    icon: ClipboardList,
    permissions: ["purchase_requisitions.manage"],
  },
  {
    key: "prepareRfq",
    title: "Prepare RFQ",
    href: "/admin/scm/rfqs/new",
    description: "Launch supplier sourcing from approved demand.",
    icon: FileText,
    permissions: ["rfq.manage"],
  },
  {
    key: "postGrn",
    title: "Post GRN",
    href: "/admin/scm/goods-receipts/new",
    description: "Receive inbound goods and update stock.",
    icon: PackageCheck,
    permissions: ["goods_receipts.manage"],
  },
  {
    key: "createSupplierInvoice",
    title: "Create Supplier Invoice",
    href: "/admin/scm/supplier-invoices",
    description: "Review received PO lines before AP posting.",
    icon: ReceiptText,
    permissions: ["supplier_invoices.manage"],
    globalPermissions: ["supplier_invoices.manage"],
  },
  {
    key: "submitPrf",
    title: "Submit PRF",
    href: "/admin/scm/payment-requests/new",
    description: "Initiate supplier payment workflow.",
    icon: ClipboardCheck,
    permissions: ["payment_requests.manage"],
  },
];

const moduleDirectory: Array<{ key: string; label: string; links: WorkspaceLink[] }> = [
  {
    key: "procurement",
    label: "Procurement",
    links: [
      {
        key: "purchaseRequisitions",
        title: "Purchase Requisitions",
        href: "/admin/scm/purchase-requisitions",
        description: "Raise and route demand requests.",
        icon: ClipboardList,
        permissions: ["purchase_requisitions.read", "purchase_requisitions.manage"],
      },
      {
        key: "rfqs",
        title: "RFQs",
        href: "/admin/scm/rfqs",
        description: "Invite suppliers and collect quotations.",
        icon: FileText,
        permissions: ["rfq.read", "rfq.manage"],
      },
      {
        key: "comparativeStatements",
        title: "Comparative Statements",
        href: "/admin/scm/comparative-statements",
        description: "Score supplier proposals and drive approvals.",
        icon: GitCompareArrows,
        permissions: [
          "comparative_statements.read",
          "comparative_statements.manage",
          "comparative_statements.approve_manager",
          "comparative_statements.approve_committee",
          "comparative_statements.approve_final",
        ],
      },
      {
        key: "purchaseOrders",
        title: "Purchase Orders",
        href: "/admin/scm/purchase-orders",
        description: "Issue approved orders and track delivery.",
        icon: ShoppingCart,
        permissions: [
          "purchase_orders.read",
          "purchase_orders.manage",
          "purchase_orders.approve",
        ],
      },
    ],
  },
  {
    key: "warehouse",
    label: "Warehouse",
    links: [
      {
        key: "goodsReceipts",
        title: "Goods Receipts",
        href: "/admin/scm/goods-receipts",
        description: "Receive stock and confirm inbound documents.",
        icon: PackageCheck,
        permissions: ["goods_receipts.read", "goods_receipts.manage"],
      },
      {
        key: "warehouseTransfers",
        title: "Warehouse Transfers",
        href: "/admin/scm/warehouse-transfers",
        description: "Dispatch and receive internal stock movements.",
        icon: Radar,
        permissions: [
          "warehouse_transfers.read",
          "warehouse_transfers.manage",
          "warehouse_transfers.approve",
        ],
      },
      {
        key: "materialRequests",
        title: "Material Requests",
        href: "/admin/scm/material-requests",
        description: "Manage internal issue workflow and approvals.",
        icon: ClipboardCheck,
        permissions: [
          "material_requests.read",
          "material_requests.manage",
          "material_requests.approve_admin",
        ],
      },
      {
        key: "stockReports",
        title: "Stock Reports",
        href: "/admin/scm/stock-reports",
        description: "Review stock health, ageing, and summaries.",
        icon: AlertTriangle,
        permissions: ["stock_reports.read"],
      },
    ],
  },
  {
    key: "financeSupplier",
    label: "Finance & Supplier",
    links: [
      {
        key: "paymentRequests",
        title: "Payment Requests",
        href: "/admin/scm/payment-requests",
        description: "Approve and process supplier payments.",
        icon: FileText,
        permissions: [
          "payment_requests.read",
          "payment_requests.manage",
          "payment_requests.approve_admin",
          "payment_requests.approve_finance",
          "payment_requests.treasury",
        ],
      },
      {
        key: "supplierInvoices",
        title: "Supplier Invoices",
        href: "/admin/scm/supplier-invoices",
        description: "Create and monitor AP invoice records.",
        icon: ReceiptText,
        permissions: ["supplier_invoices.read", "supplier_invoices.manage"],
        globalPermissions: ["supplier_invoices.read", "supplier_invoices.manage"],
      },
      {
        key: "supplierLedger",
        title: "Supplier Ledger",
        href: "/admin/scm/supplier-ledger",
        description: "Track invoice and payment exposure.",
        icon: ClipboardList,
        permissions: ["supplier_ledger.read", "supplier_invoices.read", "supplier_payments.read"],
        globalPermissions: [
          "supplier_ledger.read",
          "supplier_invoices.read",
          "supplier_payments.read",
        ],
      },
      {
        key: "threeWayMatch",
        title: "3-Way Match",
        href: "/admin/scm/three-way-match",
        description: "Resolve invoice variance before payment.",
        icon: GitCompareArrows,
        permissions: ["three_way_match.read", "supplier_invoices.read", "supplier_invoices.manage"],
        globalPermissions: [
          "three_way_match.read",
          "supplier_invoices.read",
          "supplier_invoices.manage",
        ],
      },
      {
        key: "suppliers",
        title: "Suppliers",
        href: "/admin/scm/suppliers",
        description: "Maintain supplier master and governance.",
        icon: Bell,
        permissions: ["suppliers.read", "suppliers.manage"],
        globalPermissions: ["suppliers.read", "suppliers.manage"],
      },
    ],
  },
];

function fmtCurrency(value: number | null | undefined, locale: string, unavailable: string) {
  if (typeof value !== "number" || Number.isNaN(value)) return unavailable;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtDate(value: string | null | undefined, locale: string, unavailable: string) {
  if (!value) return unavailable;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return unavailable;
  return parsed.toLocaleString(locale);
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || fallback);
  }
  return payload as T;
}

export default function ScmHomePage() {
  const t = useTranslations("AdminScmHome");
  const locale = useLocale();
  const { data: session } = useSession();
  const permissionKeys = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];
  const globalPermissionKeys = Array.isArray((session?.user as any)?.globalPermissions)
    ? ((session?.user as any).globalPermissions as string[])
    : [];

  const canReadReports = REPORT_READ_PERMISSIONS.some((permission) =>
    permissionKeys.includes(permission),
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<MyTasksResponse | null>(null);
  const [exceptionsData, setExceptionsData] = useState<ExceptionsResponse | null>(null);
  const [notifications, setNotifications] = useState<NotificationsResponse | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);

  const hasAccess = permissionKeys.includes("scm.access");

  const loadWorkspace = async () => {
    if (!hasAccess) return;
    try {
      setLoading(true);
      setError(null);

      const requests: Array<Promise<any>> = [
        readJson<MyTasksResponse>(
          await fetch("/api/scm/my-tasks", { cache: "no-store" }),
          t("errors.tasks"),
        ),
        readJson<ExceptionsResponse>(
          await fetch("/api/scm/exceptions", { cache: "no-store" }),
          t("errors.exceptions"),
        ),
        readJson<NotificationsResponse>(
          await fetch("/api/scm/notifications?limit=6", { cache: "no-store" }),
          t("errors.notifications"),
        ),
      ];

      if (canReadReports) {
        const today = new Date();
        const from = new Date(today);
        from.setDate(from.getDate() - 30);
        requests.push(
          readJson<DashboardOverview>(
            await fetch(
              `/api/scm/dashboard/overview?from=${from.toISOString().slice(0, 10)}&to=${today
                .toISOString()
                .slice(0, 10)}`,
              { cache: "no-store" },
            ),
            t("errors.overview"),
          ),
        );
      }

      const [tasksData, exceptionsPayload, notificationsPayload, overviewPayload] =
        await Promise.all(requests);

      setTasks(tasksData);
      setExceptionsData(exceptionsPayload);
      setNotifications(notificationsPayload);
      setOverview(overviewPayload ?? null);
    } catch (err: any) {
      setError(err?.message || t("errors.workspace"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, [hasAccess, canReadReports, t]);

  const visibleQuickStart = useMemo(
    () =>
      quickStartLinks.filter((link) => {
        const hasPermission =
          !link.permissions ||
          link.permissions.some((permission) => permissionKeys.includes(permission));
        const hasGlobalPermission =
          !link.globalPermissions ||
          link.globalPermissions.some((permission) =>
            globalPermissionKeys.includes(permission),
          );
        return hasPermission && hasGlobalPermission;
      }),
    [globalPermissionKeys, permissionKeys],
  );

  const visibleDirectory = useMemo(
    () =>
      moduleDirectory
        .map((section) => ({
          ...section,
          links: section.links.filter((link) => {
            const hasPermission =
              !link.permissions ||
              link.permissions.some((permission) => permissionKeys.includes(permission));
            const hasGlobalPermission =
              !link.globalPermissions ||
              link.globalPermissions.some((permission) =>
                globalPermissionKeys.includes(permission),
              );
            return hasPermission && hasGlobalPermission;
          }),
        }))
        .filter((section) => section.links.length > 0),
    [globalPermissionKeys, permissionKeys],
  );

  if (!hasAccess) {
    return (
      <div className="p-4 md:p-6">
        <ScmEmptyState
          title={t("empty.accessTitle")}
          description={t("empty.accessDescription")}
          icon={AlertTriangle}
        />
      </div>
    );
  }

  const unreadCount = notifications?.unreadCount ?? 0;
  const needsMyAction = tasks?.summary.needsMyAction ?? 0;
  const overdue = tasks?.summary.overdue ?? 0;
  const criticalExceptions = exceptionsData?.summary.critical ?? 0;
  const lowStockCount = overview?.overview.lowStockVariants ?? 0;

  return (
    <div className="min-h-screen space-y-6 px-3 py-4 sm:space-y-8 sm:px-4 sm:py-6 md:px-6 lg:px-8">
      {/* Header Section - Responsive */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <ScmSectionHeader
          title={t("header.title")}
          description={t("header.description")}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial">
            <Link href="/admin/scm/my-tasks">{t("actions.myTasks")}</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial">
            <Link href="/admin/scm/exceptions">{t("actions.exceptions")}</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial">
            <Link href="/admin/scm/notifications">{t("actions.notifications")}</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void loadWorkspace()} className="flex-1 sm:flex-initial">
            <RefreshCw className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">{t("actions.refresh")}</span>
            <span className="sm:hidden">{t("actions.sync")}</span>
          </Button>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">{t("loading")}</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Stats Grid - Responsive */}
      {!loading && !error && (
        <>
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <ScmStatCard
              label={t("stats.needsMyAction.label")}
              value={needsMyAction}
              hint={t("stats.needsMyAction.hint")}
              icon={ClipboardCheck}
              tone={needsMyAction > 0 ? "warning" : "default"}
            />
            <ScmStatCard
              label={t("stats.overdue.label")}
              value={overdue}
              hint={t("stats.overdue.hint")}
              icon={AlertTriangle}
              tone={overdue > 0 ? "critical" : "default"}
            />
            <ScmStatCard
              label={t("stats.unread.label")}
              value={unreadCount}
              hint={t("stats.unread.hint")}
              icon={Bell}
              tone={unreadCount > 0 ? "warning" : "default"}
            />
            <ScmStatCard
              label={t("stats.critical.label")}
              value={criticalExceptions}
              hint={canReadReports ? t("stats.critical.lowStock", { count: lowStockCount }) : t("stats.critical.hint")}
              icon={Radar}
              tone={criticalExceptions > 0 ? "critical" : "default"}
            />
          </div>

          {/* Financial Stats - Conditional */}
          {canReadReports && overview && (
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
              <ScmStatCard
              label={t("stats.pendingApprovals.label")}
                value={overview.overview.pendingApprovals}
              hint={t("stats.pendingApprovals.hint")}
                icon={ClipboardList}
              />
              <ScmStatCard
              label={t("stats.orderedValue.label")}
              value={fmtCurrency(overview.overview.totalOrderedAmount, locale, t("common.notAvailable"))}
              hint={t("stats.orderedValue.hint")}
                icon={ShoppingCart}
                tone="success"
              />
              <ScmStatCard
              label={t("stats.supplierPayments.label")}
              value={fmtCurrency(overview.overview.totalSupplierPayments, locale, t("common.notAvailable"))}
              hint={t("stats.supplierPayments.hint")}
                icon={FileText}
                tone="success"
              />
              <ScmStatCard
              label={t("stats.auditEvents.label")}
                value={overview.overview.auditEvents}
              hint={t("stats.auditEvents.hint")}
                icon={Bell}
              />
            </div>
          )}

          {/* Main Content Grid - Responsive with proper stacking */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* My Work Today */}
            <div className="space-y-4">
              <ScmSectionHeader
                title={t("workToday.title")}
                description={t("workToday.description")}
              />
              <ScmActionList
                items={tasks?.needsMyAction.slice(0, 4) ?? []}
                empty={
                  <ScmEmptyState
                    title={t("workToday.emptyTitle")}
                    description={t("workToday.emptyDescription")}
                    icon={ClipboardCheck}
                  />
                }
              />
            </div>

            {/* Urgent Exceptions */}
            <div className="space-y-4">
              <ScmSectionHeader
                title={t("exceptions.title")}
                description={t("exceptions.description")}
              />
              <ScmExceptionList
                items={exceptionsData?.critical.slice(0, 4) ?? []}
                empty={
                  <ScmEmptyState
                    title={t("exceptions.emptyTitle")}
                    description={t("exceptions.emptyDescription")}
                    icon={AlertTriangle}
                  />
                }
              />
            </div>

            {/* Continue Previous Work */}
            <div className="space-y-4">
              <ScmSectionHeader
                title={t("continueWork.title")}
                description={t("continueWork.description")}
              />
              <ScmActionList
                items={tasks?.waitingOnOthers.slice(0, 4) ?? []}
                empty={
                  <ScmEmptyState
                    title={t("continueWork.emptyTitle")}
                    description={t("continueWork.emptyDescription")}
                    icon={ClipboardList}
                  />
                }
              />
            </div>
          </div>

          {/* Bottom Section - Responsive Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Notifications */}
            <Card className="shadow-none">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg">{t("notifications.title")}</CardTitle>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t("notifications.description")}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="self-start sm:self-auto">
                  <Link href="/admin/scm/notifications">{t("notifications.openInbox")}</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {notifications?.rows.length ? (
                  notifications.rows.map((row) => (
                    <Link
                      key={`${row.type}-${row.id}`}
                      href={row.href}
                      className="block rounded-xl border border-border p-3 transition-all duration-200 hover:bg-muted/40 hover:shadow-sm"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground line-clamp-1">
                              {row.title}
                            </p>
                            <ScmStatusChip status={row.readAt ? "READ" : "UNREAD"} />
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                            {row.message}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground sm:text-right">
                          {fmtDate(row.createdAt, locale, t("common.notAvailable"))}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <ScmEmptyState
                    title={t("notifications.emptyTitle")}
                    description={t("notifications.emptyDescription")}
                    icon={Bell}
                  />
                )}
              </CardContent>
            </Card>

            {/* Right Column - Quick Start & Module Directory */}
            <div className="space-y-6">
              {/* Quick Start Section */}
              <div className="space-y-4">
                <ScmSectionHeader
                  title={t("quickStart.title")}
                  description={t("quickStart.description")}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {visibleQuickStart.map((item) => (
                    <Link key={item.key} href={item.href} className="group">
                      <Card className="h-full border-border shadow-none transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm">
                        <CardContent className="flex items-start gap-3 p-4 sm:p-5">
                          <div className="rounded-xl border border-border bg-background p-2.5 shrink-0">
                            <item.icon className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-semibold text-foreground">{t(`links.${item.key}.title` as any)}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                              {t(`links.${item.key}.description` as any)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Module Directory */}
              <div className="space-y-4">
                <ScmSectionHeader
                  title={t("directory.title")}
                  description={t("directory.description")}
                />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-3">
                  {visibleDirectory.map((section) => (
                    <Card key={section.key} className="shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm sm:text-base">{t(`sections.${section.key}` as any)}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {section.links.map((item) => (
                          <Link
                            key={item.key}
                            href={item.href}
                            className="block rounded-lg border border-border p-3 transition-all duration-200 hover:bg-muted/40 hover:shadow-sm"
                          >
                            <div className="flex items-start gap-3">
                              <div className="rounded-lg border border-border bg-background p-2 shrink-0">
                                <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <p className="text-xs sm:text-sm font-medium text-foreground line-clamp-1">
                                  {t(`links.${item.key}.title` as any)}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {t(`links.${item.key}.description` as any)}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
