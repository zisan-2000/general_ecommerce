"use client";

import { useCallback, useEffect, useState } from "react";
import BrandManager from "@/components/management/Brands";

export interface AdminBrand {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BrandPagination {
  total: number;
  page: number;
  pages: number;
  pageSize: number;
}

export type BrandSort = "newest" | "name-asc" | "name-desc";

const EMPTY_PAGINATION: BrandPagination = {
  total: 0,
  page: 1,
  pages: 1,
  pageSize: 12,
};

export default function BrandsPage() {
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<BrandSort>("newest");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      paginated: "true",
      page: String(page),
      pageSize: "12",
      sort,
    });
    if (debouncedSearch) params.set("search", debouncedSearch);

    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetch(`/api/brands?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load brands");
        }
        if (controller.signal.aborted) return;
        const nextPagination = payload?.pagination ?? EMPTY_PAGINATION;
        setBrands(Array.isArray(payload?.brands) ? payload.brands : []);
        setPagination(nextPagination);
        if (nextPagination.page !== page) setPage(nextPagination.page);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setBrands([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to load brands",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [debouncedSearch, page, revision, sort]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  const handleCreate = async (payload: { name: string; logo: string | null }) => {
    const response = await fetch("/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Create failed");
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
    refresh();
  };

  const handleUpdate = async (
    id: number,
    payload: { name: string; logo: string | null },
  ) => {
    const response = await fetch(`/api/brands/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Update failed");
    refresh();
  };

  const handleDelete = async (id: number) => {
    const response = await fetch(`/api/brands/${id}`, { method: "DELETE" });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Delete failed");
    if (brands.length === 1 && page > 1) setPage((value) => value - 1);
    else refresh();
  };

  return (
    <BrandManager
      brands={brands}
      pagination={pagination}
      search={search}
      sort={sort}
      loading={loading}
      error={error}
      onSearchChange={setSearch}
      onSortChange={setSort}
      onPageChange={setPage}
      onRetry={refresh}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  );
}
