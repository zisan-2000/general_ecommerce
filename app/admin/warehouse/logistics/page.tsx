"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import ShipmentsSkeleton from "@/components/ui/ShipmentsSkeleton";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { 
  Search, 
  AlertCircle, 
  Package, 
  Truck, 
  CheckCircle,
  MapPin 
} from "lucide-react";

type ShipmentStatusType =
  | "PENDING"
  | "ASSIGNED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "RETURNED"
  | "CANCELLED";

type ShipmentRow = {
  id: number;
  orderId: number;
  warehouseId?: number | null;
  courier: string;
  courierStatus?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  status: ShipmentStatusType;
  expectedDate?: string | null;
  assignedAt?: string | null;
  pickedAt?: string | null;
  outForDeliveryAt?: string | null;
  deliveredAt?: string | null;
  estimatedCost?: string | number | null;
  actualCost?: string | number | null;
  thirdPartyCost?: string | number | null;
  handlingCost?: string | number | null;
  packagingCost?: string | number | null;
  fuelCost?: string | number | null;
  dispatchNote?: string | null;
  priority?: number | null;
  createdAt: string;
  assignedTo?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  shippingRate?: {
    id: number;
    area?: string | null;
    district?: string | null;
    baseCost?: string | number | null;
  } | null;
  order?: {
    id: number;
    name?: string | null;
    phone_number?: string | null;
    status?: string | null;
    paymentStatus?: string | null;
  } | null;
  warehouse?: {
    id: number;
    name: string;
    code: string;
    latitude?: number | null;
    longitude?: number | null;
    mapLabel?: string | null;
    isMapEnabled?: boolean | null;
  } | null;
  deliveryAssignments?: Array<{
    id: string;
    status?: string | null;
    assignedAt?: string | null;
    deliveredAt?: string | null;
    deliveredLatitude?: number | null;
    deliveredLongitude?: number | null;
    deliveredAccuracy?: number | null;
  }> | null;
};

type Warehouse = {
  id: number;
  name: string;
  code: string;
  latitude?: number | null;
  longitude?: number | null;
  mapLabel?: string | null;
  isMapEnabled?: boolean | null;
};

const STATUS_OPTIONS: Array<"ALL" | ShipmentStatusType> = [
  "ALL",
  "PENDING",
  "ASSIGNED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RETURNED",
  "CANCELLED",
];

const NEXT_STATUS_MAP: Record<ShipmentStatusType, ShipmentStatusType[]> = {
  PENDING: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "FAILED", "CANCELLED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED", "RETURNED", "CANCELLED"],
  DELIVERED: ["RETURNED"],
  FAILED: ["ASSIGNED", "CANCELLED"],
  RETURNED: [],
  CANCELLED: [],
};

const STATUS_LABELS: Record<"ALL" | ShipmentStatusType, string> = {
  ALL: "All statuses",
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

const NEXT_STATUS_LABELS: Record<ShipmentStatusType, string> = {
  PENDING: "Mark as pending",
  ASSIGNED: "Mark as assigned",
  IN_TRANSIT: "Mark as in transit",
  OUT_FOR_DELIVERY: "Mark as out for delivery",
  DELIVERED: "Mark as delivered",
  FAILED: "Mark as failed",
  RETURNED: "Mark as returned",
  CANCELLED: "Cancel shipment",
};

const currency = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 0,
});

const monthlyOrderBars = [
  { label: "Jan", value: 22 },
  { label: "Feb", value: 38 },
  { label: "Mar", value: 54 },
  { label: "Apr", value: 43 },
  { label: "May", value: 60 },
  { label: "Jun", value: 78 },
  { label: "Jul", value: 64 },
];

const successBars = [42, 54, 61, 70, 84, 76, 68, 72, 81, 92, 67, 55];

function toAmount(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatAmount(value: number) {
  return currency.format(value || 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatShortDate(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatStatusLabel(status: "ALL" | ShipmentStatusType) {
  return STATUS_LABELS[status];
}

function getCurrentDeliveryAssignment(shipment: ShipmentRow) {
  return shipment.deliveryAssignments?.[0] ?? null;
}

function hasValidDeliveryLocation(shipment: ShipmentRow) {
  const assignment = getCurrentDeliveryAssignment(shipment);
  return (
    typeof assignment?.deliveredLatitude === "number" &&
    Number.isFinite(assignment.deliveredLatitude) &&
    typeof assignment.deliveredLongitude === "number" &&
    Number.isFinite(assignment.deliveredLongitude)
  );
}

function MultiShipmentsMap({ shipments }: { shipments: ShipmentRow[] }) {
  // Group shipments by warehouse and get unique warehouses
  const warehouseMap = new Map<
    number,
    { warehouse: Warehouse; shipments: ShipmentRow[] }
  >();

  shipments.forEach((shipment) => {
    if (
      shipment.warehouse &&
      shipment.warehouse.latitude &&
      shipment.warehouse.longitude
    ) {
      if (!warehouseMap.has(shipment.warehouse.id)) {
        warehouseMap.set(shipment.warehouse.id, {
          warehouse: shipment.warehouse,
          shipments: [],
        });
      }
      warehouseMap.get(shipment.warehouse.id)!.shipments.push(shipment);
    }
  });

  const warehouseData = Array.from(warehouseMap.values());

  if (warehouseData.length === 0) {
    return (
      <div className="h-full w-full rounded-[22px] overflow-hidden border border-border/60 bg-card flex items-center justify-center">
        <p className="text-muted-foreground">
          No warehouse locations are available yet.
        </p>
      </div>
    );
  }

  // Calculate center point for map
  const avgLat =
    warehouseData.reduce(
      (sum, item) => sum + (item.warehouse.latitude || 0),
      0,
    ) / warehouseData.length;
  const avgLng =
    warehouseData.reduce(
      (sum, item) => sum + (item.warehouse.longitude || 0),
      0,
    ) / warehouseData.length;

  return (
    <div className="h-[530px] w-full rounded-[22px] overflow-hidden border border-border/60 bg-card">
      <MapContainer
        center={[avgLat, avgLng]}
        zoom={8}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {warehouseData.map(({ warehouse, shipments: warehouseShipments }) => {
          const activeCount = warehouseShipments.filter(
            (s) =>
              s.status === "PENDING" ||
              s.status === "IN_TRANSIT" ||
              s.status === "OUT_FOR_DELIVERY",
          ).length;
          const deliveredCount = warehouseShipments.filter(
            (s) => s.status === "DELIVERED",
          ).length;

          return (
            <Marker
              key={warehouse.id}
              position={[warehouse.latitude!, warehouse.longitude!]}
              icon={L.divIcon({
                className: "custom-div-icon",
                html: `
                  <div class="relative flex items-center justify-center">
                    <div class="absolute inset-0 bg-primary rounded-full opacity-30 animate-ping"></div>
                    <div class="relative w-8 h-8 bg-primary rounded-full border-2 border-primary-foreground flex items-center justify-center">
                      <div class="w-2 h-2 bg-primary-foreground rounded-full"></div>
                    </div>
                  </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
              })}
            >
              <Popup className="min-w-[200px]">
                <div className="text-sm">
                  <div className="font-semibold mb-2">{warehouse.name}</div>
                  <div className="space-y-1 text-muted-foreground">
                    <div>Code: {warehouse.code}</div>
                    <div>Active shipments: {activeCount}</div>
                    <div>Delivered shipments: {deliveredCount}</div>
                    <div>Total shipments: {warehouseShipments.length}</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <style jsx>{`
        .custom-div-icon {
          background: transparent;
          border: none;
        }
        :global(.leaflet-popup-content-wrapper) {
          border-radius: 8px;
        }
        :global(.leaflet-popup-content) {
          margin: 0;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

function ShipmentTrackingMap({ shipment }: { shipment: ShipmentRow | null }) {
  if (!shipment) return null;

  // Fallback route coordinates are used when shipment map data is incomplete.
  const originLat = shipment.warehouse?.latitude;
  const originLng = shipment.warehouse?.longitude;
  const hasOrigin =
    typeof originLat === "number" &&
    Number.isFinite(originLat) &&
    typeof originLng === "number" &&
    Number.isFinite(originLng);

  // Check if we have actual delivery location
  const hasDeliveryLocation = hasValidDeliveryLocation(shipment);
  const deliveryAssignment = getCurrentDeliveryAssignment(shipment);

  const routeCoordinates: [number, number][] = hasOrigin
    ? hasDeliveryLocation
      ? [
          [originLat as number, originLng as number],
          [
            deliveryAssignment?.deliveredLatitude as number,
            deliveryAssignment?.deliveredLongitude as number,
          ],
        ]
      : [
          [originLat as number, originLng as number],
          [(originLat as number) + 0.03, (originLng as number) + 0.03],
          [(originLat as number) + 0.06, (originLng as number) + 0.06],
          [(originLat as number) + 0.09, (originLng as number) + 0.09],
        ]
    : [
        [23.685, 90.3563],
        [23.75, 90.4],
        [23.8, 90.45],
        [23.85, 90.5],
      ];

  const getStatusColor = (status: ShipmentStatusType) => {
    switch (status) {
      case "DELIVERED":
        return "#10b981";
      case "CANCELLED":
      case "RETURNED":
        return "#ef4444";
      case "OUT_FOR_DELIVERY":
        return "#f59e0b";
      default:
        return "#06b6d4";
    }
  };

  const getProgressPercentage = () => {
    switch (shipment.status) {
      case "PENDING":
        return 0;
      case "IN_TRANSIT":
        return 50;
      case "OUT_FOR_DELIVERY":
        return 75;
      case "DELIVERED":
        return 100;
      case "CANCELLED":
      case "RETURNED":
        return 100;
      default:
        return 0;
    }
  };

  const progress = getProgressPercentage();
  const statusColor = getStatusColor(shipment.status);

  // Calculate current position based on progress
  const currentPositionIndex = Math.floor(
    (progress / 100) * (routeCoordinates.length - 1),
  );
  const currentPosition = routeCoordinates[currentPositionIndex];

  return (
    <div className="h-64 w-full rounded-[22px] overflow-hidden border border-border/60 bg-card">
      <MapContainer
        center={routeCoordinates[0]}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route line */}
        <Polyline
          positions={routeCoordinates}
          pathOptions={{
            color: statusColor,
            weight: 3,
            opacity: 0.7,
            dashArray: progress < 100 ? [10, 10] : [],
          }}
        />

        {/* Route markers */}
        {routeCoordinates.map((coord, index) => {
          const isCompleted =
            (index / (routeCoordinates.length - 1)) * 100 <= progress;
          const isCurrent = index === currentPositionIndex;

          return (
            <Marker
              key={index}
              position={coord}
              icon={L.divIcon({
                className: "custom-div-icon",
                html: `
                  <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    isCompleted
                      ? "bg-emerald-500 border-emerald-600"
                      : isCurrent
                        ? "bg-primary border-primary-600 animate-pulse"
                        : "bg-muted border-border"
                  }">
                    <div class="w-3 h-3 rounded-full ${
                      isCompleted
                        ? "bg-emerald-100"
                        : isCurrent
                          ? "bg-primary-foreground"
                          : "bg-muted-foreground"
                    }"></div>
                  </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              })}
            >
              <Popup className="min-w-[200px]">
                <div className="text-sm">
                  <div className="font-semibold mb-1">
                    {index === 0 && "Origin warehouse"}
                    {index === routeCoordinates.length - 1 &&
                    hasDeliveryLocation
                      ? "Delivery location"
                      : "Destination"}
                    {index > 0 &&
                      index < routeCoordinates.length - 1 &&
                      `Checkpoint ${index}`}
                  </div>
                  <div className="text-muted-foreground">
                    Route status:{" "}
                    {isCompleted
                      ? "Completed"
                      : isCurrent
                        ? "Current position"
                        : "Upcoming"}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Current position marker */}
        {currentPosition && progress > 0 && progress < 100 && (
          <Marker
            position={currentPosition}
            icon={L.divIcon({
              className: "current-position-marker",
              html: `
                <div class="relative">
                  <div class="absolute inset-0 bg-primary rounded-full animate-ping opacity-75"></div>
                  <div class="relative w-6 h-6 bg-primary rounded-full border-2 border-primary-foreground"></div>
                </div>
              `,
              iconSize: [40, 40],
              iconAnchor: [20, 20],
            })}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold mb-1">Current location</div>
                <div className="text-muted-foreground">
                  Shipment #{shipment.id}
                </div>
                <div className="text-muted-foreground">
                  Status: {formatStatusLabel(shipment.status)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Delivery location marker */}
        {hasDeliveryLocation && shipment.status === "DELIVERED" && (
          <Marker
            position={[
              deliveryAssignment?.deliveredLatitude as number,
              deliveryAssignment?.deliveredLongitude as number,
            ]}
            icon={L.divIcon({
              className: "delivery-location-marker",
              html: `
                <div class="relative">
                  <div class="absolute inset-0 bg-emerald-500 rounded-full opacity-30"></div>
                  <div class="relative w-8 h-8 bg-emerald-500 rounded-full border-2 border-emerald-600 flex items-center justify-center">
                    <div class="w-3 h-3 bg-emerald-100 rounded-full"></div>
                  </div>
                </div>
              `,
              iconSize: [40, 40],
              iconAnchor: [20, 20],
            })}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold mb-1">Delivery location</div>
                <div className="text-muted-foreground">
                  Shipment #{shipment.id}
                </div>
                <div className="text-muted-foreground">
                  Delivered at:{" "}
                  {formatDateTime(
                    deliveryAssignment?.deliveredAt ?? shipment.deliveredAt,
                  )}
                </div>
                {deliveryAssignment?.deliveredAccuracy && (
                  <div className="text-muted-foreground">
                    Accuracy: +/-
                    {Math.round(deliveryAssignment.deliveredAccuracy)}m
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      <style jsx>{`
        .custom-div-icon {
          background: transparent;
          border: none;
        }
        .current-position-marker {
          z-index: 1000 !important;
        }
        .delivery-location-marker {
          z-index: 999 !important;
        }
        :global(.leaflet-popup-content-wrapper) {
          border-radius: 8px;
        }
        :global(.leaflet-popup-content) {
          margin: 0;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

function statusPill(status: ShipmentStatusType) {
  const cls =
    status === "DELIVERED"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
      : status === "CANCELLED" || status === "RETURNED"
        ? "border-rose-500/20 bg-rose-500/10 text-rose-700"
        : status === "OUT_FOR_DELIVERY"
          ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
          : "border-cyan-500/20 bg-cyan-500/10 text-cyan-700";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}


function DashboardCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[28px] border border-border/60 bg-card p-5 shadow-sm backdrop-blur ${className}`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function LogisticsPage() {
  const t = useTranslations("AdminLogistics");

  const [filter, setFilter] = useState<"ALL" | ShipmentStatusType>("ALL");
  const [search, setSearch] = useState("");
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | "ALL">(
    "ALL",
  );
  const [loading, setLoading] = useState(true);
  const [warehousesLoading, setWarehousesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(
    null,
  );

  const statusLabel = (status: "ALL" | ShipmentStatusType) =>
    t(`statuses.${status}`);
  const nextStatusLabel = (status: ShipmentStatusType) =>
    t(`nextStatus.${status}`);

  const loadWarehouses = useCallback(async () => {
    try {
      setWarehousesLoading(true);
      const res = await fetch("/api/warehouses", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.loadWarehouses"));
      setWarehouses(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load warehouses:", e);
    } finally {
      setWarehousesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadShipments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/shipments?page=1&limit=200`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.loadShipments"));
      setShipments(Array.isArray(data?.shipments) ? data.shipments : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadShipments"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadWarehouses();
    loadShipments();
  }, [loadWarehouses, loadShipments]);

  const filteredShipments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return shipments.filter((shipment) => {
      if (filter !== "ALL" && shipment.status !== filter) return false;
      if (
        selectedWarehouse !== "ALL" &&
        shipment.warehouseId !== selectedWarehouse
      )
        return false;
      if (!term) return true;

      const searchFields = [
        shipment.id,
        shipment.orderId,
        shipment.status,
        shipment.courier,
        shipment.courierStatus,
        shipment.trackingNumber,
        shipment.dispatchNote,
        shipment.priority,
        shipment.order?.name,
        shipment.order?.phone_number,
        shipment.order?.status,
        shipment.order?.paymentStatus,
        shipment.assignedTo?.name,
        shipment.assignedTo?.email,
        shipment.warehouse?.name,
        shipment.warehouse?.code,
        shipment.shippingRate?.area,
        shipment.shippingRate?.district,
      ];

      return searchFields.some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term),
      );
    });
  }, [filter, search, selectedWarehouse, shipments]);

  useEffect(() => {
    if (
      selectedShipmentId &&
      !filteredShipments.some((s) => s.id === selectedShipmentId)
    ) {
      setSelectedShipmentId(null);
    }
  }, [filteredShipments, selectedShipmentId]);

  const deliveredCount = filteredShipments.filter(
    (i) => i.status === "DELIVERED",
  ).length;
  const activeCount = filteredShipments.filter(
    (i) =>
      i.status === "IN_TRANSIT" ||
      i.status === "OUT_FOR_DELIVERY" ||
      i.status === "PENDING",
  ).length;
  const atRiskCount = filteredShipments.filter((i) => {
    if (i.status === "DELIVERED" || i.status === "CANCELLED") return false;
    if (!i.expectedDate) return i.status === "PENDING";
    return new Date(i.expectedDate).getTime() < Date.now();
  }).length;
  const assignedCount = filteredShipments.filter((i) => i.assignedTo).length;
  const successRate = filteredShipments.length
    ? Math.round((deliveredCount / filteredShipments.length) * 100)
    : 0;

  const costSummary = useMemo(() => {
    const estimated = filteredShipments.reduce(
      (sum, i) => sum + toAmount(i.estimatedCost),
      0,
    );
    const actual = filteredShipments.reduce(
      (sum, i) => sum + toAmount(i.actualCost),
      0,
    );
    const thirdParty = filteredShipments.reduce(
      (sum, i) => sum + toAmount(i.thirdPartyCost),
      0,
    );
    const handling = filteredShipments.reduce(
      (sum, i) =>
        sum +
        toAmount(i.handlingCost) +
        toAmount(i.packagingCost) +
        toAmount(i.fuelCost),
      0,
    );
    return {
      estimated,
      actual,
      thirdParty,
      handling,
      variance: actual - estimated,
    };
  }, [filteredShipments]);

  const capacityRows = useMemo(() => {
    const weekdays = [
      t("weekdays.mon"),
      t("weekdays.tue"),
      t("weekdays.wed"),
      t("weekdays.thu"),
      t("weekdays.fri"),
    ];
    const total = Math.max(activeCount, 1);
    const base = [0.42, 0.55, 0.78, 0.61, 0.7];

    return weekdays.map((day, index) => {
      const count = Math.min(
        100,
        Math.round(((base[index] * total + index * 3) / total) * 100),
      );
      return { day, count };
    });
  }, [activeCount, t]);

  const priorityShipments = useMemo(() => {
    return [...filteredShipments]
      .sort((a, b) => (b.priority || 0) - (a.priority || 0) || b.id - a.id)
      .slice(0, 4);
  }, [filteredShipments]);

  const latestMovements = useMemo(() => {
    return [...filteredShipments]
      .sort(
        (a, b) =>
          new Date(
            b.deliveredAt || b.outForDeliveryAt || b.pickedAt || b.createdAt,
          ).getTime() -
          new Date(
            a.deliveredAt || a.outForDeliveryAt || a.pickedAt || a.createdAt,
          ).getTime(),
      )
      .slice(0, 3);
  }, [filteredShipments]);

  const selectedShipment = selectedShipmentId
    ? (filteredShipments.find((i) => i.id === selectedShipmentId) ?? null)
    : null;

  const highlightedShipment =
    selectedShipment ||
    priorityShipments[0] ||
    filteredShipments.find((i) => i.status === "OUT_FOR_DELIVERY") ||
    filteredShipments[0];

  const updateShipmentStatus = async (
    shipmentId: number,
    nextStatus: ShipmentStatusType,
  ) => {
    try {
      setUpdatingId(shipmentId);
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.updateShipment"));
      await loadShipments();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.updateShipment"));
    } finally {
      setUpdatingId(null);
    }
  };

  const statusPill = (status: ShipmentStatusType) => {
    const cls =
      status === "DELIVERED"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
        : status === "CANCELLED" || status === "RETURNED"
          ? "border-rose-500/20 bg-rose-500/10 text-rose-700"
          : status === "OUT_FOR_DELIVERY"
            ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
            : "border-cyan-500/20 bg-cyan-500/10 text-cyan-700";

    return (
      <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}
      >
        {statusLabel(status)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full flex-col gap-6 px-4 py-5 md:px-6 md:py-6">
        {/* ============ HERO ============ */}
        <section className="overflow-hidden rounded-[32px] border border-border/60 bg-card p-5 shadow-sm md:p-7">
          <div className="grid gap-6 xl:grid-cols-[1.4fr,0.9fr]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  {t("hero.badge")}
                </span>
                <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                  {t("hero.badgeSecondary")}
                </span>
              </div>

              <div className="mt-4 max-w-3xl">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  {t("hero.title")}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                  {t("hero.description")}
                </p>
              </div>

              <div className="mt-6 grid gap-3 grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[24px] bg-primary px-4 py-4 text-primary-foreground shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-primary-foreground/80">
                    {t("hero.activeShipments")}
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{activeCount}</p>
                  <p className="mt-2 text-sm text-primary-foreground/70">
                    {t("hero.activeShipmentsHint")}
                  </p>
                </div>
                <div className="rounded-[24px] border border-border/60 bg-card px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    {t("hero.successRate")}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-foreground">
                    {successRate}%
                  </p>
                  <p className="mt-2 text-sm text-emerald-600">
                    {t("hero.successRateHint", { count: deliveredCount })}
                  </p>
                </div>
                <div className="rounded-[24px] border border-border/60 bg-card px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    {t("hero.assignedShipments")}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-foreground">
                    {assignedCount}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("hero.assignedShipmentsHint")}
                  </p>
                </div>
                <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-700">
                    {t("hero.attentionRequired")}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-foreground">
                    {atRiskCount}
                  </p>
                  <p className="mt-2 text-sm text-amber-700">
                    {t("hero.attentionRequiredHint")}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-border/60 bg-muted p-5 text-muted-foreground shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground/70">
                    {t("costOverview.subtitle")}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    {t("costOverview.title")}
                  </h2>
                </div>
                <div className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground/70">
                  {t("costOverview.period")}
                </div>
              </div>

              <div className="mt-6 grid gap-3 grid-cols-3">
                <div className="rounded-2xl bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground/55">
                    {t("costOverview.estimated")}
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {formatAmount(costSummary.estimated)}
                  </p>
                </div>
                <div className="rounded-2xl bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground/55">
                    {t("costOverview.actual")}
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {formatAmount(costSummary.actual)}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">
                    {t("costOverview.variance")}
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {formatAmount(costSummary.variance)}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 grid-cols-2">
                <div className="rounded-[24px] bg-card p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-[6px] border-primary border-r-primary/20 border-t-primary/40 text-center">
                      <p className="text-3xl font-semibold leading-none">
                        {successRate}%
                      </p>
                      <p className="mt-1 text-[10px] leading-none uppercase tracking-[0.08em] text-muted-foreground/70">
                        {t("costOverview.delivered")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground/55">
                    {t("costOverview.teamCapacity")}
                  </p>
                  <div className="mt-3 space-y-3">
                    {capacityRows.map((row) => (
                      <div
                        key={row.day}
                        className="grid grid-cols-[32px,1fr,36px] items-center gap-3"
                      >
                        <span className="text-xs text-muted-foreground/55">
                          {row.day}
                        </span>
                        <div className="h-2.5 rounded-full bg-muted">
                          <div
                            className="h-2.5 rounded-full bg-primary"
                            style={{ width: `${row.count}%` }}
                          />
                        </div>
                        <span className="text-right text-xs text-muted-foreground/70">
                          {row.count}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ MONTHLY / PERFORMANCE / CAPACITY ============ */}
        <section className="grid gap-6 xl:grid-cols-[1.05fr,1.05fr,0.9fr]">
          <DashboardCard
            title={t("monthlyTrend.title")}
            subtitle={t("monthlyTrend.subtitle")}
          >
            <div className="flex items-end justify-between gap-2">
              {monthlyOrderBars.map((bar) => (
                <div
                  key={bar.label}
                  className="flex flex-1 flex-col items-center gap-3"
                >
                  <div className="flex h-40 items-end">
                    <div
                      className="w-8 rounded-full bg-primary shadow-sm"
                      style={{ height: `${bar.value}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {t(`months.${bar.label}`)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-muted px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {t("monthlyTrend.projectedDispatch")}
              </span>
              <span className="font-semibold text-emerald-700">
                {t("monthlyTrend.shipmentsCount", {
                  count: filteredShipments.length,
                })}
              </span>
            </div>
          </DashboardCard>

          <DashboardCard
            title={t("performance.title")}
            subtitle={t("performance.subtitle")}
          >
            <div className="grid gap-5 md:grid-cols-[120px,1fr] md:items-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-primary border-r-primary/20 border-t-primary/40">
                <div className="text-center">
                  <p className="text-3xl font-semibold text-foreground">
                    {successRate}%
                  </p>
                  <p className="text-xs uppercase text-muted-foreground">
                    {t("performance.delivered")}
                  </p>
                </div>
              </div>
              <div className="flex items-end gap-2">
                {successBars.map((height, index) => (
                  <div
                    key={`${height}-${index}`}
                    className="flex-1 rounded-full bg-primary"
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-sm">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                {t("performance.deliveredLabel", { count: deliveredCount })}
              </span>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-muted" />
                {t("performance.activeLabel", { count: activeCount })}
              </span>
            </div>
          </DashboardCard>

          <DashboardCard
            title={t("capacity.title")}
            subtitle={t("capacity.subtitle")}
          >
            <div className="space-y-4">
              {capacityRows.map((row, index) => (
                <div
                  key={row.day}
                  className="grid grid-cols-[34px,1fr,42px] items-center gap-3"
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {row.day}
                  </span>
                  <div className="h-3 rounded-full bg-muted">
                    <div
                      className={`h-3 rounded-full ${
                        index % 2 === 0 ? "bg-primary" : "bg-secondary"
                      }`}
                      style={{ width: `${row.count}%` }}
                    />
                  </div>
                  <span className="text-right text-xs font-semibold text-muted-foreground">
                    {row.count}%
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-border/60 bg-muted p-4 text-sm text-muted-foreground">
              {t("capacity.internalHandlingCost")}{" "}
              <span className="font-semibold text-foreground">
                {formatAmount(costSummary.handling)}
              </span>
            </div>
          </DashboardCard>
        </section>

        {/* ============ SHIPMENTS + TRACKING ============ */}
        <section className="flex flex-col gap-6 lg:grid lg:grid-cols-2 xl:grid-cols-[1.1fr,1fr]">
          {/* LEFT */}
          <DashboardCard
            title={t("operations.title")}
            subtitle={t("operations.subtitle")}
          >
            <div className="flex flex-col gap-4">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("operations.searchPlaceholder")}
                    className="h-11 w-full rounded-full border border-border bg-background pl-11 pr-4 text-sm text-foreground outline-none transition-all duration-200 focus:border-primary focus:ring-1 focus:ring-primary sm:h-12 sm:text-base"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
                  <select
                    value={filter}
                    onChange={(e) =>
                      setFilter(e.target.value as "ALL" | ShipmentStatusType)
                    }
                    className="h-11 rounded-full border border-border bg-background px-4 text-sm text-foreground outline-none transition-all duration-200 focus:border-primary focus:ring-1 focus:ring-primary sm:h-12"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedWarehouse}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedWarehouse(
                        value === "ALL" ? "ALL" : Number(value),
                      );
                    }}
                    className="h-11 rounded-full border border-border bg-background px-4 text-sm text-foreground outline-none transition-all duration-200 focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 sm:h-12"
                    disabled={warehousesLoading}
                  >
                    <option value="ALL">
                      {warehousesLoading
                        ? t("operations.loadingWarehouses")
                        : t("operations.allWarehouses")}
                    </option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="max-h-[500px] overflow-y-auto overscroll-contain">
                {loading ? (
                  <ShipmentsSkeleton />
                ) : !filteredShipments.length ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center">
                    <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-3 text-base font-medium text-foreground">
                      {t("operations.emptyTitle")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("operations.emptyHint")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredShipments.map((shipment) => {
                      const nextStatuses =
                        NEXT_STATUS_MAP[shipment.status] || [];
                      const isSelected = shipment.id === selectedShipmentId;

                      return (
                        <article
                          key={shipment.id}
                          className={`group cursor-pointer rounded-2xl border bg-card p-4 transition-all duration-200 hover:shadow-md ${
                            isSelected
                              ? "border-primary shadow-sm ring-1 ring-primary/20"
                              : "border-border/60 hover:border-primary/30"
                          }`}
                          onClick={() => setSelectedShipmentId(shipment.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedShipmentId(shipment.id);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                        >
                          {/* Mobile */}
                          <div className="block lg:hidden">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {statusPill(shipment.status)}
                                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                  {shipment.courier}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                #{shipment.id}
                              </span>
                            </div>

                            <div className="space-y-2">
                              <div>
                                <p className="text-sm font-semibold text-foreground">
                                  {t("operations.orderLabel", {
                                    id: shipment.orderId,
                                  })}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {shipment.order?.name ||
                                    t("operations.customerNotAvailable")}
                                </p>
                              </div>

                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {t("operations.assignedToLabel")}
                                </span>
                                <span className="font-medium text-foreground">
                                  {shipment.assignedTo?.name ||
                                    t("operations.notAssigned")}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {t("operations.priorityLabel")}
                                </span>
                                <span className="font-medium text-foreground">
                                  P{shipment.priority || 0}
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {nextStatuses.slice(0, 2).map((nextStatus) => (
                                  <button
                                    key={nextStatus}
                                    type="button"
                                    disabled={updatingId === shipment.id}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateShipmentStatus(
                                        shipment.id,
                                        nextStatus,
                                      );
                                    }}
                                    className="flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {updatingId === shipment.id
                                      ? "..."
                                      : nextStatusLabel(nextStatus)}
                                  </button>
                                ))}
                                {shipment.trackingUrl && (
                                  <a
                                    href={shipment.trackingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                    className="flex-1 rounded-full bg-primary px-3 py-1.5 text-center text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                                  >
                                    {t("operations.trackButton")}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Desktop */}
                          <div className="hidden lg:block">
                            <div className="flex flex-col gap-4">
                              <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div>
                                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                    {t("operations.columns.shipment")}
                                  </p>
                                  <p className="mt-1.5 text-sm font-semibold text-foreground">
                                    {t("operations.shipmentLabel", {
                                      id: shipment.id,
                                    })}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {t("operations.orderLabel", {
                                      id: shipment.orderId,
                                    })}
                                  </p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {shipment.order?.name ||
                                      t("operations.customerNotAvailable")}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {shipment.trackingNumber ||
                                      t("operations.noTrackingNumber")}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                    {t("operations.columns.management")}
                                  </p>
                                  <p className="mt-1.5 text-sm font-medium text-foreground">
                                    {shipment.assignedTo?.name ||
                                      t("operations.notAssigned")}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {t("operations.warehouseLabel", {
                                      id: shipment.warehouseId || "-",
                                    })}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {t("operations.priorityShort", {
                                      value: shipment.priority || 0,
                                    })}
                                  </p>
                                  <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                                    {shipment.dispatchNote ||
                                      t("operations.noDispatchNotes")}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                    {t("operations.columns.cost")}
                                  </p>
                                  <p className="mt-1.5 text-sm text-muted-foreground">
                                    {t("operations.costEst", {
                                      value: formatAmount(
                                        toAmount(shipment.estimatedCost),
                                      ),
                                    })}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {t("operations.costActual", {
                                      value: formatAmount(
                                        toAmount(shipment.actualCost),
                                      ),
                                    })}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {t("operations.costInternal", {
                                      value: formatAmount(
                                        toAmount(shipment.handlingCost) +
                                          toAmount(shipment.packagingCost) +
                                          toAmount(shipment.fuelCost),
                                      ),
                                    })}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                    {t("operations.columns.timeline")}
                                  </p>
                                  <p className="mt-1.5 text-sm text-muted-foreground">
                                    {t("operations.timelineAssigned", {
                                      date: formatShortDate(
                                        shipment.assignedAt,
                                        t("operations.notScheduled"),
                                      ),
                                    })}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {t("operations.timelineExpected", {
                                      date: formatShortDate(
                                        shipment.expectedDate,
                                        t("operations.notScheduled"),
                                      ),
                                    })}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {t("operations.timelineDelivered", {
                                      date: formatShortDate(
                                        shipment.deliveredAt,
                                        t("operations.notScheduled"),
                                      ),
                                    })}
                                  </p>
                                </div>
                              </div>

                              <div className="min-w-[240px]">
                                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                                  {statusPill(shipment.status)}
                                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                    {shipment.courier}
                                    {shipment.courierStatus &&
                                      ` - ${shipment.courierStatus}`}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2 xl:justify-end">
                                  {nextStatuses.length ? (
                                    nextStatuses.map((nextStatus) => (
                                      <button
                                        key={nextStatus}
                                        type="button"
                                        disabled={updatingId === shipment.id}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          updateShipmentStatus(
                                            shipment.id,
                                            nextStatus,
                                          );
                                        }}
                                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {updatingId === shipment.id
                                          ? t("operations.updating")
                                          : nextStatusLabel(nextStatus)}
                                      </button>
                                    ))
                                  ) : (
                                    <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                      {t("operations.noFurtherAction")}
                                    </span>
                                  )}

                                  {shipment.trackingUrl && (
                                    <a
                                      href={shipment.trackingUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
                                      className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
                                    >
                                      {t("operations.openTracking")}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </DashboardCard>

          {/* RIGHT */}
          <DashboardCard
            title={t("trackingPanel.title")}
            subtitle={
              selectedWarehouse === "ALL"
                ? t("trackingPanel.warehouseSubtitle")
                : t("trackingPanel.detailedSubtitle")
            }
          >
            <div className="max-h-[600px] overflow-y-auto overscroll-contain">
              {selectedWarehouse === "ALL" ? (
                <div className="space-y-4">
                  <div className="min-h-[300px] rounded-xl bg-muted/30">
                    <MultiShipmentsMap shipments={filteredShipments} />
                  </div>
                  <div className="rounded-lg bg-muted/20 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {t("trackingPanel.warehouseActivity")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("trackingPanel.showingActive", {
                            count: filteredShipments.length,
                          })}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("trackingPanel.selectWarehouseHint")}
                      </p>
                    </div>
                  </div>
                </div>
              ) : highlightedShipment ? (
                <div className="space-y-5">
                  <div className="min-h-[280px] rounded-xl bg-muted/30">
                    <ShipmentTrackingMap shipment={highlightedShipment} />
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        {t("trackingPanel.reference")}
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        #
                        {highlightedShipment.trackingNumber ||
                          highlightedShipment.id}
                      </p>
                      <p className="text-base font-semibold text-foreground">
                        {highlightedShipment.order?.name ||
                          t("trackingPanel.customerShipment")}
                      </p>
                      {typeof selectedWarehouse === "number" && (
                        <p className="text-sm text-muted-foreground">
                          {t("trackingPanel.warehouse", {
                            name:
                              highlightedShipment.warehouse?.name ||
                              `ID: ${highlightedShipment.warehouseId}`,
                          })}
                        </p>
                      )}
                    </div>
                    <div>{statusPill(highlightedShipment.status)}</div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground">
                      {t("trackingPanel.timelineTitle")}
                    </h4>
                    <div className="space-y-4">
                      {[
                        {
                          label: t("trackingPanel.timelinePickedUp"),
                          value: formatDateTime(highlightedShipment.pickedAt),
                          tone: "bg-amber-500",
                        },
                        {
                          label: t("trackingPanel.timelineInTransit"),
                          value: formatDateTime(
                            highlightedShipment.outForDeliveryAt ||
                              highlightedShipment.assignedAt,
                          ),
                          tone: "bg-cyan-500",
                        },
                        {
                          label: t("trackingPanel.timelineDelivered"),
                          value: formatDateTime(
                            highlightedShipment.deliveredAt,
                          ),
                          tone: "bg-emerald-500",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex gap-3 rounded-lg border border-border/50 p-3 transition hover:bg-muted/10"
                        >
                          <div className="flex-shrink-0">
                            <div
                              className={`h-3 w-3 rounded-full ${item.tone} mt-1`}
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {item.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {highlightedShipment.dispatchNote ||
                                t("trackingPanel.timelineNote")}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-xs font-medium text-muted-foreground">
                              {item.value || t("trackingPanel.pending")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center">
                  <MapPin className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-3 text-base font-medium text-foreground">
                    {t("trackingPanel.noShipmentSelected")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {typeof selectedWarehouse === "number"
                      ? t("trackingPanel.noShipmentsForWarehouse")
                      : t("trackingPanel.selectWarehouseToView")}
                  </p>
                </div>
              )}
            </div>
          </DashboardCard>
        </section>

        {/* ============ PRIORITY + SUMMARY ============ */}
        <section className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
          <DashboardCard
            title={t("priority.title")}
            subtitle={t("priority.subtitle")}
          >
            <div className="grid gap-5 lg:grid-cols-[1fr,240px]">
              <div>
                <div className="flex flex-wrap items-end justify-between gap-3 rounded-[24px] bg-muted px-5 py-5 text-muted-foreground">
                  <div>
                    <p className="text-sm text-muted-foreground/70">
                      {t("priority.activeWorkload")}
                    </p>
                    <p className="mt-2 text-4xl font-semibold">{activeCount}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground/50">
                      {t("priority.atRisk")}
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{atRiskCount}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {priorityShipments.length ? (
                    priorityShipments.map((shipment) => (
                      <div
                        key={shipment.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-border/60 bg-muted px-4 py-4"
                      >
                        <div>
                          <p className="font-semibold text-foreground">
                            {shipment.courier || t("priority.courierPending")}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t("priority.orderLine", {
                              id: shipment.orderId,
                              name:
                                shipment.order?.name ||
                                t("priority.customerNotAvailable"),
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                            {t("priority.eta")}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {formatShortDate(
                              shipment.expectedDate,
                              t("operations.notScheduled"),
                            )}
                          </p>
                        </div>
                        <div>{statusPill(shipment.status)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-border/60 bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
                      {t("priority.empty")}
                    </div>
                  )}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[28px] bg-primary p-5 text-primary-foreground">
                <div className="absolute -right-10 bottom-3 h-36 w-36 rounded-full bg-primary-foreground/10 blur-2xl" />
                <div className="absolute left-8 top-8 h-20 w-20 rounded-full bg-primary-foreground/10 blur-xl" />
                <div className="relative">
                  <p className="text-xs uppercase tracking-[0.24em] text-primary-foreground/70">
                    {t("priority.featuredShipment")}
                  </p>
                  <div className="mt-6 rounded-[24px] border border-border/60 bg-primary/40 px-4 py-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-primary-foreground/80">
                        {t("priority.priorityLevel")}
                      </span>
                      <span className="rounded-full bg-primary/40 px-3 py-1 text-xs border border-border/60">
                        P{highlightedShipment?.priority || 0}
                      </span>
                    </div>
                    <p className="mt-6 text-3xl font-semibold">
                      {highlightedShipment?.courier || t("priority.dispatch")}
                    </p>
                    <p className="mt-2 text-sm text-primary-foreground/80">
                      {highlightedShipment?.trackingNumber ||
                        t("priority.trackingNotAssigned")}
                    </p>
                    <div className="mt-8 flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-primary-foreground border border-border/60" />
                      <span className="text-sm text-primary-foreground/80">
                        {highlightedShipment?.assignedTo?.name ||
                          t("priority.assignmentPending")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard
            title={t("summary.title")}
            subtitle={t("summary.subtitle")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  {t("summary.thirdPartyCost")}
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {formatAmount(costSummary.thirdParty)}
                </p>
              </div>
              <div className="rounded-[22px] bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  {t("summary.actualSpend")}
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {formatAmount(costSummary.actual)}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {latestMovements.length ? (
                latestMovements.map((shipment) => (
                  <div
                    key={shipment.id}
                    className="flex items-center justify-between gap-3 rounded-[20px] border border-border/60 bg-muted px-4 py-4"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {t("summary.shipmentLine", {
                          shipmentId: shipment.id,
                          orderId: shipment.orderId,
                        })}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("summary.courierAssignee", {
                          courier: shipment.courier,
                          assignee:
                            shipment.assignedTo?.name ||
                            t("operations.notAssigned"),
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {formatShortDate(
                          shipment.deliveredAt ||
                            shipment.outForDeliveryAt ||
                            shipment.pickedAt ||
                            shipment.createdAt,
                          t("operations.notScheduled"),
                        )}
                      </p>
                      <div className="mt-2">{statusPill(shipment.status)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-border/60 bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
                  {t("summary.empty")}
                </div>
              )}
            </div>
          </DashboardCard>
        </section>
      </div>
    </div>
  );
}
