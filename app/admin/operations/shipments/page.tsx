"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import ShipmentCreateForm from "@/components/admin/shipments/ShipmentCreateForm";
import {
  AssignDeliveryManModal,
  type DeliveryManAssignmentOption,
} from "@/components/admin/shipments/AssignDeliveryManModal";
import { AssignmentStatusBadge } from "@/components/delivery/AssignmentStatusBadge";
import { StatusTimeline } from "@/components/delivery/StatusTimeline";
import type { ShipmentDeliveryAssignmentSummary } from "@/components/delivery/types";
import ShipmentsSkeleton from "@/components/ui/ShipmentsSkeleton";

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
  warehouseId: number | null;
  courier: string;
  status: ShipmentStatusType;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  courierStatus?: string | null;
  lastSyncedAt?: string | null;
  expectedDate?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  order?: {
    id: number;
    name: string;
    phone_number: string;
    status: string;
    paymentStatus: string;
  };
  deliveryAssignments?: ShipmentDeliveryAssignmentSummary[];
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
  ASSIGNED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: [
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "FAILED",
    "RETURNED",
    "CANCELLED",
  ],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED", "RETURNED", "CANCELLED"],
  DELIVERED: [],
  FAILED: ["ASSIGNED", "CANCELLED"],
  RETURNED: [],
  CANCELLED: [],
};

interface ShipmentsQueryState {
  filter: "ALL" | ShipmentStatusType;
  search: string;
}

const shipmentsCache = new Map<"ALL" | ShipmentStatusType, ShipmentRow[]>();
let lastShipmentsQueryState: ShipmentsQueryState = {
  filter: "ALL",
  search: "",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shipmentStatusPill(status: ShipmentStatusType) {
  const className =
    status === "DELIVERED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "FAILED" || status === "CANCELLED" || status === "RETURNED"
        ? "border-red-200 bg-red-50 text-red-700"
        : status === "ASSIGNED"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-amber-200 bg-amber-50 text-amber-700";

  return (status: ShipmentStatusType, label: string) => (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

export default function AdminShipmentsPage() {
  const t = useTranslations("AdminShipmentsPage");

  const [filter, setFilter] = useState<"ALL" | ShipmentStatusType>(
    lastShipmentsQueryState.filter,
  );
  const [search, setSearch] = useState(lastShipmentsQueryState.search);
  const [shipments, setShipments] = useState<ShipmentRow[]>(
    () => shipmentsCache.get(lastShipmentsQueryState.filter) ?? [],
  );
  const [loading, setLoading] = useState(
    () => !shipmentsCache.has(lastShipmentsQueryState.filter),
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<number[]>([]);
  const [deliveryMen, setDeliveryMen] = useState<DeliveryManAssignmentOption[]>(
    [],
  );
  const [loadingDeliveryMen, setLoadingDeliveryMen] = useState(true);
  const [expandedShipments, setExpandedShipments] = useState<Set<number>>(
    new Set(),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const statusLabel = (status: ShipmentStatusType) =>
    t(`shipmentStatus.${status}`);

  const toggleShipmentExpansion = (shipmentId: number) => {
    setExpandedShipments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(shipmentId)) {
        newSet.delete(shipmentId);
      } else {
        newSet.add(shipmentId);
      }
      return newSet;
    });
  };

  const loadShipments = useCallback(
    async (force = false, page = currentPage) => {
      lastShipmentsQueryState = {
        filter,
        search: lastShipmentsQueryState.search,
      };

      try {
        setLoading(true);
        setError(null);
        const query = filter === "ALL" ? "" : `&status=${filter}`;
        const res = await fetch(
          `/api/shipments?page=${page}&limit=${itemsPerPage}${query}`,
          { cache: "no-store" },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || t("errors.loadFailed"));
        const nextShipments = Array.isArray(data?.shipments)
          ? data.shipments
          : [];
        setShipments(nextShipments);
        const nextPages = Number(data?.pagination?.pages);
        const nextTotal = Number(data?.pagination?.total);
        setTotalPages(
          Number.isFinite(nextPages) && nextPages > 0 ? nextPages : 1,
        );
        setTotalItems(
          Number.isFinite(nextTotal) && nextTotal >= 0 ? nextTotal : 0,
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("errors.loadFailed"),
        );
      } finally {
        setLoading(false);
      }
    },
    [filter, currentPage, itemsPerPage, t],
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadShipments(false, page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) handlePageChange(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) handlePageChange(currentPage + 1);
  };

  const handleLastPage = () => {
    if (currentPage < totalPages) handlePageChange(totalPages);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleFilterChange = (newFilter: "ALL" | ShipmentStatusType) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setCurrentPage(1);
  };

  const loadDeliveryMen = useCallback(async () => {
    try {
      setLoadingDeliveryMen(true);
      const response = await fetch(
        "/api/delivery-men?status=ACTIVE&limit=200",
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t("errors.loadDeliveryMenFailed"));
      }

      const nextDeliveryMen = Array.isArray(payload.data?.deliveryMen)
        ? payload.data.deliveryMen
        : [];

      setDeliveryMen(
        nextDeliveryMen.map((deliveryMan: any) => ({
          id: deliveryMan.id,
          fullName: deliveryMan.fullName,
          phone: deliveryMan.phone,
          employeeCode: deliveryMan.employeeCode ?? null,
          warehouse: deliveryMan.warehouse
            ? {
                id: deliveryMan.warehouse.id,
                name: deliveryMan.warehouse.name,
                code: deliveryMan.warehouse.code,
              }
            : null,
        })),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("errors.loadDeliveryMenFailed"),
      );
    } finally {
      setLoadingDeliveryMen(false);
    }
  }, [t]);

  useEffect(() => {
    void loadShipments();
  }, [loadShipments]);

  useEffect(() => {
    void loadDeliveryMen();
  }, [loadDeliveryMen]);

  useEffect(() => {
    lastShipmentsQueryState = {
      ...lastShipmentsQueryState,
      search,
    };
  }, [search]);

  const filteredShipments = useMemo(() => {
    if (!search.trim()) return shipments;
    const term = search.toLowerCase();
    return shipments.filter((shipment) => {
      return (
        String(shipment.id).includes(term) ||
        String(shipment.orderId).includes(term) ||
        (shipment.trackingNumber || "").toLowerCase().includes(term) ||
        (shipment.courier || "").toLowerCase().includes(term) ||
        (shipment.order?.name || "").toLowerCase().includes(term)
      );
    });
  }, [shipments, search]);

  const selectedShipments = useMemo(
    () =>
      filteredShipments.filter((shipment) =>
        selectedShipmentIds.includes(shipment.id),
      ),
    [filteredShipments, selectedShipmentIds],
  );

  const allVisibleSelected =
    filteredShipments.length > 0 &&
    filteredShipments.every((shipment) =>
      selectedShipmentIds.includes(shipment.id),
    );

  const shipmentStats = useMemo(() => {
    const total = shipments.length;
    const pending = shipments.filter(
      (shipment) =>
        shipment.status === "PENDING" || shipment.status === "ASSIGNED",
    ).length;
    const inTransit = shipments.filter(
      (shipment) =>
        shipment.status === "IN_TRANSIT" ||
        shipment.status === "OUT_FOR_DELIVERY",
    ).length;
    const delivered = shipments.filter(
      (shipment) => shipment.status === "DELIVERED",
    ).length;
    return { total, pending, inTransit, delivered };
  }, [shipments]);

  async function updateShipmentStatus(
    shipmentId: number,
    nextStatus: ShipmentStatusType,
  ) {
    try {
      setUpdatingId(shipmentId);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || t("errors.updateFailed"));
      }

      setNotice(
        t("notices.statusUpdated", {
          id: shipmentId,
          status: statusLabel(nextStatus).toLowerCase(),
        }),
      );
      shipmentsCache.clear();
      await loadShipments(true);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : t("errors.updateFailed"),
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function toggleShipmentSelection(shipmentId: number) {
    setSelectedShipmentIds((current) =>
      current.includes(shipmentId)
        ? current.filter((id) => id !== shipmentId)
        : [...current, shipmentId],
    );
  }

  function toggleSelectAllVisible() {
    setSelectedShipmentIds((current) => {
      if (allVisibleSelected) {
        return current.filter(
          (shipmentId) =>
            !filteredShipments.some((shipment) => shipment.id === shipmentId),
        );
      }
      const nextIds = new Set(current);
      filteredShipments.forEach((shipment) => nextIds.add(shipment.id));
      return [...nextIds];
    });
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 overflow-x-hidden">
      <div className="space-y-6">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {t("hero.badge")}
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">
                {t("hero.title")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {t("hero.description")}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {selectedShipmentIds.length ? (
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(true)}
                  className="btn-outline rounded-xl px-4 py-3 text-sm font-medium"
                >
                  {t("actions.assignSelected", {
                    count: selectedShipmentIds.length,
                  })}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="btn-primary rounded-xl px-4 py-3 text-sm font-medium"
              >
                {t("actions.createShipment")}
              </button>
            </div>
          </div>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label={t("stats.totalShipments")}
            value={shipmentStats.total}
          />
          <SummaryCard
            label={t("stats.pendingAssigned")}
            value={shipmentStats.pending}
          />
          <SummaryCard
            label={t("stats.inTransit")}
            value={shipmentStats.inTransit}
          />
          <SummaryCard
            label={t("stats.delivered")}
            value={shipmentStats.delivered}
          />
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="btn-outline rounded-xl px-4 py-2 text-sm font-medium"
              >
                {allVisibleSelected
                  ? t("actions.unselectVisible")
                  : t("actions.selectVisible")}
              </button>
              <input
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                className="input-theme min-w-[280px] rounded-xl border border-border bg-background px-4 py-3 text-sm"
              />
              <select
                value={filter}
                onChange={(event) =>
                  handleFilterChange(
                    event.target.value as "ALL" | ShipmentStatusType,
                  )
                }
                className="input-theme rounded-xl border border-border bg-background px-4 py-3 text-sm"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === "ALL"
                      ? t("status.ALL")
                      : statusLabel(status as ShipmentStatusType)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <select
                value={itemsPerPage}
                onChange={(e) =>
                  handleItemsPerPageChange(Number(e.target.value))
                }
                className="input-theme rounded-xl border border-border bg-background px-3 py-3 text-sm"
              >
                {[5, 10, 20, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {t("pagination.perPage", { count: n })}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  shipmentsCache.clear();
                  void loadShipments(true);
                }}
                className="btn-outline rounded-xl px-4 py-3 text-sm font-medium"
              >
                {t("actions.refresh")}
              </button>
            </div>
          </div>
        </section>

        {loading || loadingDeliveryMen ? (
          <ShipmentsSkeleton />
        ) : filteredShipments.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <p className="text-lg font-medium text-foreground">
              {t("empty.title")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredShipments.map((shipment) => {
              const currentAssignment =
                shipment.deliveryAssignments?.[0] ?? null;
              const nextStatuses = NEXT_STATUS_MAP[shipment.status] ?? [];
              const selected = selectedShipmentIds.includes(shipment.id);

              return (
                <article
                  key={shipment.id}
                  className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden"
                >
                  <div
                    className="flex cursor-pointer items-center justify-between p-5 hover:bg-muted/30 transition-colors"
                    onClick={() => toggleShipmentExpansion(shipment.id)}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleShipmentSelection(shipment.id);
                        }}
                        className="mt-1 h-4 w-4 rounded border-border"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold text-foreground">
                            {t("card.shipmentTitle", { id: shipment.id })}
                          </h2>
                          {shipmentStatusPill(shipment.status)(
                            shipment.status,
                            statusLabel(shipment.status),
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t("card.metaLine", {
                            orderId: shipment.orderId,
                            customer:
                              shipment.order?.name || t("card.unknownCustomer"),
                            date: formatDateTime(shipment.createdAt),
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedShipmentIds([shipment.id]);
                            setAssignModalOpen(true);
                          }}
                          className="btn-outline rounded-xl px-4 py-2 text-sm font-medium"
                        >
                          {currentAssignment
                            ? t("actions.reassign")
                            : t("actions.assignDeliveryMan")}
                        </button>
                        <a
                          href="/admin/operations/orders"
                          className="btn-outline rounded-xl px-4 py-2 text-sm font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t("actions.openOrders")}
                        </a>
                      </div>
                      <ChevronRight
                        className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                          expandedShipments.has(shipment.id) ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                  </div>

                  {expandedShipments.has(shipment.id) && (
                    <div className="border-t border-border bg-gradient-to-b from-muted/10 to-transparent animate-in slide-in-from-top-2 duration-200">
                      <div className="p-5 pt-6">
                        <div className="grid gap-4 xl:grid-cols-[0.95fr_0.95fr_1.1fr]">
                          <section className="rounded-2xl border border-border bg-background p-4">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              {t("sections.orderAndCourier")}
                            </h3>
                            <div className="mt-4 space-y-2 text-sm">
                              <p className="font-medium text-foreground">
                                {shipment.order?.name ||
                                  t("card.unknownCustomer")}
                              </p>
                              <p className="text-muted-foreground">
                                {shipment.order?.phone_number ||
                                  t("card.noPhone")}
                              </p>
                              <p className="text-muted-foreground">
                                {t("labels.courier")}: {shipment.courier || "-"}
                              </p>
                              <p className="text-muted-foreground">
                                {t("labels.tracking")}:{" "}
                                {shipment.trackingNumber ||
                                  t("labels.notAvailable")}
                              </p>
                              <p className="text-muted-foreground">
                                {t("labels.orderStatus")}:{" "}
                                {shipment.order?.status || "-"}
                              </p>
                            </div>
                          </section>

                          <section className="rounded-2xl border border-border bg-background p-4">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              {t("sections.deliveryAssignment")}
                            </h3>
                            {currentAssignment ? (
                              <div className="mt-4 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <AssignmentStatusBadge
                                    status={currentAssignment.status}
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {formatDateTime(
                                      currentAssignment.assignedAt,
                                    )}
                                  </span>
                                </div>
                                <div className="text-sm">
                                  <p className="font-medium text-foreground">
                                    {currentAssignment.deliveryMan.fullName}
                                  </p>
                                  <p className="text-muted-foreground">
                                    {currentAssignment.deliveryMan.phone}
                                    {currentAssignment.deliveryMan.employeeCode
                                      ? ` · ${currentAssignment.deliveryMan.employeeCode}`
                                      : ""}
                                  </p>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {t("labels.pickupProof")}:{" "}
                                  {currentAssignment.pickupProof?.confirmedAt
                                    ? t("labels.pickupSubmitted", {
                                        date: formatDateTime(
                                          currentAssignment.pickupProof
                                            .confirmedAt,
                                        ),
                                      })
                                    : t("labels.pickupPending")}
                                </p>
                                {currentAssignment.rejectionReason ? (
                                  <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {t("labels.rejected", {
                                      reason: currentAssignment.rejectionReason,
                                    })}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                                {t("empty.noAssignment")}
                              </div>
                            )}
                          </section>

                          <section className="rounded-2xl border border-border bg-background p-4">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                {t("sections.shipmentActions")}
                              </h3>
                              {shipment.trackingUrl ? (
                                <a
                                  href={shipment.trackingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-medium text-primary underline"
                                >
                                  {t("actions.openTracking")}
                                </a>
                              ) : null}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {nextStatuses.length ? (
                                nextStatuses.map((nextStatus) => (
                                  <button
                                    key={nextStatus}
                                    type="button"
                                    disabled={updatingId === shipment.id}
                                    onClick={() =>
                                      void updateShipmentStatus(
                                        shipment.id,
                                        nextStatus,
                                      )
                                    }
                                    className="btn-outline rounded-full px-3 py-2 text-xs font-medium disabled:opacity-60"
                                  >
                                    {updatingId === shipment.id
                                      ? t("actions.updating")
                                      : t("actions.markStatus", {
                                          status: statusLabel(nextStatus),
                                        })}
                                  </button>
                                ))
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {t("empty.noShipmentActions")}
                                </span>
                              )}
                            </div>
                          </section>
                        </div>
                      </div>

                      {currentAssignment?.logs?.length ? (
                        <section className="mt-5 space-y-3">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            {t("sections.recentHistory")}
                          </h3>
                          <StatusTimeline
                            logs={currentAssignment.logs}
                            compact
                          />
                        </section>
                      ) : null}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {t("pagination.showing", {
                start: (currentPage - 1) * itemsPerPage + 1,
                end: Math.min(currentPage * itemsPerPage, totalItems),
                total: totalItems,
              })}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="btn-outline rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("pagination.previous")}
              </button>

              <div className="flex items-center gap-1">
                {(() => {
                  const pages = [];
                  if (totalPages <= 5) {
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => handlePageChange(i)}
                          className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                            currentPage === i
                              ? "bg-primary text-primary-foreground"
                              : "btn-outline hover:bg-muted"
                          }`}
                        >
                          {i}
                        </button>,
                      );
                    }
                  } else {
                    pages.push(
                      <button
                        key={1}
                        onClick={() => handlePageChange(1)}
                        className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                          currentPage === 1
                            ? "bg-primary text-primary-foreground"
                            : "btn-outline hover:bg-muted"
                        }`}
                      >
                        1
                      </button>,
                    );

                    if (currentPage <= 3) {
                      for (let i = 2; i <= 4; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => handlePageChange(i)}
                            className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                              currentPage === i
                                ? "bg-primary text-primary-foreground"
                                : "btn-outline hover:bg-muted"
                            }`}
                          >
                            {i}
                          </button>,
                        );
                      }
                      pages.push(
                        <span
                          key="ellipsis-end"
                          className="px-2 text-muted-foreground"
                        >
                          ...
                        </span>,
                      );
                    } else if (currentPage >= totalPages - 2) {
                      pages.push(
                        <span
                          key="ellipsis-start"
                          className="px-2 text-muted-foreground"
                        >
                          ...
                        </span>,
                      );
                      for (let i = totalPages - 3; i <= totalPages - 1; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => handlePageChange(i)}
                            className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                              currentPage === i
                                ? "bg-primary text-primary-foreground"
                                : "btn-outline hover:bg-muted"
                            }`}
                          >
                            {i}
                          </button>,
                        );
                      }
                    } else {
                      pages.push(
                        <span
                          key="ellipsis-start"
                          className="px-2 text-muted-foreground"
                        >
                          ...
                        </span>,
                      );
                      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => handlePageChange(i)}
                            className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                              currentPage === i
                                ? "bg-primary text-primary-foreground"
                                : "btn-outline hover:bg-muted"
                            }`}
                          >
                            {i}
                          </button>,
                        );
                      }
                      pages.push(
                        <span
                          key="ellipsis-end"
                          className="px-2 text-muted-foreground"
                        >
                          ...
                        </span>,
                      );
                    }

                    pages.push(
                      <button
                        key={totalPages}
                        onClick={() => handlePageChange(totalPages)}
                        className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                          currentPage === totalPages
                            ? "bg-primary text-primary-foreground"
                            : "btn-outline hover:bg-muted"
                        }`}
                      >
                        {totalPages}
                      </button>,
                    );
                  }
                  return pages;
                })()}
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="btn-outline rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("pagination.next")}
              </button>

              <button
                onClick={handleLastPage}
                disabled={currentPage === totalPages}
                className="btn-outline rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("pagination.lastPage")}
              </button>
            </div>
          </div>
        )}
      </div>

      {createModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl">
            <ShipmentCreateForm
              onCreated={async () => {
                shipmentsCache.clear();
                await loadShipments(true);
                setCreateModalOpen(false);
                setNotice(t("notices.created"));
              }}
              onClose={() => setCreateModalOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <AssignDeliveryManModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        shipments={selectedShipments.map((shipment) => ({
          id: shipment.id,
          orderId: shipment.orderId,
          courier: shipment.courier,
          warehouseId: shipment.warehouseId,
        }))}
        deliveryMen={deliveryMen}
        onAssigned={async (message) => {
          setNotice(message);
          setSelectedShipmentIds([]);
          shipmentsCache.clear();
          await loadShipments(true);
        }}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
    </article>
  );
}
