"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Courier, type CourierForm } from "@/lib/types/courier";

interface CourierFormModalProps {
  onClose: () => void;
  refresh: () => void;
  editingCourier?: Courier | null;
}

export default function CourierFormModal({
  onClose,
  refresh,
  editingCourier,
}: CourierFormModalProps) {
  const t = useTranslations("AdminCourierFormModal2");

  const [form, setForm] = useState<CourierForm>({
    name: "",
    type: "PATHAO",
    baseUrl: "",
    apiKey: "",
    secretKey: "",
    clientId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (editingCourier) {
      setForm({
        name: editingCourier.name,
        type: editingCourier.type,
        baseUrl: editingCourier.baseUrl,
        apiKey: editingCourier.apiKey || "",
        secretKey: editingCourier.secretKey || "",
        clientId: editingCourier.clientId || "",
      });
    } else {
      setForm({
        name: "",
        type: "PATHAO",
        baseUrl: "",
        apiKey: "",
        secretKey: "",
        clientId: "",
      });
    }
    setError(null);
    setSuccess(null);
  }, [editingCourier]);

  const isEditing = !!editingCourier;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!form.name.trim()) {
      setError(t("errors.nameRequired"));
      setLoading(false);
      return;
    }

    try {
      const url = isEditing
        ? `/api/couriers/${editingCourier.id}`
        : "/api/couriers";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            t(isEditing ? "errors.updateFailed" : "errors.createFailed"),
        );
      }

      setSuccess(t(isEditing ? "success.updated" : "success.created"));
      refresh();

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="card-theme p-6 rounded-lg w-[500px] max-w-[90vw] border shadow-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {isEditing ? t("titleEdit") : t("titleAdd")}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {t("fields.name")}
            </label>
            <input
              placeholder={t("placeholders.name")}
              className="input-theme border p-2 rounded w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {t("fields.type")}
            </label>
            <select
              className="input-theme border p-2 rounded w-full"
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value as CourierForm["type"],
                })
              }
            >
              <option value="PATHAO">{t("courierTypes.PATHAO")}</option>
              <option value="REDX">{t("courierTypes.REDX")}</option>
              <option value="STEADFAST">{t("courierTypes.STEADFAST")}</option>
              <option value="CUSTOM">{t("courierTypes.CUSTOM")}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {t("fields.baseUrlOptional")}
            </label>
            <input
              placeholder={t("placeholders.baseUrl")}
              className="input-theme border p-2 rounded w-full"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {t("fields.apiKeyOptional")}
            </label>
            <input
              placeholder={t("placeholders.apiKey")}
              className="input-theme border p-2 rounded w-full"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {t("fields.secretKeyOptional")}
            </label>
            <input
              placeholder={t("placeholders.secretKey")}
              className="input-theme border p-2 rounded w-full"
              value={form.secretKey}
              onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {t("fields.clientIdOptional")}
            </label>
            <input
              placeholder={t("placeholders.clientId")}
              className="input-theme border p-2 rounded w-full"
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
              {success}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded"
            >
              {t("actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? t(isEditing ? "actions.updating" : "actions.creating")
                : t(isEditing ? "actions.update" : "actions.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
