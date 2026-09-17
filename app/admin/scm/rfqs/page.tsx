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

type Warehouse = { id: number; name: string; code: string };
type Supplier = { id: number; name: string; code: string };
type SupplierCategory = { id: number; name: string; code: string };
type Rfq = {
  id: number;
  rfqNumber: string;
  status: string;
  requestedAt: string;
  submissionDeadline: string | null;
  quotationSubmissionCount?: number;
  warehouse: Warehouse;
  purchaseRequisition?: { id: number; requisitionNumber: string; status: string } | null;
  categoryTargets?: Array<{ id: number; supplierCategoryId: number; supplierCategory: SupplierCategory }>;
  supplierInvites: Array<{ supplierId: number; supplier: Supplier; status: string }>;
  quotations: Array<{ id: number }>;
  award: { purchaseOrderId: number | null; supplier: Supplier; supplierQuotationId: number } | null;
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { error?: string }).error || fallback);
  return payload as T;
}

export default function RfqPage() {
  const t = useTranslations("AdminRfqs");
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];
  const canManage = permissions.includes("rfq.manage");

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "ALL");
  const [rfqs, setRfqs] = useState<Rfq[]>([]);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setStatus(searchParams.get("status") || "ALL");
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "ALL") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/scm/rfqs?${params.toString()}`, { cache: "no-store" });
      const data = await readJson<Rfq[]>(response, t("errors.load"));
      setRfqs(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error?.message || t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rfqs;
    return rfqs.filter((rfq) =>
      rfq.rfqNumber.toLowerCase().includes(q) ||
      rfq.warehouse.name.toLowerCase().includes(q) ||
      rfq.purchaseRequisition?.requisitionNumber.toLowerCase().includes(q) ||
      rfq.supplierInvites.some((item) => item.supplier.name.toLowerCase().includes(q)),
    );
  }, [rfqs, search]);

  const summary = useMemo(
    () => ({
      total: rfqs.length,
      open: rfqs.filter((row) => ["DRAFT", "SUBMITTED"].includes(row.status)).length,
      awarded: rfqs.filter((row) => row.status === "AWARDED").length,
      closed: rfqs.filter((row) => ["CLOSED", "CANCELLED"].includes(row.status)).length,
    }),
    [rfqs],
  );

  const statusOptions = ["DRAFT", "SUBMITTED", "CLOSED", "AWARDED", "CANCELLED"];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("header.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("header.description")}</p>
        </div>
        <div className="flex gap-2">
          {canManage ? (
            <Button asChild>
              <Link href="/admin/scm/rfqs/new">
                <Plus className="mr-2 h-4 w-4" />
                {t("actions.newRfq")}
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("actions.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <ScmStatCard
          label={t("stats.total.label")}
          value={String(summary.total)}
          hint={t("stats.total.hint")}
        />
        <ScmStatCard
          label={t("stats.open.label")}
          value={String(summary.open)}
          hint={t("stats.open.hint")}
        />
        <ScmStatCard
          label={t("stats.awarded.label")}
          value={String(summary.awarded)}
          hint={t("stats.awarded.hint")}
        />
        <ScmStatCard
          label={t("stats.closed.label")}
          value={String(summary.closed)}
          hint={t("stats.closed.hint")}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{t("register.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("register.description")}</p>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("filters.searchPlaceholder")}
              className="w-full md:w-80"
            />
            <select
              className="w-full rounded-md border bg-background px-3 py-2 md:w-52"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ALL">{t("filters.allStatuses")}</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {t(`statuses.${option}` as any)}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="space-y-4">
              {visible.map((rfq) => (
                <div key={rfq.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/scm/rfqs/${rfq.id}`}
                          className="text-lg font-semibold underline-offset-4 hover:underline"
                        >
                          {rfq.rfqNumber}
                        </Link>
                        <ScmStatusChip status={rfq.status} />
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          {t("labels.warehouse")}: {rfq.warehouse.name}
                        </div>
                        <div>
                          {t("labels.mrf")}:{" "}
                          {rfq.purchaseRequisition?.requisitionNumber || "-"}
                        </div>
                        <div>
                          {t("labels.invites")}: {rfq.supplierInvites.length}
                        </div>
                        <div>
                          {t("labels.quotes")}:{" "}
                          {rfq.quotationSubmissionCount ?? rfq.quotations.length}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/admin/scm/rfqs/${rfq.id}`}>
                          {t("actions.openDetail")}
                        </Link>
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