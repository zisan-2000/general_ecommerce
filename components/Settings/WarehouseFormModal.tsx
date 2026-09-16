"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import WarehouseLocationPicker from "@/components/Settings/WarehouseLocationPicker";
import { Warehouse, type WarehouseForm } from "@/lib/types/warehouse";

type CountryOption = {
  name: string;
  iso2: string;
};

type DivisionOption = {
  name: string;
  iso2: string;
};

type DistrictOption = {
  id?: number | string;
  name: string;
};

const BANGLADESH_DIVISIONS: DivisionOption[] = [
  { name: "Barishal", iso2: "A" },
  { name: "Chattogram", iso2: "B" },
  { name: "Dhaka", iso2: "C" },
  { name: "Khulna", iso2: "D" },
  { name: "Mymensingh", iso2: "H" },
  { name: "Rajshahi", iso2: "E" },
  { name: "Rangpur", iso2: "F" },
  { name: "Sylhet", iso2: "G" },
];

const BANGLADESH_DISTRICTS_BY_DIVISION: Record<string, string[]> = {
  A: ["Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"],
  B: [
    "Bandarban",
    "Brahmanbaria",
    "Chandpur",
    "Chattogram",
    "Cumilla",
    "Cox's Bazar",
    "Feni",
    "Khagrachhari",
    "Lakshmipur",
    "Noakhali",
    "Rangamati",
  ],
  C: [
    "Dhaka",
    "Faridpur",
    "Gazipur",
    "Gopalganj",
    "Kishoreganj",
    "Madaripur",
    "Manikganj",
    "Munshiganj",
    "Narayanganj",
    "Narsingdi",
    "Rajbari",
    "Shariatpur",
    "Tangail",
  ],
  D: [
    "Bagerhat",
    "Chuadanga",
    "Jashore",
    "Jhenaidah",
    "Khulna",
    "Kushtia",
    "Magura",
    "Meherpur",
    "Narail",
    "Satkhira",
  ],
  E: [
    "Bogura",
    "Joypurhat",
    "Naogaon",
    "Natore",
    "Chapai Nawabganj",
    "Pabna",
    "Rajshahi",
    "Sirajganj",
  ],
  F: [
    "Dinajpur",
    "Gaibandha",
    "Kurigram",
    "Lalmonirhat",
    "Nilphamari",
    "Panchagarh",
    "Rangpur",
    "Thakurgaon",
  ],
  G: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
  H: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
};

interface WarehouseFormModalProps {
  onClose: () => void;
  refresh: () => void;
  editingWarehouse?: Warehouse | null;
}

export default function WarehouseFormModal({
  onClose,
  refresh,
  editingWarehouse,
}: WarehouseFormModalProps) {
  const t = useTranslations("AdminWarehouseFormModal");

  const [form, setForm] = useState<WarehouseForm>({
    name: "",
    code: "",
    address: "",
    isDefault: false,
    country: "BD",
    division: "",
    district: "",
    area: "",
    postCode: "",
    latitude: "",
    longitude: "",
    mapLabel: "",
    coverageRadiusKm: "",
    locationNote: "",
    isMapEnabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    fetchCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (form.division && form.country) {
      fetchDistricts(form.country, form.division, true);
    } else {
      setDistricts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.division, form.country]);

  useEffect(() => {
    if (editingWarehouse) {
      setForm({
        name: editingWarehouse.name,
        code: editingWarehouse.code,
        address: editingWarehouse.address?.location || "",
        isDefault: editingWarehouse.isDefault,
        country: editingWarehouse.country || "BD",
        division: editingWarehouse.division || "",
        district: editingWarehouse.district || "",
        area: editingWarehouse.area || "",
        postCode: editingWarehouse.postCode || "",
        latitude: editingWarehouse.latitude?.toString() || "",
        longitude: editingWarehouse.longitude?.toString() || "",
        mapLabel: editingWarehouse.mapLabel || "",
        coverageRadiusKm: editingWarehouse.coverageRadiusKm?.toString() || "",
        locationNote: editingWarehouse.locationNote || "",
        isMapEnabled: editingWarehouse.isMapEnabled ?? true,
      });

      if (editingWarehouse.country) {
        fetchDivisions(editingWarehouse.country, true);
      }
    } else {
      setForm({
        name: "",
        code: "",
        address: "",
        isDefault: false,
        country: "BD",
        division: "",
        district: "",
        area: "",
        postCode: "",
        latitude: "",
        longitude: "",
        mapLabel: "",
        coverageRadiusKm: "",
        locationNote: "",
        isMapEnabled: true,
      });
      if (countries.length > 0) {
        fetchDivisions("BD", true);
      }
    }
    setError(null);
    setSuccess(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingWarehouse, countries.length]);

  const fetchCountries = async () => {
    try {
      setLoadingLocations(true);
      setLocationError(null);

      const response = await fetch("/api/geo/countries", { cache: "no-store" });
      if (!response.ok) throw new Error(t("errors.loadCountries"));
      const data = await response.json();
      setCountries(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("errors.loadCountries");
      setLocationError(errorMessage);
      console.error("Error fetching countries:", err);
    } finally {
      setLoadingLocations(false);
    }
  };

  const fetchDivisions = async (
    countryCode: string,
    preserveSelection = false,
  ) => {
    try {
      setLoadingLocations(true);
      setLocationError(null);

      if (countryCode === "BD") {
        setDivisions(BANGLADESH_DIVISIONS);
        setDistricts([]);
        if (!preserveSelection) {
          setForm((prev) => ({ ...prev, division: "", district: "" }));
        }
        return;
      }

      const response = await fetch(`/api/geo/countries/${countryCode}/states`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(t("errors.loadDivisions"));
      const data = await response.json();
      setDivisions(data);
      setDistricts([]);
      if (!preserveSelection) {
        setForm((prev) => ({ ...prev, division: "", district: "" }));
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("errors.loadDivisions");
      setLocationError(errorMessage);
      console.error("Error fetching divisions:", err);
    } finally {
      setLoadingLocations(false);
    }
  };

  const fetchDistricts = async (
    countryCode: string,
    divisionCode: string,
    preserveSelection = false,
  ) => {
    try {
      setLoadingLocations(true);
      setLocationError(null);

      if (countryCode === "BD") {
        const districtList =
          BANGLADESH_DISTRICTS_BY_DIVISION[divisionCode] || [];
        setDistricts(districtList.map((name) => ({ name })));
        if (!preserveSelection) {
          setForm((prev) => ({ ...prev, district: "" }));
        }
        return;
      }

      const response = await fetch(
        `/api/geo/countries/${countryCode}/states/${divisionCode}/cities`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(t("errors.loadDistricts"));
      const data = await response.json();
      setDistricts(data);
      if (!preserveSelection) {
        setForm((prev) => ({ ...prev, district: "" }));
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("errors.loadDistricts");
      setLocationError(errorMessage);
      console.error("Error fetching districts:", err);
    } finally {
      setLoadingLocations(false);
    }
  };

  const isEditing = !!editingWarehouse;
  const latitudeNumber = Number.parseFloat(form.latitude);
  const longitudeNumber = Number.parseFloat(form.longitude);
  const coverageRadiusNumber = Number.parseFloat(form.coverageRadiusKm);
  const hasValidCoordinates =
    Number.isFinite(latitudeNumber) && Number.isFinite(longitudeNumber);

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
      <div className="card-theme p-6 rounded-lg w-[70vw] border shadow-lg max-h-[80vh] overflow-y-auto">
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
              {t("fields.code")}
            </label>
            <input
              placeholder={t("placeholders.code")}
              className="input-theme border p-2 rounded w-full"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {t("fields.address")}
            </label>
            <input
              placeholder={t("placeholders.address")}
              className="input-theme border p-2 rounded w-full"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">{t("location.title")}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("location.country")}
                </label>
                <select
                  className="input-theme border p-2 rounded w-full"
                  value={form.country}
                  onChange={(e) => {
                    const newCountry = e.target.value;
                    setForm({
                      ...form,
                      country: newCountry,
                      division: "",
                      district: "",
                    });
                    if (newCountry) {
                      fetchDivisions(newCountry);
                    } else {
                      setDivisions([]);
                      setDistricts([]);
                    }
                  }}
                  disabled={loadingLocations}
                >
                  <option value="">{t("location.selectCountry")}</option>
                  {countries.map((country) => (
                    <option key={country.iso2} value={country.iso2}>
                      {country.name}
                    </option>
                  ))}
                </select>
                {loadingLocations && form.country === "" && (
                  <p className="text-xs text-gray-500 mt-1">
                    {t("location.loadingCountries")}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("location.division")}
                </label>
                <select
                  className="input-theme border p-2 rounded w-full"
                  value={form.division}
                  onChange={(e) => {
                    const newDivision = e.target.value;
                    setForm({ ...form, division: newDivision, district: "" });
                  }}
                  disabled={!form.country || loadingLocations}
                >
                  <option value="">{t("location.selectDivision")}</option>
                  {divisions.map((division) => (
                    <option key={division.iso2} value={division.iso2}>
                      {division.name}
                    </option>
                  ))}
                </select>
                {loadingLocations && form.country && (
                  <p className="text-xs text-gray-500 mt-1">
                    {t("location.loadingDivisions")}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("location.district")}
                </label>
                <select
                  className="input-theme border p-2 rounded w-full"
                  value={form.district}
                  onChange={(e) =>
                    setForm({ ...form, district: e.target.value })
                  }
                  disabled={!form.division || loadingLocations}
                >
                  <option value="">{t("location.selectDistrict")}</option>
                  {districts.map((district, index) => (
                    <option key={district.id || index} value={district.name}>
                      {district.name}
                    </option>
                  ))}
                </select>
                {loadingLocations && form.division && (
                  <p className="text-xs text-gray-500 mt-1">
                    {t("location.loadingDistricts")}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("location.area")}
                </label>
                <input
                  placeholder={t("placeholders.area")}
                  className="input-theme border p-2 rounded w-full"
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("location.postCode")}
                </label>
                <input
                  placeholder={t("placeholders.postCode")}
                  className="input-theme border p-2 rounded w-full"
                  value={form.postCode}
                  onChange={(e) =>
                    setForm({ ...form, postCode: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("location.mapLabel")}
                </label>
                <input
                  placeholder={t("placeholders.mapLabel")}
                  className="input-theme border p-2 rounded w-full"
                  value={form.mapLabel}
                  onChange={(e) =>
                    setForm({ ...form, mapLabel: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("location.latitude")}
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder={t("placeholders.latitude")}
                  className="input-theme border p-2 rounded w-full"
                  value={form.latitude}
                  onChange={(e) =>
                    setForm({ ...form, latitude: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("location.longitude")}
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder={t("placeholders.longitude")}
                  className="input-theme border p-2 rounded w-full"
                  value={form.longitude}
                  onChange={(e) =>
                    setForm({ ...form, longitude: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("location.coverageRadius")}
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder={t("placeholders.coverageRadius")}
                  className="input-theme border p-2 rounded w-full"
                  value={form.coverageRadiusKm}
                  onChange={(e) =>
                    setForm({ ...form, coverageRadiusKm: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">
                {t("location.note")}
              </label>
              <textarea
                placeholder={t("placeholders.locationNote")}
                className="input-theme border p-2 rounded w-full"
                rows={3}
                value={form.locationNote}
                onChange={(e) =>
                  setForm({ ...form, locationNote: e.target.value })
                }
              />
            </div>

            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="isMapEnabled"
                checked={form.isMapEnabled}
                onChange={(e) =>
                  setForm({ ...form, isMapEnabled: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isMapEnabled" className="text-sm font-medium">
                {t("location.showOnMap")}
              </label>
            </div>

            {form.isMapEnabled ? (
              <div className="mt-4">
                <WarehouseLocationPicker
                  latitude={hasValidCoordinates ? latitudeNumber : null}
                  longitude={hasValidCoordinates ? longitudeNumber : null}
                  readonly
                  coverageRadiusKm={
                    Number.isFinite(coverageRadiusNumber)
                      ? coverageRadiusNumber
                      : null
                  }
                  title={t("mapPreview.title")}
                  description={t("mapPreview.description")}
                  emptyMessage={t("mapPreview.emptyMessage")}
                  heightClassName="h-80"
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={form.isDefault}
              onChange={(e) =>
                setForm({ ...form, isDefault: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isDefault" className="text-sm font-medium">
              {t("fields.defaultWarehouse")}
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {locationError && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded text-sm">
              {locationError}
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
