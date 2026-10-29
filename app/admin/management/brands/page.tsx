"use client";

import { useEffect, useState, useCallback, memo } from "react";
import BrandManager from "@/components/management/Brands";

const BrandsPage = memo(function BrandsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/brands", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load brands");
      }
      setBrands(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const handleCreate = async (payload: any) => {
    const res = await fetch("/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Create failed");
    await fetchBrands();
  };

  const handleUpdate = async (id: number, payload: any) => {
    const res = await fetch(`/api/brands/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Update failed");
    await fetchBrands();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/brands/${id}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Delete failed");
    await fetchBrands();
  };

  return (
    <BrandManager
      brands={brands}
      loading={loading}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  );
});

export default BrandsPage;
