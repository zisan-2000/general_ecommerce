"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Warehouse = {
  id: number;
  name: string;
  code: string;
};

type MaterialRelease = {
  id: number;
  releaseNumber: string;
  challanNumber: string | null;
  waybillNumber: string | null;
  status: string;
  releasedAt: string;
  note: string | null;
  warehouse: Warehouse;
  materialRequest: {
    id: number;
    requestNumber: string;
  };
  items: Array<{
    id: number;
    quantityReleased: number;
    unitCost: string | null;
    productVariant: {
      id: number;
      sku: string;
      product: {
        id: number;
        name: string;
      };
    };
  }>;
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || fallback);
  }
  return payload as T;
}

function formatDateTime(value: string | null, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString();
}

function formatMoney(value: string | number | null | undefined) {
  return Number(value || 0).toFixed(2);
}

function toCsvValue(value: string | number | null | undefined) {
  const plain = value === null || value === undefined ? "" : String(value);
  return `"${plain.replace(/"/g, '""')}"`;
}

export default function MaterialReleaseReportPage() {
  const t = useTranslations("AdminMaterialReleaseReport");
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];

  const canRead = permissions.some((permission) =>
    [
      "material_releases.read",
      "material_releases.manage",
      "material_requests.read",
      "material_requests.approve_admin",
    ].includes(permission),
  );

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [warehouseId, setWarehouseId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [releases, setReleases] = useState<MaterialRelease[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      if (warehouseId) query.set("warehouseId", warehouseId);
      if (status !== "ALL") query.set("status", status);
      if (from) query.set("from", from);
      if (to) query.set("to", to);

      const [warehouseData, releaseData] = await Promise.all([
        fetch("/api/warehouses", { cache: "no-store" }).then((res) =>
          readJson<Warehouse[]>(res, t("errors.loadWarehouses")),
        ),
        fetch(`/api/scm/material-releases?${query.toString()}`, { cache: "no-store" }).then((res) =>
          readJson<MaterialRelease[]>(res, t("errors.loadReport")),
        ),
      ]);

      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
      setReleases(Array.isArray(releaseData) ? releaseData : []);
    } catch (error: any) {
      toast.error(error?.message || t("errors.loadReport"));
      setReleases([]);
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

  const totals = useMemo(() => {
    const totalQty = releases.reduce(
      (sum, release) =>
        sum + release.items.reduce((lineSum, item) => lineSum + item.quantityReleased, 0),
      0,
    );

    const totalValue = releases.reduce(
      (sum, release) =>
        sum +
        release.items.reduce(
          (lineSum, item) => lineSum + Number(item.unitCost || 0) * item.quantityReleased,
          0,
        ),
      0,
    );

    return { count: releases.length, totalQty, totalValue };
  }, [releases]);

  const exportCsv = () => {
    if (releases.length === 0) {
      toast.error(t("errors.noRows"));
      return;
    }

    const rows = [
      [
        t("csv.releaseNo"),
        t("csv.date"),
        t("csv.warehouse"),
        t("csv.requestNo"),
        t("csv.challan"),
        t("csv.waybill"),
        t("csv.status"),
        t("csv.totalQty"),
        t("csv.totalValue"),
      ],
      ...releases.map((release) => {
        const qty = release.items.reduce((sum, item) => sum + item.quantityReleased, 0);
        const value = release.items.reduce(
          (sum, item) => sum + Number(item.unitCost || 0) * item.quantityReleased,
          0,
        );
        return [
          release.releaseNumber,
          formatDateTime(release.releasedAt, t("labels.na")),
          `${release.warehouse.name} (${release.warehouse.code})`,
          release.materialRequest.requestNumber,
          release.challanNumber || "",
          release.waybillNumber || "",
          release.status,
          qty,
          formatMoney(value),
        ];
      }),
    ];

    const csv = rows
      .map((row) => row.map((item) => toCsvValue(item as string | number)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `material-release-report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      <div>
        <h1 className="text-2xl font-bold">{t("header.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("header.description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("filters.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-2">
              <Label>{t("filters.search")}</Label>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("filters.searchPlaceholder")}
              />
            </div>
            <div>
              <Label>{t("filters.warehouse")}</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
              >
                <option value="">{t("filters.all")}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t("filters.status")}</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="ALL">{t("filters.all")}</option>
                <option value="ISSUED">{t("statuses.ISSUED")}</option>
                <option value="CANCELLED">{t("statuses.CANCELLED")}</option>
              </select>
            </div>
            <div>
              <Label>{t("filters.from")}</Label>
              <Input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div>
              <Label>{t("filters.to")}</Label>
              <Input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("actions.refresh")}
            </Button>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              {t("actions.exportCsv")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">{t("stats.releaseNotes")}</div>
            <div className="text-2xl font-bold">{totals.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">{t("stats.totalReleasedQty")}</div>
            <div className="text-2xl font-bold">{totals.totalQty}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">{t("stats.totalReleasedValue")}</div>
            <div className="text-2xl font-bold">{formatMoney(totals.totalValue)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/60 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2 border-b border-border/50 pb-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-foreground sm:text-xl">
                {t("register.title")}
              </CardTitle>

              <CardDescription className="mt-1 text-xs sm:text-sm">
                {t("register.description")}
              </CardDescription>
            </div>

            <div className="status-pill w-fit rounded-full px-3 py-1 text-xs font-medium">
              {t("register.totalReleases", { count: releases.length })}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center p-6">
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            </div>
          ) : releases.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center p-6">
              <p className="text-center text-sm text-muted-foreground">{t("empty")}</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden w-full overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="whitespace-nowrap">
                        {t("table.release")}
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        {t("table.warehouse")}
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        {t("table.request")}
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        {t("table.status")}
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-right">
                        {t("table.qty")}
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-right">
                        {t("table.value")}
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-right">
                        {t("table.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {releases.map((release) => {
                      const qty = release.items.reduce(
                        (sum, item) => sum + item.quantityReleased,
                        0,
                      );
                      const value = release.items.reduce(
                        (sum, item) =>
                          sum + Number(item.unitCost || 0) * item.quantityReleased,
                        0,
                      );

                      return (
                        <TableRow
                          key={release.id}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <TableCell className="min-w-[240px]">
                            <div className="space-y-1">
                              <Link
                                href={`/admin/scm/material-releases/${release.id}`}
                                className="font-semibold text-primary underline-offset-4 hover:underline"
                              >
                                {release.releaseNumber}
                              </Link>

                              <div className="text-xs text-muted-foreground">
                                {formatDateTime(release.releasedAt, t("labels.na"))}
                              </div>

                              <div className="text-xs text-muted-foreground">
                                {t("labels.challanShort")}:{" "}
                                {release.challanNumber || t("labels.na")} |{" "}
                                {t("labels.waybillShort")}:{" "}
                                {release.waybillNumber || t("labels.na")}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="min-w-[180px]">
                            <div className="font-medium">{release.warehouse.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {release.warehouse.code}
                            </div>
                          </TableCell>

                          <TableCell className="min-w-[180px]">
                            <Link
                              href={`/admin/scm/material-requests/${release.materialRequest.id}`}
                              className="font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {release.materialRequest.requestNumber}
                            </Link>
                          </TableCell>

                          <TableCell>
                            <span className="status-pill-good rounded-full px-2.5 py-1 text-xs font-semibold">
                              {t(`statuses.${release.status}` as any)}
                            </span>
                          </TableCell>

                          <TableCell className="text-right font-semibold">{qty}</TableCell>

                          <TableCell className="text-right font-semibold">
                            {formatMoney(value)}
                          </TableCell>

                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() =>
                                  window.open(
                                    `/admin/scm/material-releases/${release.id}/print?type=challan`,
                                    "_blank",
                                  )
                                }
                              >
                                <Printer className="mr-1 h-3.5 w-3.5" />
                                {t("actions.challan")}
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() =>
                                  window.open(
                                    `/admin/scm/material-releases/${release.id}/print?type=waybill`,
                                    "_blank",
                                  )
                                }
                              >
                                <Printer className="mr-1 h-3.5 w-3.5" />
                                {t("actions.waybill")}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile + Tablet Cards */}
              <div className="grid gap-4 p-4 lg:hidden">
                {releases.map((release) => {
                  const qty = release.items.reduce(
                    (sum, item) => sum + item.quantityReleased,
                    0,
                  );
                  const value = release.items.reduce(
                    (sum, item) =>
                      sum + Number(item.unitCost || 0) * item.quantityReleased,
                    0,
                  );

                  return (
                    <div
                      key={release.id}
                      className="overflow-hidden rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/admin/scm/material-releases/${release.id}`}
                              className="line-clamp-1 text-sm font-bold text-primary underline-offset-4 hover:underline sm:text-base"
                            >
                              {release.releaseNumber}
                            </Link>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDateTime(release.releasedAt, t("labels.na"))}
                            </p>
                          </div>

                          <span className="status-pill-good shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-xs">
                            {t(`statuses.${release.status}` as any)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl bg-muted/40 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("table.warehouse")}
                            </p>
                            <p className="mt-1 font-semibold text-foreground">
                              {release.warehouse.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {release.warehouse.code}
                            </p>
                          </div>

                          <div className="rounded-xl bg-muted/40 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("table.request")}
                            </p>
                            <Link
                              href={`/admin/scm/material-requests/${release.materialRequest.id}`}
                              className="mt-1 block font-semibold text-primary underline-offset-4 hover:underline"
                            >
                              {release.materialRequest.requestNumber}
                            </Link>
                          </div>

                          <div className="rounded-xl bg-muted/40 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("table.qty")}
                            </p>
                            <p className="mt-1 text-base font-bold text-foreground">{qty}</p>
                          </div>

                          <div className="rounded-xl bg-muted/40 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("table.value")}
                            </p>
                            <p className="mt-1 text-base font-bold text-foreground">
                              {formatMoney(value)}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 rounded-xl bg-muted/30 p-3">
                          <div className="text-xs text-muted-foreground">
                            {t("labels.challanShort")}:{" "}
                            {release.challanNumber || t("labels.na")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("labels.waybillShort")}:{" "}
                            {release.waybillNumber || t("labels.na")}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() =>
                              window.open(
                                `/admin/scm/material-releases/${release.id}/print?type=challan`,
                                "_blank",
                              )
                            }
                          >
                            <Printer className="mr-1 h-3.5 w-3.5" />
                            {t("actions.challan")}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() =>
                              window.open(
                                `/admin/scm/material-releases/${release.id}/print?type=waybill`,
                                "_blank",
                              )
                            }
                          >
                            <Printer className="mr-1 h-3.5 w-3.5" />
                            {t("actions.waybill")}
                          </Button>
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