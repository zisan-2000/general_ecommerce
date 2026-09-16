"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type DeliveryManAssignmentOption = {
  id: string;
  fullName: string;
  phone: string;
  employeeCode: string | null;
  warehouse: {
    id: number;
    name: string;
    code: string;
  } | null;
};

export type ShipmentAssignmentOption = {
  id: number;
  orderId: number;
  courier: string;
  warehouseId: number | null;
};

export function AssignDeliveryManModal({
  open,
  onOpenChange,
  shipments,
  deliveryMen,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipments: ShipmentAssignmentOption[];
  deliveryMen: DeliveryManAssignmentOption[];
  onAssigned: (message: string) => Promise<void> | void;
}) {
  const t = useTranslations("AdminAssignDeliveryManModal");

  const [deliveryManProfileId, setDeliveryManProfileId] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const warehouseHint = useMemo(() => {
    const warehouseIds = [
      ...new Set(
        shipments.map((shipment) => shipment.warehouseId).filter(Boolean),
      ),
    ];
    return warehouseIds.length === 1 ? warehouseIds[0] : null;
  }, [shipments]);

  const filteredDeliveryMen = useMemo(() => {
    if (!warehouseHint) {
      return deliveryMen;
    }
    return deliveryMen.filter(
      (deliveryMan) => deliveryMan.warehouse?.id === warehouseHint,
    );
  }, [deliveryMen, warehouseHint]);

  async function handleAssign() {
    if (!deliveryManProfileId) {
      setError(t("errors.selectDeliveryMan"));
      return;
    }

    if (!shipments.length) {
      setError(t("errors.selectShipment"));
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch("/api/delivery-assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deliveryManProfileId,
          shipmentIds: shipments.map((shipment) => shipment.id),
          note: note.trim() || null,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t("errors.assignFailed"));
      }

      setDeliveryManProfileId("");
      setNote("");
      onOpenChange(false);
      await onAssigned(
        payload.message ||
          (shipments.length === 1
            ? t("success.singleAssigned")
            : t("success.multipleAssigned")),
      );
    } catch (assignError) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : t("errors.assignFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("selectedShipments")}
            </p>
            <div className="mt-3 space-y-2">
              {shipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {t("shipmentLabel", { id: shipment.id })}
                    </p>
                    <p className="text-muted-foreground">
                      {t("orderLabel", { id: shipment.orderId })}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{shipment.courier}</p>
                    <p>
                      {shipment.warehouseId
                        ? t("warehouseLabel", { id: shipment.warehouseId })
                        : t("warehouseNotSet")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("deliveryManLabel")}
            </label>
            <select
              value={deliveryManProfileId}
              onChange={(event) => setDeliveryManProfileId(event.target.value)}
              className="input-theme h-11 w-full rounded-xl border border-border bg-background px-4 text-sm"
            >
              <option value="">{t("selectDeliveryMan")}</option>
              {filteredDeliveryMen.map((deliveryMan) => (
                <option key={deliveryMan.id} value={deliveryMan.id}>
                  {deliveryMan.fullName}
                  {deliveryMan.employeeCode
                    ? ` (${deliveryMan.employeeCode})`
                    : ""}
                  {deliveryMan.warehouse
                    ? ` · ${deliveryMan.warehouse.name} (${deliveryMan.warehouse.code})`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("noteLabel")}
            </label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder={t("notePlaceholder")}
              className="input-theme w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("actions.cancel")}
          </Button>
          <Button type="button" onClick={handleAssign} disabled={submitting}>
            {submitting ? t("actions.assigning") : t("actions.assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
