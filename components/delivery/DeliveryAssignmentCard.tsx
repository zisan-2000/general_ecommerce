"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AssignmentStatusBadge } from "@/components/delivery/AssignmentStatusBadge";
import { PickupConfirmationModal } from "@/components/delivery/PickupConfirmationModal";
import { RejectAssignmentModal } from "@/components/delivery/RejectAssignmentModal";
import { StatusTimeline } from "@/components/delivery/StatusTimeline";
import type {
  DeliveryAssignmentData,
  DeliveryAssignmentStatusValue,
} from "@/components/delivery/types";

const STATUS_ACTIONS: Partial<
  Record<DeliveryAssignmentStatusValue, DeliveryAssignmentStatusValue[]>
> = {
  PICKUP_CONFIRMED: [
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "FAILED",
    "RETURNED",
  ],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED", "RETURNED"],
};

export function DeliveryAssignmentCard({
  assignment,
  onChanged,
}: {
  assignment: DeliveryAssignmentData;
  onChanged: (message: string) => Promise<void> | void;
}) {
  const t = useTranslations("AdminDeliveryAssignmentCard");

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pickupOpen, setPickupOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const canViewDetails = assignment.status !== "ASSIGNED";
  const nextStatusActions = STATUS_ACTIONS[assignment.status] ?? [];

  function formatDateTime(value?: string | null) {
    if (!value) return t("notUpdated");
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatCurrency(value: string | number, currency = "BDT") {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return String(value);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function formatStatusLabel(status: DeliveryAssignmentStatusValue) {
    return t(`statuses.${status}`);
  }

  async function runAction(
    url: string,
    body: Record<string, unknown> | undefined,
    fallbackMessage: string,
  ) {
    try {
      setLoadingAction(url);
      setError("");

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || fallbackMessage);
      }

      await onChanged(payload.message || fallbackMessage);
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : fallbackMessage,
      );
    } finally {
      setLoadingAction(null);
    }
  }

  async function runActionWithLocation(
    url: string,
    body: Record<string, unknown> | undefined,
    fallbackMessage: string,
  ) {
    try {
      setLoadingAction(url);
      setError("");

      if (
        body &&
        typeof body === "object" &&
        "status" in body &&
        body.status === "DELIVERED"
      ) {
        let position: GeolocationPosition;

        const permission = await navigator.permissions.query({
          name: "geolocation",
        });

        if (permission.state === "granted") {
          position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 300000,
            });
          });
        } else if (permission.state === "denied") {
          throw new Error(t("errors.locationDenied"));
        } else {
          position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            });
          });
        }

        body = {
          ...body,
          deliveredLocation: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
        };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || fallbackMessage);
      }

      await onChanged(payload.message || fallbackMessage);
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : fallbackMessage,
      );
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <>
      <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {t("orderLabel", { id: assignment.order.id })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("shipmentLabel", { id: assignment.shipment.id })}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {assignment.order.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {assignment.warehouse.name} ({assignment.warehouse.code}) ·{" "}
              {assignment.shipment.courier}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
            <AssignmentStatusBadge status={assignment.status} />
            <p className="text-xs text-muted-foreground">
              {t("assignedAt", { date: formatDateTime(assignment.assignedAt) })}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 grid-cols-2 xl:grid-cols-4">
          <InfoBlock
            label={t("info.customerPhone")}
            value={assignment.order.phone_number}
          />
          <InfoBlock
            label={t("info.shipmentStatus")}
            value={assignment.shipment.status}
          />
          <InfoBlock
            label={t("info.pickupProof")}
            value={
              assignment.pickupProof
                ? t("info.pickupConfirmed", {
                    date: formatDateTime(assignment.pickupProof.confirmedAt),
                  })
                : t("info.pickupPending")
            }
          />
          <InfoBlock
            label={t("info.tracking")}
            value={assignment.shipment.trackingNumber || t("info.notAssigned")}
          />
        </div>

        {assignment.rejectionReason ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {t("rejectionReason", { reason: assignment.rejectionReason })}
          </div>
        ) : null}

        {assignment.pickupProof?.imageUrl ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
            <img
              src={assignment.pickupProof.imageUrl}
              alt={t("pickupProofAlt")}
              className="h-52 w-full object-cover"
            />
          </div>
        ) : null}

        {canViewDetails ? (
          <div className="mt-5 space-y-5">
            <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-2xl border border-border bg-background p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {t("sections.deliveryDetails")}
                </h3>
                <div className="mt-4 space-y-3 text-sm">
                  <p className="text-foreground">
                    {assignment.order.address_details}
                  </p>
                  <p className="text-muted-foreground">
                    {assignment.order.area}, {assignment.order.district},{" "}
                    {assignment.order.country}
                  </p>
                  <p className="text-muted-foreground">
                    {t("labels.alternatePhone")}:{" "}
                    {assignment.order.alt_phone_number || t("labels.na")}
                  </p>
                  <p className="text-muted-foreground">
                    {t("labels.orderStatus")}: {assignment.order.status} ·{" "}
                    {t("labels.shipmentStatus")}: {assignment.shipment.status}
                  </p>
                  <p className="font-medium text-foreground">
                    {formatCurrency(
                      assignment.order.grand_total,
                      assignment.order.orderItems[0]?.currency || "BDT",
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {t("sections.warehouse")}
                </h3>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="font-medium text-foreground">
                    {assignment.warehouse.name}
                  </p>
                  <p className="text-muted-foreground">
                    {assignment.warehouse.district || t("labels.na")} ·{" "}
                    {assignment.warehouse.area || t("labels.na")}
                  </p>
                  <p className="text-muted-foreground">
                    {assignment.warehouse.locationNote ||
                      t("labels.noLocationNote")}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {t("sections.productList")}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {t("labels.itemCount", {
                    count: assignment.order.orderItems.length,
                  })}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {assignment.order.orderItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("labels.sku")}: {item.variant?.sku || t("labels.na")}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium text-foreground">
                        {t("labels.qty")} {item.quantity}
                      </p>
                      <p className="text-muted-foreground">
                        {formatCurrency(item.price, item.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
            {t("acceptToUnlock")}
          </div>
        )}

        <div className="mt-5 space-y-3">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {assignment.status === "ASSIGNED" ? (
              <>
                <Button
                  type="button"
                  onClick={() =>
                    runAction(
                      `/api/delivery-assignments/${assignment.id}/accept`,
                      undefined,
                      t("errors.acceptFailed"),
                    )
                  }
                  disabled={loadingAction !== null}
                >
                  {loadingAction?.includes("/accept")
                    ? t("actions.accepting")
                    : t("actions.accept")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={loadingAction !== null}
                >
                  {t("actions.reject")}
                </Button>
              </>
            ) : null}

            {assignment.status === "ACCEPTED" ? (
              <Button
                type="button"
                onClick={() => setPickupOpen(true)}
                disabled={loadingAction !== null}
              >
                {t("actions.collectFromWarehouse")}
              </Button>
            ) : null}

            {nextStatusActions.map((nextStatus) => (
              <Button
                key={nextStatus}
                type="button"
                variant={nextStatus === "DELIVERED" ? "default" : "outline"}
                onClick={() =>
                  runActionWithLocation(
                    `/api/delivery-assignments/${assignment.id}/status`,
                    { status: nextStatus },
                    t("errors.statusUpdateFailed", {
                      status: formatStatusLabel(nextStatus),
                    }),
                  )
                }
                disabled={loadingAction !== null}
              >
                {loadingAction?.includes("/status")
                  ? t("actions.updating")
                  : t("actions.markStatus", {
                      status: formatStatusLabel(nextStatus),
                    })}
              </Button>
            ))}
          </div>
        </div>

        <section className="mt-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("sections.statusHistory")}
            </h3>
            <span className="text-xs text-muted-foreground">
              {t("labels.eventCount", { count: assignment.logs.length })}
            </span>
          </div>
          <StatusTimeline logs={assignment.logs} />
        </section>
      </article>

      <PickupConfirmationModal
        assignmentId={assignment.id}
        open={pickupOpen}
        onOpenChange={setPickupOpen}
        onSuccess={onChanged}
      />

      <RejectAssignmentModal
        assignmentId={assignment.id}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onSuccess={onChanged}
      />
    </>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
