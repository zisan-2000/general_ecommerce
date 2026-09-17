"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { ScmStatusChip } from "@/components/admin/scm/ScmStatusChip";

type Supplier = { id: number; name: string; code: string; currency: string };
type Warehouse = { id: number; name: string; code: string };
type PurchaseOrder = {
  id: number;
  poNumber: string;
  status: string;
  approvalStage: string;
  orderDate: string;
  expectedAt: string | null;
  currency: string;
  grandTotal: number | string;
  supplier: Supplier;
  warehouse: Warehouse;
  items: Array<{ id: number; quantityOrdered: number; quantityReceived: number }>;
};

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || fallbackMessage);
  }
  return data as T;
}

export default function PurchaseOrdersPage() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const t = useTranslations("AdminPurchaseOrders");
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];
  const canManage = permissions.includes("purchase_orders.manage");

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "ALL");

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setStatusFilter(searchParams.get("status") || "ALL");
  }, [searchParams]);

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/scm/purchase-orders?${params.toString()}`, { cache: "no-store" });
      const data = await readJson<PurchaseOrder[]>(response, t("errors.load"));
      setPurchaseOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error?.message || t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPurchaseOrders();
  }, [statusFilter]);

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return purchaseOrders;
    return purchaseOrders.filter((purchaseOrder) =>
      purchaseOrder.poNumber.toLowerCase().includes(query) ||
      purchaseOrder.supplier.name.toLowerCase().includes(query) ||
      purchaseOrder.warehouse.name.toLowerCase().includes(query),
    );
  }, [purchaseOrders, search]);

  const summary = useMemo(() => ({
    total: purchaseOrders.length,
    draft: purchaseOrders.filter((row) => row.status === "DRAFT").length,
    approval: purchaseOrders.filter((row) => ["SUBMITTED", "MANAGER_APPROVED", "COMMITTEE_APPROVED"].includes(row.status)).length,
    approved: purchaseOrders.filter((row) => row.status === "APPROVED").length,
  }), [purchaseOrders]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("header.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("header.description")}
          </p>
        </div>
        <div className="flex gap-2">
          {canManage ? (
            <Button asChild>
              <Link href="/admin/scm/purchase-orders/new">
                <Plus className="mr-2 h-4 w-4" />
                {t("actions.newPo")}
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => void loadPurchaseOrders()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("actions.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <ScmStatCard label={t("stats.total.label")} value={String(summary.total)} hint={t("stats.total.hint")} />
        <ScmStatCard label={t("stats.draft.label")} value={String(summary.draft)} hint={t("stats.draft.hint")} />
        <ScmStatCard label={t("stats.approval.label")} value={String(summary.approval)} hint={t("stats.approval.hint")} />
        <ScmStatCard label={t("stats.approved.label")} value={String(summary.approved)} hint={t("stats.approved.hint")} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{t("register.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("register.description")}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("filters.searchPlaceholder")} className="w-full md:w-80" />
            <select className="w-full rounded-md border bg-background px-3 py-2 md:w-56" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">{t("filters.allStatuses")}</option>
              <option value="DRAFT">{t("filters.draft")}</option>
              <option value="SUBMITTED">{t("filters.submitted")}</option>
              <option value="MANAGER_APPROVED">{t("filters.managerApproved")}</option>
              <option value="COMMITTEE_APPROVED">{t("filters.committeeApproved")}</option>
              <option value="APPROVED">{t("filters.approved")}</option>
              <option value="REJECTED">{t("filters.rejected")}</option>
              <option value="CANCELLED">{t("filters.cancelled")}</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : visibleOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="space-y-4">
              {visibleOrders.map((purchaseOrder) => (
                <div key={purchaseOrder.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/scm/purchase-orders/${purchaseOrder.id}`} className="text-lg font-semibold underline-offset-4 hover:underline">
                          {purchaseOrder.poNumber}
                        </Link>
                        <ScmStatusChip status={purchaseOrder.status} />
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                        <div>{t("labels.supplier")}: {purchaseOrder.supplier.name}</div>
                        <div>{t("labels.warehouse")}: {purchaseOrder.warehouse.name}</div>
                        <div>{t("labels.expected")}: {purchaseOrder.expectedAt ? new Date(purchaseOrder.expectedAt).toLocaleDateString() : "-"}</div>
                        <div>{t("labels.total")}: {Number(purchaseOrder.grandTotal).toFixed(2)} {purchaseOrder.currency}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/admin/scm/purchase-orders/${purchaseOrder.id}`}>{t("actions.openDetail")}</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
