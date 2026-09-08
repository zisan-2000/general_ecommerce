"use client";

import { useEffect, useState, useCallback, memo } from "react";
import CategoryManager from "@/components/management/CategoryManager";

interface Category {
  id: number;
  name: string;
  slug?: string;
  image?: string | null;
  parentId: number | null;
  parentName?: string | null;
  productCount?: number;
  childrenCount?: number;
  isActive: boolean;
  sortOrder: number;
  showInHeader: boolean;
  showInFooter: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CategoryNavigationPayload {
  isActive?: boolean;
  sortOrder?: number;
  showInHeader?: boolean;
  showInFooter?: boolean;
  featured?: boolean;
}

interface CategoryCreatePayload extends CategoryNavigationPayload {
  name: string;
  parentId?: number | null;
  image?: string | null;
}

interface CategoryUpdatePayload extends CategoryNavigationPayload {
  name?: string;
  parentId?: number | null;
  image?: string | null;
}

const CategoriesPage = memo(function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/categories", { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message =
          (data && typeof (data as any).error === "string" && (data as any).error) ||
          `Failed to fetch categories (${res.status})`;
        throw new Error(message);
      }

      setCategories(Array.isArray(data) ? (data as Category[]) : []);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async (payload: CategoryCreatePayload) => {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const message =
        (data && typeof (data as any).error === "string" && (data as any).error) ||
        `Create failed (${res.status})`;
      throw new Error(message);
    }

    await fetchCategories();
  };

  const handleUpdate = async (id: number, payload: CategoryUpdatePayload) => {
    const res = await fetch(`/api/categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const message =
        (data && typeof (data as any).error === "string" && (data as any).error) ||
        `Update failed (${res.status})`;
      throw new Error(message);
    }

    await fetchCategories();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const message =
        (data && typeof (data as any).error === "string" && (data as any).error) ||
        `Delete failed (${res.status})`;
      throw new Error(message);
    }

    await fetchCategories();
  };

  return (
    <CategoryManager
      categories={categories}
      loading={loading}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  );
});

export default CategoriesPage;
