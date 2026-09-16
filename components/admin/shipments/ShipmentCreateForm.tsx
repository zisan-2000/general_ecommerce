"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type WarehouseOption = {
  id: number;
  name: string;
  code: string;
  address?: {
    location: string;
  } | null;
  isDefault: boolean;
};

type CourierOption = {
  id: number;
  name: string;
  type: "PATHAO" | "REDX" | "STEADFAST" | "CUSTOM";
  baseUrl: string;
  isActive: boolean;
};

type OrderOption = {
  id: number;
  email: string;
  name: string | null;
  total: number;
  status: string;
  shipment?: {
    id: number;
    status: string;
  } | null;
};

type ShipmentResponse = {
  id: number;
  orderId: number;
  courier: string;
  trackingNumber?: string | null;
  status: string;
  courierStatus?: string | null;
  trackingUrl?: string | null;
};

interface ShipmentCreateFormProps {
  onCreated?: () => void | Promise<void>;
  onClose?: () => void;
}

export default function ShipmentCreateForm({
  onCreated,
  onClose,
}: ShipmentCreateFormProps) {
  const t = useTranslations("AdminShipmentCreateForm");

  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [loadingCouriers, setLoadingCouriers] = useState(true);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShipmentResponse | null>(null);

  const [orderId, setOrderId] = useState("");
  const [courierId, setCourierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const loadCouriers = async () => {
      try {
        setLoadingCouriers(true);
        const res = await fetch("/api/couriers", { cache: "no-store" });
        if (!res.ok) throw new Error(t("errors.loadCouriers"));
        const data = (await res.json()) as CourierOption[];
        setCouriers(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errors.loadCouriers"));
      } finally {
        setLoadingCouriers(false);
      }
    };

    const loadOrders = async () => {
      try {
        setLoadingOrders(true);
        const res = await fetch("/api/orders?hasShipment=false&limit=200");
        if (!res.ok) throw new Error(t("errors.loadOrders"));
        const data = (await res.json()) as { orders: OrderOption[] };
        const eligible = (data.orders || []).filter((order) =>
          ["PENDING", "CONFIRMED", "PROCESSING"].includes(order.status),
        );
        setOrders(eligible);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errors.loadOrders"));
      } finally {
        setLoadingOrders(false);
      }
    };

    const loadWarehouses = async () => {
      try {
        setLoadingWarehouses(true);
        const res = await fetch("/api/warehouses");
        if (!res.ok) throw new Error(t("errors.loadWarehouses"));
        const data = (await res.json()) as WarehouseOption[];
        setWarehouses(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errors.loadWarehouses"));
      } finally {
        setLoadingWarehouses(false);
      }
    };

    loadCouriers();
    loadOrders();
    loadWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCourier = useMemo(
    () => couriers.find((c) => String(c.id) === courierId),
    [courierId, couriers],
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      if (!orderId || !courierId) {
        throw new Error(t("errors.orderAndCourierRequired"));
      }

      const payload = {
        orderId: Number(orderId),
        courierId: Number(courierId),
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        note: note || undefined,
      };

      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || t("errors.createFailed"));
      }

      setResult(data as ShipmentResponse);
      if (onCreated) {
        await onCreated();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted"
        >
          {t("actions.close")}
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground">{t("fields.order")}</span>
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            required
            className="h-10 rounded-md border border-border bg-background px-3"
            disabled={loadingOrders}
          >
            <option value="">
              {loadingOrders
                ? t("placeholders.loadingOrders")
                : t("placeholders.selectOrder")}
            </option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.id} - {order.name || order.email} (${order.total})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground">{t("fields.courier")}</span>
          <select
            value={courierId}
            onChange={(e) => setCourierId(e.target.value)}
            required
            className="h-10 rounded-md border border-border bg-background px-3"
            disabled={loadingCouriers}
          >
            <option value="">
              {loadingCouriers
                ? t("placeholders.loadingCouriers")
                : t("placeholders.selectCourier")}
            </option>
            {couriers.map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courier.name} ({courier.type})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground">
            {t("fields.warehouseOptional")}
          </span>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3"
            disabled={loadingWarehouses}
          >
            <option value="">
              {loadingWarehouses
                ? t("placeholders.loadingWarehouses")
                : t("placeholders.selectWarehouse")}
            </option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name} ({warehouse.code})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm md:col-span-2">
          <span className="text-muted-foreground">
            {t("fields.courierNoteOptional")}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[90px] rounded-md border border-border bg-background px-3 py-2"
            placeholder={t("placeholders.courierNote")}
          />
        </label>

        {selectedCourier && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground md:col-span-2">
            <p>
              <span className="font-medium text-foreground">
                {t("selectedCourier.provider")}
              </span>{" "}
              {selectedCourier.name} ({selectedCourier.type})
            </p>
            <p>
              <span className="font-medium text-foreground">
                {t("selectedCourier.endpoint")}
              </span>{" "}
              {selectedCourier.baseUrl}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive md:col-span-2">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-md border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm text-emerald-700 dark:text-emerald-300 md:col-span-2">
            <p>{t("success.created", { id: result.id })}</p>
            <p>{t("success.status", { status: result.status })}</p>
            <p>
              {t("success.tracking", {
                tracking: result.trackingNumber || t("success.notAvailable"),
              })}
            </p>
            {result.trackingUrl && (
              <a
                href={result.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {t("success.openTrackingUrl")}
              </a>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 md:col-span-2"
        >
          {submitting ? t("actions.creating") : t("actions.create")}
        </button>
      </form>
    </div>
  );
}
