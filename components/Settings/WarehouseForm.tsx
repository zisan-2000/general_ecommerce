"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

type Warehouse = {
  id: number;
  name: string;
  code: string;
  address?: {
    location: string;
  } | null;
  isDefault: boolean;
};

interface WarehouseFormProps {
  refresh: () => void;
  editingWarehouse?: Warehouse | null;
  setEditingWarehouse?: (warehouse: Warehouse | null) => void;
}

export default function WarehouseForm({
  refresh,
  editingWarehouse,
  setEditingWarehouse,
}: WarehouseFormProps) {
  const t = useTranslations("AdminWarehouseForm");

  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    isDefault: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (editingWarehouse) {
      setForm({
        name: editingWarehouse.name,
        code: editingWarehouse.code,
        address: editingWarehouse.address?.location || "",
        isDefault: editingWarehouse.isDefault,
      });
    } else {
      setForm({
        name: "",
        code: "",
        address: "",
        isDefault: false,
      });
    }
    setError(null);
  }, [editingWarehouse]);

  const isEditing = !!editingWarehouse;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!form.name.trim()) {
      setError(t("errors.nameRequired"));
      setLoading(false);
      return;
    }
    if (!form.code.trim()) {
      setError(t("errors.codeRequired"));
      setLoading(false);
      return;
    }

    try {
      const url = isEditing
        ? `/api/warehouses/${editingWarehouse.id}`
        : "/api/warehouses";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          address: form.address ? { location: form.address } : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            t(isEditing ? "errors.updateFailed" : "errors.createFailed"),
        );
      }

      setSuccess(t(isEditing ? "success.updated" : "success.created"));
      refresh();

      if (isEditing && setEditingWarehouse) {
        setEditingWarehouse(null);
      } else {
        setForm({
          name: "",
          code: "",
          address: "",
          isDefault: false,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-theme border p-4 rounded-lg space-y-3"
    >
      <h2 className="font-semibold">
        {isEditing ? t("titleEdit") : t("titleAdd")}
      </h2>

      <input
        placeholder={t("placeholders.name")}
        className="input-theme border p-2 rounded w-full"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />

      <input
        placeholder={t("placeholders.code")}
        className="input-theme border p-2 rounded w-full"
        value={form.code}
        onChange={(e) => setForm({ ...form, code: e.target.value })}
        required
      />

      <input
        placeholder={t("placeholders.address")}
        className="input-theme border p-2 rounded w-full"
        value={form.address}
        onChange={(e) => setForm({ ...form, address: e.target.value })}
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
        />
        {t("fields.defaultWarehouse")}
      </label>

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

      {isEditing && (
        <button
          type="button"
          onClick={() => setEditingWarehouse && setEditingWarehouse(null)}
          className="btn-secondary px-4 py-2 rounded"
        >
          {t("actions.cancel")}
        </button>
      )}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? t(isEditing ? "actions.updating" : "actions.creating")
          : t(isEditing ? "actions.update" : "actions.save")}
      </button>
    </form>
  );
}
