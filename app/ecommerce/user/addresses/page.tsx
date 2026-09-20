"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import AccountMenu from "../AccountMenu";
import AccountHeader from "../AccountHeader";
import { Home, Plus, Minus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { ALLOWED_SHIPPING_AREAS, normalizeShippingArea } from "@/lib/shipping-areas";
import { useTranslations } from "next-intl";

type AddressRow = {
  id: number;
  label: string;
  country: string;
  district: string;
  area: string;
  details: string[]; // dynamic lines
  isDefault: boolean;
  createdAt?: string;
};

type AddressForm = {
  id?: number | null;
  label: string;
  country: string;
  district: string;
  area: string;
  details: string[];
  isDefault: boolean;
};

type CountryOption = {
  name: string;
  iso2: string;
};

type DistrictOption = {
  name: string;
  iso2?: string;
};

const toLines = (v: any): string[] => {
  if (!v) return ["", ""];
  if (Array.isArray(v)) {
    const clean = v.map((x) => String(x ?? "")).filter((s) => s.length >= 0);
    return clean.length >= 2 ? clean : [...clean, ""].slice(0, 2);
  }
  if (typeof v === "string") {
    // if API returns JSON string
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return toLines(parsed);
    } catch {}
    // fallback split by newline
    const parts = v.split("\n").map((s) => s.trim());
    return toLines(parts);
  }
  return ["", ""];
};

export default function AddressesPage() {
  const t = useTranslations("CustomerAccount");
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<AddressRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [countryCode, setCountryCode] = useState("BD");
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  const userName =
    session?.user?.name ||
    (session?.user?.email ? session.user.email.split("@")[0] : t("header.user"));

  const areaLabel = (area: string) => {
    if (area === "Dhaka") return t("addresses.areas.dhaka");
    if (area === "Outside Dhaka") return t("addresses.areas.outsideDhaka");
    if (area === "Outside Bangladesh") return t("addresses.areas.outsideBangladesh");
    return area;
  };

  const [form, setForm] = useState<AddressForm>({
    id: null,
    label: "",
    country: "Bangladesh",
    district: "",
    area: ALLOWED_SHIPPING_AREAS[0],
    details: ["", ""], // Address 1, Address 2 default
    isDefault: true,
  });

  const requiredMissing = useMemo(() => {
    const must = [
      form.label?.trim(),
      form.country?.trim(),
      form.district?.trim(),
      form.area?.trim(),
      (form.details?.[0] || "").trim(), // Address 1 required
    ];
    return must.some((x) => !x);
  }, [form]);

  const refresh = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/user/address", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        toast.error(t("common.unauthorized"), { duration: 3500 });
        setList([]);
        return;
      }

      if (!res.ok) {
        toast.error(t("addresses.errors.load"), {
          duration: 3500,
        });
        setList([]);
        return;
      }

      const mapped: AddressRow[] = Array.isArray(data?.addresses)
        ? data.addresses.map((a: any) => ({
            id: Number(a.id),
            label: a.label ?? "",
            country: a.country ?? "",
            district: a.district ?? "",
            area: a.area ?? "",
            details: toLines(a.details),
            isDefault: !!a.isDefault,
            createdAt: a.createdAt,
          }))
        : [];

      setList(mapped);
    } catch {
      toast.error(t("addresses.errors.load"), { duration: 3500 });
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading") return;
    refresh();
    loadCountries();
  }, [status]);

  const setField = <K extends keyof AddressForm>(
    key: K,
    value: AddressForm[K],
  ) => {
    setForm((p) => ({ ...p, [key]: value }));
  };

  const resolveCountryCode = (country: string, listData: CountryOption[]) => {
    const normalized = String(country || "")
      .trim()
      .toLowerCase();
    if (!normalized) return "";

    const byCode = listData.find((c) => c.iso2.toLowerCase() === normalized);
    if (byCode) return byCode.iso2;

    const byName = listData.find((c) => c.name.toLowerCase() === normalized);
    return byName?.iso2 ?? "";
  };

  const loadCountries = async () => {
    try {
      setLoadingCountries(true);
      const res = await fetch("/api/geo/countries", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(t("addresses.errors.countries"));

      const listData: CountryOption[] = Array.isArray(data) ? data : [];
      setCountries(listData);

      const resolved = resolveCountryCode(form.country, listData) || "BD";
      setCountryCode(resolved);

      const selected = listData.find((c) => c.iso2 === resolved);
      if (selected && form.country !== selected.name) {
        setForm((prev) => ({ ...prev, country: selected.name }));
      }
    } catch {
      toast.error(t("addresses.errors.countries"), { duration: 3000 });
    } finally {
      setLoadingCountries(false);
    }
  };

  const loadDistricts = async (code: string) => {
    if (!code) {
      setDistricts([]);
      return;
    }
    try {
      setLoadingDistricts(true);
      const res = await fetch(`/api/geo/countries/${code}/states`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(t("addresses.errors.districts"));
      setDistricts(Array.isArray(data) ? data : []);
    } catch {
      setDistricts([]);
      toast.error(t("addresses.errors.districts"), { duration: 3000 });
    } finally {
      setLoadingDistricts(false);
    }
  };

  useEffect(() => {
    loadDistricts(countryCode);
  }, [countryCode]);

  const setDetailLine = (idx: number, value: string) => {
    setForm((p) => {
      const next = [...p.details];
      next[idx] = value;
      return { ...p, details: next };
    });
  };

  const addDetailLine = () => {
    setForm((p) => ({ ...p, details: [...p.details, ""] }));
  };

  const removeDetailLine = (idx: number) => {
    setForm((p) => {
      // keep at least 2 fields
      if (p.details.length <= 2) return p;
      const next = p.details.filter((_, i) => i !== idx);
      return { ...p, details: next };
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      id: null,
      label: "",
      country: "Bangladesh",
      district: "",
      area: ALLOWED_SHIPPING_AREAS[0],
      details: ["", ""],
      isDefault: true,
    });
    setCountryCode("BD");
    setShowModal(false);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const startEdit = (row: AddressRow) => {
    setEditingId(row.id);
    setForm({
      id: row.id,
      label: row.label,
      country: row.country,
      district: row.district,
      area: normalizeShippingArea(row.area || "") || ALLOWED_SHIPPING_AREAS[0],
      details: row.details.length >= 2 ? row.details : ["", ""],
      isDefault: row.isDefault,
    });
    const resolved = resolveCountryCode(row.country, countries);
    if (resolved) setCountryCode(resolved);
    setShowModal(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (requiredMissing) {
      toast.error(t("addresses.errors.required"), { duration: 3500 });
      return;
    }

    const cleanedDetails = (form.details || [])
      .map((s) => String(s ?? "").trim())
      .filter((s) => s.length > 0);
    const safeArea = normalizeShippingArea(form.area);

    if (cleanedDetails.length === 0) {
      toast.error(t("addresses.errors.addressRequired"), { duration: 3500 });
      return;
    }
    if (!safeArea) {
      toast.error(t("addresses.errors.validArea"), { duration: 3500 });
      return;
    }

    try {
      setSaving(true);

      const payload = {
        id: form.id ?? undefined,
        label: form.label.trim(),
        country: form.country.trim(),
        district: form.district.trim(),
        area: safeArea,
        // store as JSON string in DB
        details: cleanedDetails,
        isDefault: !!form.isDefault,
      };

      const isUpdate = !!editingId;

      const res = await fetch("/api/user/address", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        toast.error(t("common.unauthorized"), { duration: 3500 });
        return;
      }

      if (!res.ok) {
        toast.error(t("addresses.errors.save"), {
          duration: 3500,
        });
        return;
      }

      toast.success(
        isUpdate
          ? t("addresses.success.updated")
          : t("addresses.success.added"),
        {
          duration: 2500,
        },
      );

      resetForm();
      await refresh();
    } catch {
      toast.error(t("addresses.errors.save"), {
        duration: 3500,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Breadcrumb */}
      <div className="px-6 pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>{t("common.home")}</span>
          </Link>
          <span>›</span>
          <Link
            href="/ecommerce/user"
            className="hover:text-foreground transition-colors"
          >
            {t("common.account")}
          </Link>
          <span>›</span>
          <span className="text-foreground">{t("addresses.title")}</span>
        </div>
      </div>

      {/* Shared header + menu */}
      <AccountHeader />
      <AccountMenu />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-medium mb-2">{t("addresses.saved")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("addresses.description")}
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="h-10 px-6 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("addresses.addNew")}
          </button>
        </div>

        {/* Existing list */}
        <div>
          {loading ? (
            <Card className="p-6 bg-card text-card-foreground border border-border rounded-2xl">
              <p className="text-sm text-muted-foreground">
                {t("addresses.loading")}
              </p>
            </Card>
          ) : list.length === 0 ? (
            <Card className="p-12 bg-card text-card-foreground border border-border rounded-2xl text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Home className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("addresses.emptyTitle")}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                {t("addresses.emptyDescription")}
              </p>
              <button
                onClick={openAddModal}
                className="h-10 px-6 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {t("addresses.addFirst")}
              </button>
            </Card>
          ) : (
            <div className="space-y-3">
              {list.map((a) => (
                <Card
                  key={a.id}
                  className="p-4 bg-card text-card-foreground border border-border rounded-2xl"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="text-sm">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{a.label}</p>
                        {a.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-border bg-muted">
                            <Check className="h-3.5 w-3.5" /> {t("addresses.default")}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-1">
                        {areaLabel(a.area)}, {a.district}, {a.country}
                      </p>

                      <div className="mt-2 space-y-1">
                        {a.details.map((line, idx) => (
                          <p
                            key={idx}
                            className="text-xs text-muted-foreground"
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(a)}
                        className="h-9 px-4 rounded-md border border-border bg-background hover:bg-muted transition-colors text-sm font-semibold inline-flex items-center gap-2"
                      >
                        <Pencil className="h-4 w-4" />
                        {t("common.edit")}
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Address Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-xl sm:rounded-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-border">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-medium text-foreground">
                  {editingId ? t("addresses.edit") : t("addresses.addNew")}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {editingId ? t("addresses.modalUpdateDescription") : t("addresses.modalAddDescription")}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="h-8 w-8 rounded-md border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center"
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Name (from session) */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {t("addresses.name")} <span className="text-destructive">*</span>
                </p>
                <input
                  value={userName}
                  readOnly
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none opacity-90"
                />
                <p className="text-xs text-muted-foreground">
                  {t("addresses.nameHint")}
                </p>
              </div>

              {/* Label */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {t("addresses.label")} <span className="text-destructive">*</span>
                </p>
                <input
                  value={form.label}
                  onChange={(e) => setField("label", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder={t("addresses.labelPlaceholder")}
                />
              </div>

              {/* Address lines (dynamic) */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  {t("addresses.addressLines")} <span className="text-destructive">*</span>
                </p>

                <div className="space-y-3">
                  {form.details.map((line, idx) => {
                    const isFirst = idx === 0;
                    const canRemove = form.details.length > 2 && idx >= 2;

                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <input
                          value={line}
                          onChange={(e) => setDetailLine(idx, e.target.value)}
                          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                          placeholder={t("addresses.addressLine", { number: idx + 1, required: isFirst ? t("addresses.requiredSuffix") : "" })}
                        />

                        {/* + button only on last row */}
                        {idx === form.details.length - 1 && (
                          <button
                            type="button"
                            onClick={addDetailLine}
                            className="h-10 w-10 rounded-md border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center"
                            aria-label={t("addresses.addLine")}
                            title={t("common.add")}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        )}

                        {/* - button for address 3+ */}
                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => removeDetailLine(idx)}
                            className="h-10 w-10 rounded-md border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center"
                            aria-label={t("addresses.removeLine")}
                            title={t("common.remove")}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground">
                  {t("addresses.linesHint")} <strong>+</strong>.
                </p>
              </div>

              {/* Country */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {t("addresses.country")} <span className="text-destructive">*</span>
                </p>
                <select
                  value={countryCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setCountryCode(code);
                    const selected = countries.find((c) => c.iso2 === code);
                    setField("country", selected?.name || code);
                    setField("district", "");
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">
                    {loadingCountries
                      ? t("addresses.loadingCountries")
                      : t("addresses.selectCountry")}
                  </option>
                  {countries.map((country) => (
                    <option key={country.iso2} value={country.iso2}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* City group: District / Area */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    {t("addresses.district")} <span className="text-destructive">*</span>
                  </p>
                  {districts.length > 0 ? (
                    <select
                      value={form.district}
                      onChange={(e) => setField("district", e.target.value)}
                      disabled={loadingDistricts}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">
                        {loadingDistricts
                          ? t("addresses.loadingDistricts")
                          : t("addresses.selectDistrict")}
                      </option>
                      {districts.map((district) => (
                        <option
                          key={`${district.name}-${district.iso2 || ""}`}
                          value={district.name}
                        >
                          {district.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.district}
                      onChange={(e) => setField("district", e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder={t("addresses.districtPlaceholder")}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    {t("addresses.area")} <span className="text-destructive">*</span>
                  </p>
                  <select
                    value={form.area}
                    onChange={(e) => setField("area", e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {ALLOWED_SHIPPING_AREAS.map((areaOption) => (
                      <option key={areaOption} value={areaOption}>
                        {areaLabel(areaOption)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Default Address */}
              <div className="flex gap-4 items-center">
                <div className="text-sm font-medium flex items-center text-foreground mb-2">
                  {t("addresses.defaultAddress")}
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="isDefault"
                      checked={form.isDefault === true}
                      onChange={() => setField("isDefault", true)}
                    />
                    <span>{t("common.yes")}</span>
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="isDefault"
                      checked={form.isDefault === false}
                      onChange={() => setField("isDefault", false)}
                    />
                    <span>{t("common.no")}</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-10 px-6 rounded-md border border-border bg-background text-foreground text-sm font-semibold hover:bg-muted transition-colors"
                >
                  {t("common.cancel")}
                </button>

                <button
                  type="submit"
                  disabled={saving || requiredMissing}
                  className="h-10 px-6 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {saving
                    ? t("common.saving")
                    : editingId
                      ? t("addresses.update")
                      : t("addresses.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
