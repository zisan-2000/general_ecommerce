"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Props {
  onClose: () => void;
  refresh: () => void;
}

export default function ShipmentFormModal({ onClose, refresh }: Props) {
  const t = useTranslations("AdminShipmentFormModal");

  const [form, setForm] = useState({
    orderId: "",
    warehouseId: "",
    courier: "",
    trackingNumber: "",
    expectedDate: "",
  });

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        orderId: Number(form.orderId),
        warehouseId: form.warehouseId ? Number(form.warehouseId) : null,
      }),
    });

    refresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="card-theme p-6 rounded-lg w-96 border shadow-lg">
        <h2 className="text-lg font-semibold mb-4">{t("title")}</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="number"
            placeholder={t("placeholders.orderId")}
            className="w-full input-theme border p-2 rounded"
            value={form.orderId}
            onChange={(e) => setForm({ ...form, orderId: e.target.value })}
            required
          />

          <input
            type="number"
            placeholder={t("placeholders.warehouseId")}
            className="w-full input-theme border p-2 rounded"
            value={form.warehouseId}
            onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
          />

          <input
            type="text"
            placeholder={t("placeholders.courier")}
            className="w-full input-theme border p-2 rounded"
            value={form.courier}
            onChange={(e) => setForm({ ...form, courier: e.target.value })}
            required
          />

          <input
            type="text"
            placeholder={t("placeholders.trackingNumber")}
            className="w-full input-theme border p-2 rounded"
            value={form.trackingNumber}
            onChange={(e) =>
              setForm({ ...form, trackingNumber: e.target.value })
            }
          />

          <input
            type="date"
            className="w-full input-theme border p-2 rounded"
            value={form.expectedDate}
            onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded"
            >
              {t("actions.cancel")}
            </button>
            <button type="submit" className="btn-primary px-4 py-2 rounded">
              {t("actions.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
