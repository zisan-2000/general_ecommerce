"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { ScmStatusChip } from "@/components/admin/scm/ScmStatusChip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Warehouse = {
  id: number;
  name: string;
  code: string;
};

type MaterialRequest = {
  id: number;
  requestNumber: string;
  warehouseId: number;
  status: string;
  purpose: string | null;
  requiredBy: string | null;
  warehouse: Warehouse;
  items: Array<{
    id: number;
    quantityRequested: number;
    quantityReleased: number;
    productVariantId: number;
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

type MaterialRelease = {
  id: number;
  releaseNumber: string;
  challanNumber: string | null;
  waybillNumber: string | null;
  materialRequestId: number;
  warehouseId: number;
  status: string;
  note: string | null;
  releasedAt: string;
  warehouse: Warehouse;
  releasedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  materialRequest: {
    id: number;
    requestNumber: string;
    status: string;
    createdBy: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  };
  items: Array<{
    id: number;
    materialRequestItemId: number;
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
    assetRegisters: Array<{
      id: number;
      assetTag: string;
      status: string;
    }>;
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

export default function MaterialReleasesPage() {
  const t = useTranslations("AdminMaterialReleases");
  const searchParams = useSearchParams();
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
  const canManage = permissions.includes("material_releases.manage");

  const [loading, setLoading] = useState(true);
  const [materialReleases, setMaterialReleases] = useState<MaterialRelease[]>([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "ALL");

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setStatusFilter(searchParams.get("status") || "ALL");
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const releaseData = await fetch("/api/scm/material-releases", { cache: "no-store" }).then((res) =>
        readJson<MaterialRelease[]>(res, t("errors.load")),
      );
      setMaterialReleases(Array.isArray(releaseData) ? releaseData : []);
    } catch (error: any) {
      toast.error(error?.message || t("errors.load"));
      setMaterialReleases([]);
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

  const visibleReleases = useMemo(() => {
    const query = search.trim().toLowerCase();
    return materialReleases.filter((release) => {
      if (statusFilter !== "ALL" && release.status !== statusFilter) return false;
      if (!query) return true;
      return (
        release.releaseNumber.toLowerCase().includes(query) ||
        (release.challanNumber || "").toLowerCase().includes(query) ||
        (release.waybillNumber || "").toLowerCase().includes(query) ||
        release.materialRequest.requestNumber.toLowerCase().includes(query) ||
        release.warehouse.name.toLowerCase().includes(query)
      );
    });
  }, [materialReleases, search, statusFilter]);

  const summary = useMemo(
    () => ({
      total: materialReleases.length,
      issued: materialReleases.filter((release) => release.status === "ISSUED").length,
      cancelled: materialReleases.filter((release) => release.status === "CANCELLED").length,
      assetTagged: materialReleases.filter((release) =>
        release.items.some((item) => item.assetRegisters.length > 0),
      ).length,
    }),
    [materialReleases],
  );

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
              <Link href="/admin/scm/material-releases/new">
                <Plus className="mr-2 h-4 w-4" />
                {t("actions.newRelease")}
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
          label={t("stats.issued.label")}
          value={String(summary.issued)}
          hint={t("stats.issued.hint")}
        />
        <ScmStatCard
          label={t("stats.cancelled.label")}
          value={String(summary.cancelled)}
          hint={t("stats.cancelled.hint")}
        />
        <ScmStatCard
          label={t("stats.assetTagged.label")}
          value={String(summary.assetTagged)}
          hint={t("stats.assetTagged.hint")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("register.title")}</CardTitle>
          <CardDescription>{t("register.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">{t("filters.allStatuses")}</option>
              <option value="ISSUED">{t("statuses.ISSUED")}</option>
              <option value="CANCELLED">{t("statuses.CANCELLED")}</option>
            </select>
            <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("actions.refresh")}
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : visibleReleases.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="space-y-4">
              {visibleReleases.map((release) => {
                const totalQty = release.items.reduce(
                  (sum, item) => sum + item.quantityReleased,
                  0,
                );
                const totalCost = release.items.reduce(
                  (sum, item) => sum + Number(item.unitCost || 0) * item.quantityReleased,
                  0,
                );

                return (
                  <Card key={release.id}>
                    <CardHeader className="gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{release.releaseNumber}</CardTitle>
                          <CardDescription>
                            {t("labels.requestShort")} {release.materialRequest.requestNumber} |{" "}
                            {release.warehouse.name}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/admin/scm/material-releases/${release.id}`}>
                              {t("actions.openDetail")}
                            </Link>
                          </Button>
                          <ScmStatusChip status={release.status} />
                        </div>
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          {t("labels.releasedAt")}:{" "}
                          {formatDateTime(release.releasedAt, t("labels.na"))}
                        </div>
                        <div>
                          {t("labels.challan")}: {release.challanNumber || t("labels.na")}
                        </div>
                        <div>
                          {t("labels.waybill")}: {release.waybillNumber || t("labels.na")}
                        </div>
                        <div>
                          {t("labels.releasedBy")}:{" "}
                          {release.releasedBy?.name ||
                            release.releasedBy?.email ||
                            t("labels.na")}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {release.note ? (
                        <p className="text-sm text-muted-foreground">{release.note}</p>
                      ) : null}

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("table.item")}</TableHead>
                            <TableHead>{t("table.qty")}</TableHead>
                            <TableHead>{t("table.unitCost")}</TableHead>
                            <TableHead>{t("table.lineCost")}</TableHead>
                            <TableHead>{t("table.assetTags")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {release.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="font-medium">
                                  {item.productVariant.product.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {item.productVariant.sku}
                                </div>
                              </TableCell>
                              <TableCell>{item.quantityReleased}</TableCell>
                              <TableCell>{formatMoney(item.unitCost)}</TableCell>
                              <TableCell>
                                {formatMoney(Number(item.unitCost || 0) * item.quantityReleased)}
                              </TableCell>
                              <TableCell>
                                {item.assetRegisters.length > 0 ? (
                                  <div className="space-y-1 text-xs">
                                    {item.assetRegisters.slice(0, 4).map((asset) => (
                                      <div key={asset.id}>{asset.assetTag}</div>
                                    ))}
                                    {item.assetRegisters.length > 4 ? (
                                      <div className="text-muted-foreground">
                                        {t("table.more", { count: item.assetRegisters.length - 4 })}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {t("labels.na")}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      <div className="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          {t("labels.totalQty")}: {totalQty}
                        </div>
                        <div>
                          {t("labels.totalCost")}: {formatMoney(totalCost)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}