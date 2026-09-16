"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  Loader2,
  Plus,
  PackageCheck,
  RefreshCw,
  Truck,
  Warehouse,
  Map,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import WarehouseDashboardSkeleton from "@/components/ui/WarehouseDashboardSkeleton";
import WarehouseLocationPicker from "@/components/Settings/WarehouseLocationPicker";
import WarehouseFormModal from "@/components/Settings/WarehouseFormModal";
import WarehouseSkeleton from "@/components/ui/WarehouseSkeleton";
import {
  Warehouse as WarehouseType,
  WarehouseMapData,
} from "@/lib/types/warehouse";

type WarehouseOption = {
  id: number;
  name: string;
  code: string;
  isDefault: boolean;
};

type WarehouseCard = {
  warehouseId: number;
  name: string;
  code: string;
  isDefault: boolean;
  totalUnits: number;
  reservedUnits: number;
  lowStockItems: number;
  pendingShipments: number;
  deliveredToday: number;
};

type DashboardData = {
  selectedWarehouseIds: number[];
  warehouses: WarehouseOption[];
  summary: {
    totalWarehouses: number;
    totalUnits: number;
    reservedUnits: number;
    lowStockItems: number;
    pendingShipments: number;
    deliveredToday: number;
    ordersInQueue: number;
  };
  warehouseCards: WarehouseCard[];
  lowStock: Array<{
    warehouseId: number;
    variantId: number;
    sku: string | null;
    productName: string;
    available: number;
    threshold: number;
  }>;
  recentShipments: Array<{
    id: number;
    warehouseId: number | null;
    orderId: number;
    status: string;
    courier: string;
    trackingNumber: string | null;
    createdAt: string;
    customerName: string;
    orderStatus: string;
  }>;
  recentLogs: Array<{
    id: number;
    createdAt: string;
    change: number;
    reason: string;
    productName: string;
    warehouseName: string;
    warehouseCode: string;
  }>;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function WarehouseDashboardPage() {
  const router = useRouter();
  const t = useTranslations("AdminWarehouseDashboard");

  const [warehouseId, setWarehouseId] = useState<string>("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [mapData, setMapData] = useState<WarehouseMapData[]>([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(true);
  const [showAddWarehouseModal, setShowAddWarehouseModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] =
    useState<WarehouseType | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchDashboard = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError("");

        const response = await fetch("/api/admin/warehouse-dashboard", {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || t("errors.loadFailed"));
        }

        setData(payload);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : t("errors.loadFailed"),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const loadMapData = useCallback(async () => {
    setMapLoading(true);
    try {
      const res = await fetch("/api/warehouses/map");
      const data = await res.json();
      setMapData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load map data:", error);
      setMapData([]);
    } finally {
      setMapLoading(false);
    }
  }, []);

  const loadWarehouses = useCallback(async () => {
    setWarehousesLoading(true);
    try {
      const res = await fetch("/api/warehouses", { cache: "no-store" });
      const payload = await res.json().catch(() => []);
      setWarehouses(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error("Failed to load warehouses:", error);
      setWarehouses([]);
    } finally {
      setWarehousesLoading(false);
    }
  }, []);

  const selectedMapWarehouseId =
    warehouseId && warehouseId !== "all" ? warehouseId : null;

  useEffect(() => {
    fetchDashboard();
    loadMapData();
    loadWarehouses();
  }, [fetchDashboard, loadMapData, loadWarehouses]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchDashboard(true), loadMapData(), loadWarehouses()]);
  }, [fetchDashboard, loadMapData, loadWarehouses]);

  const selectedWarehouseLabel = useMemo(() => {
    if (!data) return t("warehouse.allAssigned");

    if (data.selectedWarehouseIds.length === 0) {
      return t("warehouse.allAssigned");
    }

    const selectedWarehouses = data.warehouses.filter((warehouse) =>
      data.selectedWarehouseIds.includes(warehouse.id),
    );

    if (selectedWarehouses.length === 1) {
      const selected = selectedWarehouses[0];
      return `${selected.name} (${selected.code})`;
    }

    if (selectedWarehouses.length > 1) {
      return t("warehouse.multipleSelected", {
        count: selectedWarehouses.length,
      });
    }

    return t("warehouse.assigned");
  }, [data, t]);

  const summaryCards = useMemo(
    () => [
      {
        title: t("summary.warehouseScope"),
        value: String(data?.summary.totalWarehouses ?? 0),
        note: selectedWarehouseLabel,
        icon: Warehouse,
      },
      {
        title: t("summary.unitsOnHand"),
        value: String(data?.summary.totalUnits ?? 0),
        note: t("summary.reservedUnits", {
          count: data?.summary.reservedUnits ?? 0,
        }),
        icon: Boxes,
      },
      {
        title: t("summary.pendingShipments"),
        value: String(data?.summary.pendingShipments ?? 0),
        note: t("summary.stillPending", {
          count: data?.summary.ordersInQueue ?? 0,
        }),
        icon: Truck,
      },
      {
        title: t("summary.lowStockAlerts"),
        value: String(data?.summary.lowStockItems ?? 0),
        note: t("summary.deliveredToday", {
          count: data?.summary.deliveredToday ?? 0,
        }),
        icon: AlertTriangle,
      },
    ],
    [data, selectedWarehouseLabel, t],
  );

  const handleWarehouseCardClick = useCallback(
    (selectedWarehouseId: number) => {
      setWarehouseId(String(selectedWarehouseId));
    },
    [],
  );

  const warehouseCardItems = useMemo(() => {
    if (!data?.warehouseCards.length) return null;

    return data.warehouseCards.map((card) => {
      const isSelected = String(card.warehouseId) === warehouseId;
      return (
        <button
          type="button"
          key={card.warehouseId}
          onClick={() => void handleWarehouseCardClick(card.warehouseId)}
          className={`grid gap-3 w-full rounded-2xl border bg-background p-4 text-left transition hover:bg-accent/10 focus:outline-none md:grid-cols-6 ${
            isSelected ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <div className="md:col-span-2">
            <p className="font-medium text-foreground">
              {card.name} ({card.code})
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {card.isDefault
                ? t("card.defaultWarehouse")
                : t("card.operationalWarehouse")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {t("card.available", {
                  count: Math.max(0, card.totalUnits - card.reservedUnits),
                })}
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700">
                {t("card.deliveredToday", { count: card.deliveredToday })}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {t("card.units")}
            </p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {card.totalUnits}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {t("card.reserved")}
            </p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {card.reservedUnits}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {t("card.lowStock")}
            </p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {card.lowStockItems}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {t("card.shipments")}
            </p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {t("card.pendingCount", { count: card.pendingShipments })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("card.pressureIndicator")}
            </p>
          </div>
        </button>
      );
    });
  }, [data?.warehouseCards, handleWarehouseCardClick, warehouseId, t]);

  const lowStockItems = useMemo(() => {
    if (!data?.lowStock.length) return null;

    const filteredLowStock = warehouseId
      ? data.lowStock.filter((item) => String(item.warehouseId) === warehouseId)
      : data.lowStock;

    return filteredLowStock.map((item) => (
      <div
        key={`${item.warehouseId}:${item.variantId}`}
        className="rounded-2xl border bg-background p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">{item.productName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.sku || t("labels.noSku")} ·{" "}
              {t("labels.warehouseId", { id: item.warehouseId })}
            </p>
          </div>
          <div className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700">
            {t("labels.leftCount", { count: item.available })}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("labels.threshold", { count: item.threshold })}
        </p>
      </div>
    ));
  }, [data?.lowStock, warehouseId, t]);

  const recentShipmentItems = useMemo(() => {
    if (!data?.recentShipments.length) return null;

    const filteredShipments = warehouseId
      ? data.recentShipments.filter(
          (shipment) =>
            shipment.warehouseId &&
            String(shipment.warehouseId) === warehouseId,
        )
      : data.recentShipments;

    return filteredShipments.map((shipment) => (
      <div key={shipment.id} className="rounded-2xl border bg-background p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">
              {t("shipments.shipmentTitle", {
                shipmentId: shipment.id,
                orderId: shipment.orderId,
              })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {shipment.customerName || t("labels.unknownCustomer")} ·{" "}
              {shipment.courier}
            </p>
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {shipment.status}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            {t("shipments.orderLabel")}: {shipment.orderStatus || "-"}
          </span>
          <span>
            {t("shipments.trackingLabel")}: {shipment.trackingNumber || "-"}
          </span>
          <span>{formatDateTime(shipment.createdAt)}</span>
        </div>
      </div>
    ));
  }, [data?.recentShipments, warehouseId, t]);

  const recentLogItems = useMemo(() => {
    if (!data?.recentLogs.length) return null;

    let filteredLogs = data.recentLogs;
    if (warehouseId) {
      const selectedWarehouse = data.warehouses.find(
        (w) => String(w.id) === warehouseId,
      );
      if (selectedWarehouse) {
        filteredLogs = data.recentLogs.filter(
          (log) => log.warehouseName === selectedWarehouse.name,
        );
      }
    }

    return filteredLogs.map((log) => (
      <div key={log.id} className="rounded-2xl border bg-background p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">{log.productName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {log.warehouseName} ({log.warehouseCode || "-"})
            </p>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              log.change >= 0
                ? "bg-emerald-500/10 text-emerald-700"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {log.change > 0 ? `+${log.change}` : log.change}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{log.reason}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {formatDateTime(log.createdAt)}
        </p>
      </div>
    ));
  }, [data?.recentLogs, data?.warehouses, warehouseId]);

  if (loading) {
    return <WarehouseDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="space-y-6">
        <section className="rounded-3xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
                {t("hero.badge")}
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
                {t("hero.title")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {t("hero.description")}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-w-[240px] justify-between rounded-2xl px-4 py-3 text-sm font-medium"
                  >
                    <span className="truncate">{selectedWarehouseLabel}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-[280px] rounded-2xl"
                >
                  <DropdownMenuLabel>{t("warehouse.scope")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={warehouseId || "all"}
                    onValueChange={(value) => {
                      const nextWarehouseId = value === "all" ? "" : value;
                      setWarehouseId(nextWarehouseId);
                    }}
                  >
                    <DropdownMenuRadioItem value="all">
                      {t("warehouse.allAssigned")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuSeparator />
                    {data?.warehouses.map((warehouse) => (
                      <DropdownMenuRadioItem
                        key={warehouse.id}
                        value={String(warehouse.id)}
                      >
                        {warehouse.name} ({warehouse.code})
                        {warehouse.isDefault
                          ? t("warehouse.defaultSuffix")
                          : ""}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                type="button"
                className="rounded-2xl px-4 py-3 text-sm font-medium"
                onClick={() => setShowAddWarehouseModal(true)}
              >
                <Plus className="h-4 w-4" />
                {t("actions.addWarehouse")}
              </Button>

              <button
                type="button"
                onClick={() => void refreshAll()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                {t("actions.refresh")}
              </button>
            </div>
          </div>
          {error ? (
            <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <article
              key={card.title}
              className="rounded-3xl border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">
                    {card.value}
                  </p>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{card.note}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border bg-card p-5 shadow-sm min-h-[600px]">
          <div className="flex flex-col gap-4 border-b pb-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {t("coverage.title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("coverage.subtitle")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "overview"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                {t("coverage.tabs.coverage")}
              </button>

              <button
                onClick={() => setActiveTab("management")}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "management"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Settings className="h-4 w-4" />
                {t("coverage.tabs.management")}
              </button>
            </div>
          </div>

          <div className="mt-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <article className="rounded-3xl border bg-background p-5 shadow-sm">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {t("coverage.cards.coverageTitle")}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t("coverage.cards.coverageSubtitle")}
                      </p>
                    </div>

                    <div className="mt-4 space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {warehouseCardItems ? (
                        warehouseCardItems
                      ) : (
                        <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                          {t("coverage.cards.noWarehouses")}
                        </div>
                      )}
                    </div>
                  </article>

                  <article className="rounded-3xl border bg-background p-5 shadow-sm">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-foreground">
                        {t("coverage.cards.mapTitle")}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t("coverage.cards.mapSubtitle")}
                      </p>
                    </div>

                    {!mapLoading && mapData.length > 0 ? (
                      <div className="mb-4 text-sm text-muted-foreground">
                        {t("coverage.map.found", { count: mapData.length })}
                        {warehouseId &&
                          warehouseId !== "all" &&
                          t("coverage.map.highlighting")}
                      </div>
                    ) : null}

                    {mapLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                        <div className="h-96 bg-gray-200 rounded mt-4"></div>
                      </div>
                    ) : mapData.length === 0 ? (
                      <div className="text-center py-8">
                        <Map className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">
                          {warehouseId && warehouseId !== "all"
                            ? t("coverage.map.emptySelected")
                            : t("coverage.map.empty")}
                        </p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div
                          className="absolute inset-0 flex items-center justify-center bg-background/80 z-50"
                          id="map-error-boundary"
                          style={{ display: "none" }}
                        >
                          <div className="text-center">
                            <Map className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-sm text-muted-foreground">
                              {t("coverage.map.failed")}
                            </p>
                          </div>
                        </div>

                        <WarehouseLocationPicker
                          readonly
                          markers={mapData.map((warehouse) => ({
                            id: warehouse.id,
                            name: warehouse.name,
                            code: warehouse.code,
                            label: warehouse.mapLabel,
                            latitude: warehouse.latitude ?? 0,
                            longitude: warehouse.longitude ?? 0,
                            district: warehouse.district,
                            area: warehouse.area,
                            coverageRadiusKm:
                              warehouse.coverageRadiusKm ?? null,
                          }))}
                          selectedMarkerId={selectedMapWarehouseId}
                          title={t("coverage.map.pickerTitle")}
                          heightClassName="h-96"
                          onMarkerSelect={(id) => {
                            if (id !== null) {
                              setWarehouseId(String(id));
                            }
                          }}
                          onError={() => {
                            const errorBoundary =
                              document.getElementById("map-error-boundary");
                            if (errorBoundary) {
                              errorBoundary.style.display = "flex";
                            }
                          }}
                        />
                      </div>
                    )}
                  </article>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <article className="rounded-3xl border bg-background p-5 shadow-sm max-h-[500px] overflow-y-auto pr-1">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {t("coverage.lowStock.title")}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t("coverage.lowStock.subtitle")}
                      </p>
                    </div>

                    <div className="mt-4 space-y-3">
                      {lowStockItems ? (
                        lowStockItems
                      ) : (
                        <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                          {t("coverage.lowStock.empty")}
                        </div>
                      )}
                    </div>
                  </article>

                  <article className="rounded-3xl border bg-background p-5 shadow-sm max-h-[500px] overflow-y-auto pr-1">
                    <div className="flex items-center gap-2">
                      <PackageCheck className="h-4 w-4 text-primary" />
                      <h3 className="text-lg font-semibold text-foreground">
                        {t("coverage.activity.title")}
                      </h3>
                    </div>

                    <div className="mt-4 space-y-3">
                      {recentLogItems ? (
                        recentLogItems
                      ) : (
                        <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                          {t("coverage.activity.empty")}
                        </div>
                      )}
                    </div>
                  </article>
                </div>

                <article className="rounded-3xl border bg-background p-5 shadow-sm max-h-[500px] overflow-y-auto pr-1">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">
                      {t("coverage.shipments.title")}
                    </h3>
                  </div>

                  <div className="mt-4 space-y-3">
                    {recentShipmentItems ? (
                      recentShipmentItems
                    ) : (
                      <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        {t("coverage.shipments.empty")}
                      </div>
                    )}
                  </div>
                </article>
              </div>
            )}

            {activeTab === "management" && (
              <div className="space-y-6">
                <article className="rounded-3xl border bg-background p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {t("management.title")}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t("management.subtitle")}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => void loadWarehouses()}
                        disabled={warehousesLoading}
                      >
                        {warehousesLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        {t("actions.refresh")}
                      </Button>

                      <Button
                        type="button"
                        className="rounded-2xl"
                        onClick={() => setShowAddWarehouseModal(true)}
                      >
                        <Plus className="h-4 w-4" />
                        {t("actions.addWarehouse")}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {warehousesLoading ? (
                      <WarehouseSkeleton />
                    ) : warehouses.length === 0 ? (
                      <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        {t("management.empty")}
                      </div>
                    ) : (
                      warehouses.map((warehouse) => (
                        <div
                          key={warehouse.id}
                          className="rounded-2xl border bg-card p-4"
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-foreground">
                                  {warehouse.name}
                                </p>
                                {warehouse.isDefault ? (
                                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                                    {t("management.defaultBadge")}
                                  </span>
                                ) : null}
                                <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                  {warehouse.code}
                                </span>
                              </div>

                              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                {warehouse.address?.location ? (
                                  <div>
                                    {t("management.addressLabel")}:{" "}
                                    {warehouse.address.location}
                                  </div>
                                ) : null}
                                {warehouse.division ||
                                warehouse.district ||
                                warehouse.area ? (
                                  <div>
                                    {[
                                      warehouse.division,
                                      warehouse.district,
                                      warehouse.area,
                                    ]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </div>
                                ) : null}
                                {warehouse.latitude && warehouse.longitude ? (
                                  <div>
                                    {t("management.gpsLabel")}:{" "}
                                    {warehouse.latitude.toFixed(4)},{" "}
                                    {warehouse.longitude.toFixed(4)}
                                  </div>
                                ) : null}
                                {warehouse.mapLabel ? (
                                  <div>
                                    {t("management.mapLabelLabel")}:{" "}
                                    {warehouse.mapLabel}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-2xl"
                                onClick={() =>
                                  router.push(
                                    `/admin/warehouse/${warehouse.id}`,
                                  )
                                }
                              >
                                {t("management.actions.details")}
                              </Button>

                              {warehouse.latitude &&
                              warehouse.longitude &&
                              warehouse.isMapEnabled ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-2xl"
                                  onClick={() => {
                                    window.open(
                                      `https://www.google.com/maps?q=${warehouse.latitude},${warehouse.longitude}`,
                                      "_blank",
                                    );
                                  }}
                                >
                                  {t("management.actions.map")}
                                </Button>
                              ) : null}

                              <Button
                                type="button"
                                className="rounded-2xl"
                                onClick={() => setEditingWarehouse(warehouse)}
                              >
                                {t("management.actions.edit")}
                              </Button>

                              <Button
                                type="button"
                                variant="destructive"
                                className="rounded-2xl"
                                onClick={async () => {
                                  if (
                                    confirm(
                                      t("management.deleteConfirm", {
                                        name: warehouse.name,
                                      }),
                                    )
                                  ) {
                                    await fetch(
                                      `/api/warehouses/${warehouse.id}`,
                                      {
                                        method: "DELETE",
                                      },
                                    );
                                    void loadWarehouses();
                                    void loadMapData();
                                    void fetchDashboard();
                                  }
                                }}
                              >
                                {t("management.actions.delete")}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              </div>
            )}
          </div>
        </section>
      </div>

      {showAddWarehouseModal ? (
        <WarehouseFormModal
          onClose={() => setShowAddWarehouseModal(false)}
          refresh={() => {
            void loadWarehouses();
            void loadMapData();
            void fetchDashboard();
          }}
        />
      ) : null}

      {editingWarehouse ? (
        <WarehouseFormModal
          onClose={() => setEditingWarehouse(null)}
          refresh={() => {
            void loadWarehouses();
            void loadMapData();
            void fetchDashboard();
          }}
          editingWarehouse={editingWarehouse}
        />
      ) : null}
    </div>
  );
}
