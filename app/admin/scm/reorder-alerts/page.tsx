"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RefreshCw, Filter, Package, AlertTriangle, CheckCircle, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Warehouse = { id: number; name: string; code: string };
type Variant = { id: number; sku: string; product?: { id: number; name: string } };

type AlertRow = {
  id: number;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  stockOnHand: number;
  threshold: number;
  suggestedQty: number;
  note: string | null;
  createdAt: string;
  warehouse: Warehouse;
  productVariant: {
    id: number;
    sku: string;
    product: { id: number; name: string };
  };
  createdBy?: { id: string; name: string | null; email: string | null } | null;
};

async function readJson<T>(res: Response, errorMessage: string) {
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || errorMessage);
  }
  return (await res.json()) as T;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "OPEN":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "ACKNOWLEDGED":
      return "bg-warning/10 text-warning border-warning/20";
    case "RESOLVED":
      return "bg-success/10 text-success border-success/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "OPEN":
      return AlertTriangle;
    case "ACKNOWLEDGED":
      return Clock;
    case "RESOLVED":
      return CheckCircle;
    default:
      return Filter;
  }
};

export default function ReorderAlertsPage() {
  const t = useTranslations("AdminReorderAlerts");
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];

  const canRead =
    permissions.includes("stock_alerts.read") || permissions.includes("stock_alerts.manage");
  const canManage = permissions.includes("stock_alerts.manage");

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [manualForm, setManualForm] = useState({
    warehouseId: "",
    productVariantId: "",
    note: "",
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [warehouseRes, variantRes] = await Promise.all([
        fetch("/api/warehouses", { cache: "no-store" }),
        fetch("/api/product-variants", { cache: "no-store" }),
      ]);
      const [warehouseData, variantData] = await Promise.all([
        readJson<Warehouse[]>(warehouseRes, t("errors.loadWarehouses")),
        readJson<Variant[]>(variantRes, t("errors.loadVariants")),
      ]);
      setWarehouses(warehouseData);
      setVariants(variantData);
      if (!warehouseId && warehouseData.length > 0) {
        setWarehouseId(String(warehouseData[0].id));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.loadData"));
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      const qs = new URLSearchParams();
      if (warehouseId) qs.set("warehouseId", warehouseId);
      if (status) qs.set("status", status);
      if (search.trim()) qs.set("search", search.trim());
      const res = await fetch(`/api/scm/reorder-alerts?${qs.toString()}`, {
        cache: "no-store",
      });
      const data = await readJson<AlertRow[]>(res, t("errors.loadAlerts"));
      setAlerts(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.loadAlerts"));
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canRead) return;
    void loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, status, search, canRead]);

  const createManual = async () => {
    if (!manualForm.warehouseId || !manualForm.productVariantId) {
      toast.error(t("errors.warehouseVariantRequired"));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/scm/reorder-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: Number(manualForm.warehouseId),
          productVariantId: Number(manualForm.productVariantId),
          note: manualForm.note,
        }),
      });
      await readJson(res, t("errors.createAlert"));
      toast.success(t("toasts.alertCreated"));
      setManualForm({ warehouseId: "", productVariantId: "", note: "" });
      await loadAlerts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.createAlert"));
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: number, nextStatus: AlertRow["status"]) => {
    try {
      const res = await fetch("/api/scm/reorder-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      await readJson(res, t("errors.updateAlert"));
      toast.success(t("toasts.alertUpdated"));
      await loadAlerts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.updateAlert"));
    }
  };

  const scanAlerts = async () => {
    if (!canManage) return;
    setScanLoading(true);
    try {
      const res = await fetch("/api/scm/reorder-alerts/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: warehouseId ? Number(warehouseId) : undefined,
        }),
      });
      const data = await readJson<{ created: number }>(res, t("errors.scanAlerts"));
      toast.success(t("toasts.scanResult", { count: data.created }));
      await loadAlerts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.scanAlerts"));
    } finally {
      setScanLoading(false);
    }
  };

  const filteredVariants = useMemo(
    () =>
      variants.map((variant) => ({
        value: String(variant.id),
        label: `${variant.product?.name || t("labels.variant")} (${variant.sku})`,
      })),
    [variants, t],
  );

  if (!canRead) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t("forbidden.description")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            {t("header.title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            {t("header.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button
              variant="outline"
              onClick={() => void scanAlerts()}
              disabled={scanLoading}
              className="flex-1 sm:flex-initial"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", scanLoading && "animate-spin")} />
              {t("actions.scanStock")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => void loadAlerts()}
            disabled={loading}
            className="flex-1 sm:flex-initial"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            {t("actions.refresh")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters Card - Desktop */}
      <Card className="hidden sm:block shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{t("filters.title")}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t("filters.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm">{t("filters.warehouse")}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">{t("filters.allWarehouses")}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm">{t("filters.status")}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">{t("filters.all")}</option>
                <option value="OPEN">{t("statuses.OPEN")}</option>
                <option value="ACKNOWLEDGED">{t("statuses.ACKNOWLEDGED")}</option>
                <option value="RESOLVED">{t("statuses.RESOLVED")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm">{t("filters.search")}</Label>
              <Input
                placeholder={t("filters.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Filter Drawer */}
      {showFilters && (
        <Card className="sm:hidden shadow-sm">
          <CardHeader className="p-4">
            <CardTitle className="text-base">{t("filters.title")}</CardTitle>
            <CardDescription className="text-xs">
              {t("filters.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">{t("filters.warehouse")}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">{t("filters.allWarehouses")}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t("filters.status")}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">{t("filters.all")}</option>
                <option value="OPEN">{t("statuses.OPEN")}</option>
                <option value="ACKNOWLEDGED">{t("statuses.ACKNOWLEDGED")}</option>
                <option value="RESOLVED">{t("statuses.RESOLVED")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t("filters.search")}</Label>
              <Input
                placeholder={t("filters.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(false)}
              className="w-full"
            >
              {t("filters.closeFilters")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Manual Alert Card */}
      {canManage && (
        <Card className="shadow-sm">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              {t("manual.title")}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t("manual.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-[1fr_1.5fr_2fr_auto] sm:gap-3">
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={manualForm.warehouseId}
                onChange={(e) => setManualForm((cur) => ({ ...cur, warehouseId: e.target.value }))}
              >
                <option value="">{t("manual.selectWarehouse")}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={manualForm.productVariantId}
                onChange={(e) =>
                  setManualForm((cur) => ({ ...cur, productVariantId: e.target.value }))
                }
              >
                <option value="">{t("manual.selectVariant")}</option>
                {filteredVariants.map((variant) => (
                  <option key={variant.value} value={variant.value}>
                    {variant.label}
                  </option>
                ))}
              </select>
              <Input
                placeholder={t("manual.notePlaceholder")}
                value={manualForm.note}
                onChange={(e) => setManualForm((cur) => ({ ...cur, note: e.target.value }))}
                className="text-sm"
              />
              <Button
                onClick={() => void createManual()}
                disabled={creating}
                className="w-full sm:w-auto"
              >
                {creating ? t("manual.creating") : t("manual.createAlert")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert Register */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{t("register.title")}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t("register.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    {t("table.warehouse")}
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    {t("table.variant")}
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">
                    {t("table.onHand")}
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">
                    {t("table.threshold")}
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">
                    {t("table.suggested")}
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    {t("table.status")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">{t("empty")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  alerts.map((alert) => (
                    <TableRow key={alert.id} className="border-border hover:bg-muted/40">
                      <TableCell className="py-3">
                        <div className="font-medium text-sm text-foreground">
                          {alert.warehouse.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {alert.warehouse.code}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="font-medium text-sm text-foreground">
                          {alert.productVariant.product.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {alert.productVariant.sku}
                        </div>
                        {alert.note && (
                          <div className="text-xs text-muted-foreground mt-1 italic">
                            {alert.note}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <span
                          className={cn(
                            "font-medium",
                            alert.stockOnHand <= alert.threshold && "text-destructive",
                          )}
                        >
                          {alert.stockOnHand}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-3 text-foreground">
                        {alert.threshold}
                      </TableCell>
                      <TableCell className="text-right py-3 text-primary font-medium">
                        {alert.suggestedQty}
                      </TableCell>
                      <TableCell className="py-3">
                        {canManage ? (
                          <select
                            className={cn(
                              "rounded-md border px-2 py-1 text-xs font-medium",
                              getStatusColor(alert.status),
                            )}
                            value={alert.status}
                            onChange={(e) =>
                              void updateStatus(alert.id, e.target.value as AlertRow["status"])
                            }
                          >
                            <option value="OPEN">{t("statuses.OPEN")}</option>
                            <option value="ACKNOWLEDGED">
                              {t("statuses.ACKNOWLEDGED")}
                            </option>
                            <option value="RESOLVED">{t("statuses.RESOLVED")}</option>
                          </select>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                              getStatusColor(alert.status),
                            )}
                          >
                            {t(`statuses.${alert.status}` as any)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              </div>
            ) : (
              alerts.map((alert) => {
                const StatusIcon = getStatusIcon(alert.status);
                return (
                  <Card key={alert.id} className="border-border shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            {alert.productVariant.product.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {alert.productVariant.sku}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ml-2",
                            getStatusColor(alert.status),
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {t(`statuses.${alert.status}` as any)}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">
                            {t("table.warehouse")}:
                          </span>
                          <span className="text-foreground font-medium">
                            {alert.warehouse.name} ({alert.warehouse.code})
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/50">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("table.onHand")}
                          </p>
                          <p
                            className={cn(
                              "text-base font-semibold",
                              alert.stockOnHand <= alert.threshold && "text-destructive",
                            )}
                          >
                            {alert.stockOnHand}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("table.threshold")}
                          </p>
                          <p className="text-base font-semibold text-foreground">
                            {alert.threshold}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("table.suggested")}
                          </p>
                          <p className="text-base font-semibold text-primary">
                            {alert.suggestedQty}
                          </p>
                        </div>
                      </div>

                      {alert.note && (
                        <div className="pt-2 border-t border-border/50">
                          <p className="text-xs text-muted-foreground italic">
                            {t("labels.note")}: {alert.note}
                          </p>
                        </div>
                      )}

                      {canManage && (
                        <div className="pt-2">
                          <label className="text-xs text-muted-foreground block mb-1">
                            {t("table.updateStatus")}
                          </label>
                          <select
                            className={cn(
                              "w-full rounded-md border px-3 py-2 text-sm font-medium",
                              getStatusColor(alert.status),
                            )}
                            value={alert.status}
                            onChange={(e) =>
                              void updateStatus(alert.id, e.target.value as AlertRow["status"])
                            }
                          >
                            <option value="OPEN">{t("statuses.OPEN")}</option>
                            <option value="ACKNOWLEDGED">
                              {t("statuses.ACKNOWLEDGED")}
                            </option>
                            <option value="RESOLVED">{t("statuses.RESOLVED")}</option>
                          </select>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}