"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { ScmStatusChip } from "@/components/admin/scm/ScmStatusChip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Warehouse = {
  id: number;
  name: string;
  code: string;
};

type WarehouseTransferItem = {
  id: number;
  productVariantId: number;
  description: string | null;
  quantityRequested: number;
  quantityDispatched: number;
  quantityReceived: number;
  productVariant: {
    id: number;
    sku: string;
    product: {
      name: string;
    };
    stockLevels?: Array<{
      warehouseId: number;
      quantity: number;
      reserved: number;
    }>;
  };
};

type WarehouseTransfer = {
  id: number;
  transferNumber: string;
  status: string;
  requestedAt: string;
  requiredBy: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  note: string | null;
  sourceWarehouseId: number;
  destinationWarehouseId: number;
  sourceWarehouse: Warehouse;
  destinationWarehouse: Warehouse;
  items: WarehouseTransferItem[];
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || fallback);
  }
  return payload as T;
}

function formatDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString();
}

function totalQuantity(
  items: WarehouseTransferItem[],
  field: "quantityRequested" | "quantityDispatched" | "quantityReceived",
) {
  return items.reduce((sum, item) => sum + Number(item[field] || 0), 0);
}

export default function WarehouseTransfersPage() {
  const t = useTranslations("AdminWarehouseTransfers");
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];

  const canRead = permissions.some((permission) =>
    ["warehouse_transfers.read", "warehouse_transfers.manage", "warehouse_transfers.approve"].includes(permission),
  );
  const canManage = permissions.includes("warehouse_transfers.manage");
  const canApprove = permissions.includes("warehouse_transfers.approve");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setStatusFilter(searchParams.get("status") || "");
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const transferData = await fetch("/api/scm/warehouse-transfers", { cache: "no-store" }).then((response) =>
        readJson<WarehouseTransfer[]>(response, t("errors.load")),
      );
      setTransfers(Array.isArray(transferData) ? transferData : []);
    } catch (error: any) {
      toast.error(error?.message || t("errors.load"));
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const visibleTransfers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transfers.filter((transfer) => {
      if (statusFilter && transfer.status !== statusFilter) return false;
      if (!query) return true;
      return (
        transfer.transferNumber.toLowerCase().includes(query) ||
        transfer.sourceWarehouse.name.toLowerCase().includes(query) ||
        transfer.destinationWarehouse.name.toLowerCase().includes(query)
      );
    });
  }, [search, statusFilter, transfers]);

  const runAction = async (transferId: number, action: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/scm/warehouse-transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await readJson(response, t("errors.action", { action }));
      toast.success(
        t("toasts.actionCompleted", { action: t(`actions.${action}` as any) }),
      );
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || t("errors.action", { action }));
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = [
    "DRAFT",
    "SUBMITTED",
    "APPROVED",
    "PARTIALLY_DISPATCHED",
    "DISPATCHED",
    "PARTIALLY_RECEIVED",
    "RECEIVED",
    "CANCELLED",
  ];

  if (!canRead) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("forbidden.title")}</CardTitle>
            <CardDescription>{t("forbidden.description")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("header.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("header.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Button asChild>
              <Link href="/admin/scm/warehouse-transfers/new">
                <Plus className="mr-2 h-4 w-4" />
                {t("actions.newTransfer")}
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
          value={String(transfers.length)}
          hint={t("stats.total.hint")}
        />
        <ScmStatCard
          label={t("stats.pendingApproval.label")}
          value={String(transfers.filter((tr) => tr.status === "SUBMITTED").length)}
          hint={t("stats.pendingApproval.hint")}
        />
        <ScmStatCard
          label={t("stats.inTransit.label")}
          value={String(
            transfers.filter((tr) =>
              ["APPROVED", "PARTIALLY_DISPATCHED", "DISPATCHED", "PARTIALLY_RECEIVED"].includes(tr.status),
            ).length,
          )}
          hint={t("stats.inTransit.hint")}
        />
        <ScmStatCard
          label={t("stats.received.label")}
          value={String(transfers.filter((tr) => tr.status === "RECEIVED").length)}
          hint={t("stats.received.hint")}
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-2">
          <CardTitle>{t("register.title")}</CardTitle>
          <CardDescription>{t("register.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_auto]">
            <Input
              className="sm:col-span-2 lg:col-span-1"
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">{t("filters.allStatuses")}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {t(`statuses.${status}` as any)}
                </option>
              ))}
            </select>

            <Button
              className="w-full sm:w-auto"
              variant="outline"
              onClick={() => void loadData()}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("actions.refresh")}
            </Button>
          </div>

          {loading ? (
            <p className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              {t("loading")}
            </p>
          ) : visibleTransfers.length === 0 ? (
            <p className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <>
              {/* Desktop / Large Tablet Table */}
              <div className="hidden overflow-x-auto rounded-xl border border-border/60 lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">{t("table.transfer")}</TableHead>
                      <TableHead className="min-w-[180px]">{t("table.route")}</TableHead>
                      <TableHead className="min-w-[150px]">{t("table.status")}</TableHead>
                      <TableHead className="min-w-[240px]">{t("table.items")}</TableHead>
                      <TableHead className="min-w-[190px]">{t("table.timeline")}</TableHead>
                      <TableHead className="min-w-[240px] text-right">
                        {t("table.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {visibleTransfers.map((transfer) => {
                      const requested = totalQuantity(transfer.items, "quantityRequested");
                      const dispatched = totalQuantity(transfer.items, "quantityDispatched");
                      const received = totalQuantity(transfer.items, "quantityReceived");

                      return (
                        <TableRow key={transfer.id}>
                          <TableCell className="align-top">
                            <div className="font-medium">{transfer.transferNumber}</div>

                            <div className="text-xs text-muted-foreground">
                              {t("labels.requested")}{" "}
                              {formatDate(transfer.requestedAt, t("labels.na"))}
                            </div>

                            {transfer.note ? (
                              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {transfer.note}
                              </div>
                            ) : null}
                          </TableCell>

                          <TableCell className="align-top text-sm">
                            <div className="font-medium">{transfer.sourceWarehouse.name}</div>
                            <div className="text-muted-foreground">
                              {t("labels.to")} {transfer.destinationWarehouse.name}
                            </div>
                          </TableCell>

                          <TableCell className="align-top">
                            <ScmStatusChip status={transfer.status} />

                            {transfer.requiredBy ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {t("labels.needBy")}{" "}
                                {formatDate(transfer.requiredBy, t("labels.na"))}
                              </div>
                            ) : null}
                          </TableCell>

                          <TableCell className="align-top text-sm">
                            <div className="grid gap-1">
                              <div>
                                {t("labels.requested")}: {requested}
                              </div>
                              <div>
                                {t("labels.dispatched")}: {dispatched}
                              </div>
                              <div>
                                {t("labels.received")}: {received}
                              </div>
                            </div>

                            <div className="mt-2 max-h-24 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                              {transfer.items.map((item) => (
                                <div key={item.id} className="break-words">
                                  {item.productVariant.sku}: {item.quantityRequested}/
                                  {item.quantityDispatched}/{item.quantityReceived}
                                </div>
                              ))}
                            </div>
                          </TableCell>

                          <TableCell className="align-top text-xs text-muted-foreground">
                            <div>
                              {t("labels.submitted")}:{" "}
                              {formatDate(transfer.submittedAt, t("labels.na"))}
                            </div>
                            <div>
                              {t("labels.approved")}:{" "}
                              {formatDate(transfer.approvedAt, t("labels.na"))}
                            </div>
                            <div>
                              {t("labels.dispatched")}:{" "}
                              {formatDate(transfer.dispatchedAt, t("labels.na"))}
                            </div>
                            <div>
                              {t("labels.received")}:{" "}
                              {formatDate(transfer.receivedAt, t("labels.na"))}
                            </div>
                          </TableCell>

                          <TableCell className="align-top text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/admin/scm/warehouse-transfers/${transfer.id}`}>
                                  {t("actions.openDetail")}
                                </Link>
                              </Button>

                              {canManage && transfer.status === "DRAFT" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void runAction(transfer.id, "submit")}
                                  disabled={saving}
                                >
                                  {t("actions.submit")}
                                </Button>
                              ) : null}

                              {canApprove && transfer.status === "SUBMITTED" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void runAction(transfer.id, "approve")}
                                  disabled={saving}
                                >
                                  {t("actions.approve")}
                                </Button>
                              ) : null}

                              {canManage &&
                              ["APPROVED", "PARTIALLY_DISPATCHED", "PARTIALLY_RECEIVED"].includes(
                                transfer.status,
                              ) ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void runAction(transfer.id, "dispatch")}
                                  disabled={saving}
                                >
                                  {t("actions.dispatch")}
                                </Button>
                              ) : null}

                              {canManage &&
                              ["DISPATCHED", "PARTIALLY_DISPATCHED", "PARTIALLY_RECEIVED"].includes(
                                transfer.status,
                              ) ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void runAction(transfer.id, "receive")}
                                  disabled={saving}
                                >
                                  {t("actions.receive")}
                                </Button>
                              ) : null}

                              {canManage &&
                              ["DRAFT", "SUBMITTED", "APPROVED"].includes(transfer.status) ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => void runAction(transfer.id, "cancel")}
                                  disabled={saving}
                                >
                                  {t("actions.cancel")}
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile / Tablet Cards */}
              <div className="grid gap-4 lg:hidden">
                {visibleTransfers.map((transfer) => {
                  const requested = totalQuantity(transfer.items, "quantityRequested");
                  const dispatched = totalQuantity(transfer.items, "quantityDispatched");
                  const received = totalQuantity(transfer.items, "quantityReceived");

                  return (
                    <div
                      key={transfer.id}
                      className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
                    >
                      <div className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="break-words text-sm font-bold text-foreground sm:text-base">
                              {transfer.transferNumber}
                            </div>

                            <div className="mt-1 text-xs text-muted-foreground">
                              {t("labels.requested")}{" "}
                              {formatDate(transfer.requestedAt, t("labels.na"))}
                            </div>

                            {transfer.note ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {transfer.note}
                              </div>
                            ) : null}
                          </div>

                          <div className="w-fit">
                            <ScmStatusChip status={transfer.status} />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl bg-muted/30 p-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t("table.route")}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-foreground">
                              {transfer.sourceWarehouse.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {t("labels.to")} {transfer.destinationWarehouse.name}
                            </div>
                          </div>

                          <div className="rounded-xl bg-muted/30 p-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t("labels.requiredBy")}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-foreground">
                              {transfer.requiredBy
                                ? formatDate(transfer.requiredBy, t("labels.na"))
                                : t("labels.na")}
                            </div>
                          </div>

                          <div className="rounded-xl bg-muted/30 p-3 sm:col-span-2">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t("labels.quantity")}
                            </div>

                            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-lg bg-background p-2">
                                <div className="text-xs text-muted-foreground">
                                  {t("labels.requested")}
                                </div>
                                <div className="font-bold">{requested}</div>
                              </div>

                              <div className="rounded-lg bg-background p-2">
                                <div className="text-xs text-muted-foreground">
                                  {t("labels.dispatched")}
                                </div>
                                <div className="font-bold">{dispatched}</div>
                              </div>

                              <div className="rounded-lg bg-background p-2">
                                <div className="text-xs text-muted-foreground">
                                  {t("labels.received")}
                                </div>
                                <div className="font-bold">{received}</div>
                              </div>
                            </div>

                            <div className="mt-3 max-h-28 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                              {transfer.items.map((item) => (
                                <div key={item.id} className="break-words">
                                  {item.productVariant.sku}: {item.quantityRequested}/
                                  {item.quantityDispatched}/{item.quantityReceived}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-xl bg-muted/30 p-3 sm:col-span-2">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t("table.timeline")}
                            </div>

                            <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                              <div>
                                {t("labels.submitted")}:{" "}
                                {formatDate(transfer.submittedAt, t("labels.na"))}
                              </div>
                              <div>
                                {t("labels.approved")}:{" "}
                                {formatDate(transfer.approvedAt, t("labels.na"))}
                              </div>
                              <div>
                                {t("labels.dispatched")}:{" "}
                                {formatDate(transfer.dispatchedAt, t("labels.na"))}
                              </div>
                              <div>
                                {t("labels.received")}:{" "}
                                {formatDate(transfer.receivedAt, t("labels.na"))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/admin/scm/warehouse-transfers/${transfer.id}`}>
                              {t("actions.openDetail")}
                            </Link>
                          </Button>

                          {canManage && transfer.status === "DRAFT" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void runAction(transfer.id, "submit")}
                              disabled={saving}
                            >
                              {t("actions.submit")}
                            </Button>
                          ) : null}

                          {canApprove && transfer.status === "SUBMITTED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void runAction(transfer.id, "approve")}
                              disabled={saving}
                            >
                              {t("actions.approve")}
                            </Button>
                          ) : null}

                          {canManage &&
                          ["APPROVED", "PARTIALLY_DISPATCHED", "PARTIALLY_RECEIVED"].includes(
                            transfer.status,
                          ) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void runAction(transfer.id, "dispatch")}
                              disabled={saving}
                            >
                              {t("actions.dispatch")}
                            </Button>
                          ) : null}

                          {canManage &&
                          ["DISPATCHED", "PARTIALLY_DISPATCHED", "PARTIALLY_RECEIVED"].includes(
                            transfer.status,
                          ) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void runAction(transfer.id, "receive")}
                              disabled={saving}
                            >
                              {t("actions.receive")}
                            </Button>
                          ) : null}

                          {canManage &&
                          ["DRAFT", "SUBMITTED", "APPROVED"].includes(transfer.status) ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void runAction(transfer.id, "cancel")}
                              disabled={saving}
                            >
                              {t("actions.cancel")}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}