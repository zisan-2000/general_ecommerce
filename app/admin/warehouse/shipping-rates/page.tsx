"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { ALLOWED_SHIPPING_AREAS } from "@/lib/shipping-areas";
import ShippingRatesSkeleton from "@/components/ui/ShippingRatesSkeleton";

type ShippingRate = {
  id: number;
  country: string;
  area: string;
  baseCost: string | number;
  weightSlabs?: unknown;
  freeMinOrder?: string | number | null;
  isActive: boolean;
  priority: number;
};

type RateForm = {
  country: string;
  area: string;
  baseCost: string;
  freeMinOrder: string;
  isActive: boolean;
  priority: string;
};

type WeightSlabInput = {
  minWeight: string;
  maxWeight: string;
  cost: string;
};

type CountryOption = { name: string; iso2: string };

const defaultForm: RateForm = {
  country: "BD",
  area: ALLOWED_SHIPPING_AREAS[0],
  baseCost: "0",
  freeMinOrder: "",
  isActive: true,
  priority: "1000",
};

function parseWeightSlabs(raw: unknown): WeightSlabInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => typeof item === "object" && item !== null)
    .map((item) => {
      const slab = item as Record<string, unknown>;
      return {
        minWeight:
          slab.minWeight === undefined || slab.minWeight === null
            ? ""
            : String(slab.minWeight),
        maxWeight:
          slab.maxWeight === undefined || slab.maxWeight === null
            ? ""
            : String(slab.maxWeight),
        cost:
          slab.cost === undefined || slab.cost === null
            ? ""
            : String(slab.cost),
      };
    });
}

export default function ShippingRatesPage() {
  const t = useTranslations("AdminShippingRates");

  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [form, setForm] = useState<RateForm>(defaultForm);
  const [weightSlabs, setWeightSlabs] = useState<WeightSlabInput[]>([]);
  const [editing, setEditing] = useState<ShippingRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const ratesRes = await fetch("/api/admin/shipping-rates", {
        cache: "no-store",
      });
      const ratesData = await ratesRes.json();
      if (!ratesRes.ok) {
        throw new Error(ratesData?.error || t("errors.loadRates"));
      }
      setRates(Array.isArray(ratesData) ? ratesData : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadRates"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCountries = async () => {
    setLoadingCountries(true);
    try {
      const res = await fetch("/api/geo/countries", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("errors.loadCountries"));
      setCountries(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadCountries"));
    } finally {
      setLoadingCountries(false);
    }
  };

  const countryOptions = useMemo(() => {
    return countries.map((c) => (
      <option key={c.iso2} value={c.iso2}>
        {c.name} ({c.iso2})
      </option>
    ));
  }, [countries]);

  const shippingRateItems = useMemo(() => {
    return rates.map((r) => (
      <div
        key={r.id}
        className="border-b py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
      >
        <div className="text-sm">
          <p className="font-medium">
            #{r.id} {r.country} {">"} {r.area}
          </p>
          <p className="text-muted-foreground">
            {t("list.base")}: {Number(r.baseCost)} | {t("list.freeOver")}:{" "}
            {r.freeMinOrder === null || r.freeMinOrder === undefined
              ? t("list.notSet")
              : Number(r.freeMinOrder)}{" "}
            | {t("list.priority")}: {r.priority}
          </p>
          <p className="text-muted-foreground">
            {t("list.weightSlabs")}:{" "}
            {Array.isArray(r.weightSlabs) ? r.weightSlabs.length : 0}
          </p>
          <p className="text-muted-foreground">
            {t("list.status")}:{" "}
            {r.isActive ? t("list.active") : t("list.inactive")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-primary px-3 py-1 rounded text-sm"
            onClick={() => beginEdit(r)}
          >
            {t("actions.edit")}
          </button>
          <button
            className="btn-danger px-3 py-1 rounded text-sm"
            onClick={() => removeRate(r)}
          >
            {t("actions.delete")}
          </button>
        </div>
      </div>
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates, t]);

  useEffect(() => {
    loadCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginEdit = (rate: ShippingRate) => {
    setEditing(rate);
    setError(null);
    setSuccess(null);
    setForm({
      country: rate.country || "BD",
      area: rate.area || "",
      baseCost: String(rate.baseCost ?? "0"),
      freeMinOrder:
        rate.freeMinOrder === null || rate.freeMinOrder === undefined
          ? ""
          : String(rate.freeMinOrder),
      isActive: Boolean(rate.isActive),
      priority: String(rate.priority ?? 1000),
    });
    setWeightSlabs(parseWeightSlabs(rate.weightSlabs));
    setShowModal(true);
  };

  const resetForm = () => {
    setEditing(null);
    setForm(defaultForm);
    setWeightSlabs([]);
    setShowModal(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const normalizedSlabs = weightSlabs
        .filter((slab) => slab.minWeight || slab.maxWeight || slab.cost)
        .map((slab) => {
          if (!slab.minWeight || !slab.cost) {
            throw new Error(t("errors.slabMinCostRequired"));
          }
          const minWeight = Number(slab.minWeight);
          const maxWeight = slab.maxWeight ? Number(slab.maxWeight) : null;
          const cost = Number(slab.cost);

          if (!Number.isFinite(minWeight) || minWeight < 0) {
            throw new Error(t("errors.slabMinWeightInvalid"));
          }
          if (
            maxWeight !== null &&
            (!Number.isFinite(maxWeight) || maxWeight <= minWeight)
          ) {
            throw new Error(t("errors.slabMaxWeightInvalid"));
          }
          if (!Number.isFinite(cost) || cost < 0) {
            throw new Error(t("errors.slabCostInvalid"));
          }

          return { minWeight, maxWeight, cost };
        });

      let weightSlabsPayload: unknown = null;
      if (normalizedSlabs.length > 0) {
        weightSlabsPayload = normalizedSlabs;
      }

      if (weightSlabsPayload === null && Number(form.baseCost) <= 0) {
        throw new Error(t("errors.baseOrSlabRequired"));
      }

      if (!Number.isFinite(Number(form.priority))) {
        throw new Error(t("errors.priorityInvalid"));
      }
      if (
        !Number.isFinite(Number(form.baseCost)) ||
        Number(form.baseCost) < 0
      ) {
        throw new Error(t("errors.baseCostInvalid"));
      }
      if (
        form.freeMinOrder &&
        (!Number.isFinite(Number(form.freeMinOrder)) ||
          Number(form.freeMinOrder) < 0)
      ) {
        throw new Error(t("errors.freeMinOrderInvalid"));
      }

      const payload = {
        country: form.country.trim().toUpperCase(),
        area: form.area.trim(),
        baseCost: Number(form.baseCost),
        weightSlabs: weightSlabsPayload,
        freeMinOrder: form.freeMinOrder ? Number(form.freeMinOrder) : null,
        isActive: form.isActive,
        priority: Number(form.priority),
      };

      if (!payload.country) {
        throw new Error(t("errors.countryRequired"));
      }
      if (!payload.area) {
        throw new Error(t("errors.areaRequired"));
      }

      const url = editing
        ? `/api/admin/shipping-rates/${editing.id}`
        : "/api/admin/shipping-rates";
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || t("errors.saveFailed"));
      }

      setSuccess(editing ? t("success.updated") : t("success.created"));
      resetForm();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const addWeightSlabRow = () => {
    setWeightSlabs((prev) => [
      ...prev,
      { minWeight: "", maxWeight: "", cost: "" },
    ]);
  };

  const updateWeightSlabRow = (
    index: number,
    field: keyof WeightSlabInput,
    value: string,
  ) => {
    setWeightSlabs((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const removeWeightSlabRow = (index: number) => {
    setWeightSlabs((prev) => prev.filter((_, i) => i !== index));
  };

  const removeRate = async (rate: ShippingRate) => {
    if (!confirm(t("confirm.deleteRate", { id: rate.id }))) return;

    setError(null);
    setSuccess(null);
    const res = await fetch(`/api/admin/shipping-rates/${rate.id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || t("errors.deleteFailed"));
      return;
    }

    if (editing?.id === rate.id) resetForm();
    setSuccess(t("success.deleted"));
    await loadData();
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary px-4 py-2 rounded inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("actions.addRate")}
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card-theme border rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">
                {editing ? t("modal.titleEdit") : t("modal.titleAdd")}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="h-8 w-8 rounded-md border border-border bg-background hover:bg-muted flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm">
                  {t("fields.country")}
                  <select
                    className="input-theme border p-2 rounded w-full mt-1"
                    value={form.country}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        country: e.target.value,
                        area: "",
                      }))
                    }
                    required
                  >
                    <option value="">
                      {loadingCountries
                        ? t("placeholders.loadingCountries")
                        : t("placeholders.selectCountry")}
                    </option>
                    {countryOptions}
                  </select>
                </label>
                <label className="text-sm">
                  {t("fields.area")}
                  <select
                    className="input-theme border p-2 rounded w-full mt-1"
                    value={form.area}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, area: e.target.value }))
                    }
                    required
                  >
                    {ALLOWED_SHIPPING_AREAS.map((areaOption) => (
                      <option key={areaOption} value={areaOption}>
                        {areaOption}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="text-sm">
                  {t("fields.baseCost")}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-theme border p-2 rounded w-full mt-1"
                    placeholder={t("placeholders.baseCost")}
                    value={form.baseCost}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, baseCost: e.target.value }))
                    }
                    required
                  />
                </label>
                <label className="text-sm">
                  {t("fields.freeMinOrder")}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-theme border p-2 rounded w-full mt-1"
                    placeholder={t("placeholders.freeMinOrder")}
                    value={form.freeMinOrder}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, freeMinOrder: e.target.value }))
                    }
                  />
                </label>
                <label className="text-sm">
                  {t("fields.priority")}
                  <input
                    type="number"
                    className="input-theme border p-2 rounded w-full mt-1"
                    placeholder={t("placeholders.priority")}
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priority: e.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    {t("weightSlabs.title")}
                  </label>
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1 rounded text-sm"
                    onClick={addWeightSlabRow}
                  >
                    {t("weightSlabs.addSlab")}
                  </button>
                </div>
                {weightSlabs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("weightSlabs.emptyHint")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {weightSlabs.map((slab, index) => (
                      <div
                        key={`slab-${index}`}
                        className="grid grid-cols-1 md:grid-cols-4 gap-2 border rounded p-2"
                      >
                        <label className="text-xs">
                          {t("weightSlabs.minWeight")}
                          <input
                            type="number"
                            min="0"
                            className="input-theme border p-2 rounded w-full mt-1"
                            placeholder="0"
                            value={slab.minWeight}
                            onChange={(e) =>
                              updateWeightSlabRow(
                                index,
                                "minWeight",
                                e.target.value,
                              )
                            }
                          />
                        </label>
                        <label className="text-xs">
                          {t("weightSlabs.maxWeight")}
                          <input
                            type="number"
                            min="0"
                            className="input-theme border p-2 rounded w-full mt-1"
                            placeholder="1000"
                            value={slab.maxWeight}
                            onChange={(e) =>
                              updateWeightSlabRow(
                                index,
                                "maxWeight",
                                e.target.value,
                              )
                            }
                          />
                        </label>
                        <label className="text-xs">
                          {t("weightSlabs.charge")}
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input-theme border p-2 rounded w-full mt-1"
                            placeholder="60"
                            value={slab.cost}
                            onChange={(e) =>
                              updateWeightSlabRow(index, "cost", e.target.value)
                            }
                          />
                        </label>
                        <div className="flex items-end">
                          <button
                            type="button"
                            className="btn-danger px-3 py-2 rounded text-sm w-full"
                            onClick={() => removeWeightSlabRow(index)}
                          >
                            {t("actions.remove")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                {t("fields.active")}
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-700">{success}</p>}

              <div className="flex gap-2 pt-4 border-t">
                <button
                  type="button"
                  className="btn-secondary px-4 py-2 rounded"
                  onClick={resetForm}
                >
                  {t("actions.cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-primary px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting
                    ? t("actions.saving")
                    : editing
                      ? t("actions.update")
                      : t("actions.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card-theme border rounded-lg p-4 space-y-3">
        {loading ? (
          <ShippingRatesSkeleton />
        ) : rates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty.noRates")}</p>
        ) : (
          shippingRateItems
        )}
      </div>
    </div>
  );
}
