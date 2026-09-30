"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import ProductManager from "@/components/management/ProductManager";
import { clearCachedFetch } from "@/lib/client-cache-fetch";

interface Product {
  id: number;
  name: string;
  description?: string;
  shortDesc?: string | null;
  basePrice: number;
  originalPrice?: number;
  currency?: string;
  type?: "PHYSICAL" | "DIGITAL" | "SERVICE";
  sku?: string | null;
  model?: string | null;
  warranty?: string | null;
  weight?: number | null;
  dimensions?: any;
  VatClassId?: number | null;
  digitalAssetId?: number | null;
  serviceDurationMinutes?: number | null;
  serviceLocation?: string | null;
  serviceOnlineLink?: string | null;
  image?: string;
  gallery?: string[];
  videoUrl?: string | null;
  available: boolean;
  updatedAt: string;
  featured?: boolean;
  cartReminderMinutes?: number | null;
  flashSaleEnabled?: boolean;
  flashSalePrice?: number | null;
  flashSaleStartsAt?: string | null;
  flashSaleEndsAt?: string | null;
  flashSaleSortOrder?: number;
  categoryId?: number;
  brandId?: number | null;
  category?: Category;
  brand?: Brand;
  variants?: any[];
}

interface Category {
  id: number;
  name: string;
}

interface Brand {
  id: number;
  name: string;
}

interface VatClass {
  id: number;
  name: string;
  code: string;
}

interface DigitalAsset {
  id: number;
  title: string;
}

interface ProductsPageCache {
  categories: Category[];
  brands: Brand[];
  vatClasses: VatClass[];
  digitalAssets: DigitalAsset[];
  features: ProductModuleFeatures;
}

type ProductModuleFeatures = {
  DIGITAL_PRODUCTS: boolean;
  SERVICE_PRODUCTS: boolean;
  BUNDLES: boolean;
  BOOKS: boolean;
};

const DEFAULT_PRODUCT_MODULE_FEATURES: ProductModuleFeatures = {
  DIGITAL_PRODUCTS: true,
  SERVICE_PRODUCTS: true,
  BUNDLES: true,
  BOOKS: false,
};

let productsPageCache: ProductsPageCache | null = null;

async function fetchJsonArray<T>(url: string, label: string): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error)
        : `Failed to load ${label}`,
    );
  }
  if (!Array.isArray(payload)) {
    throw new Error(`${label} response was not a list`);
  }
  return payload as T[];
}

function invalidateStorefrontProductCache() {
  clearCachedFetch("GET:/api/products");
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem("home_page_processed_data");
  }
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, pageSize: 24 });
  const [productsLoading, setProductsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const refreshProducts = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (query === null) return;
    const controller = new AbortController();
    setProductsLoading(true);
    setLoadError("");
    void (async () => {
      try {
        const response = await fetch(`/api/products?paginated=true&${query}`, {
          cache: "no-store", signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load products");
        if (controller.signal.aborted) return;
        setProducts(payload.products);
        setPagination(payload.pagination);
      } catch (error) {
        if (controller.signal.aborted) return;
        setProducts([]);
        setLoadError(error instanceof Error ? error.message : "Failed to load products");
      } finally {
        if (!controller.signal.aborted) setProductsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [query, revision]);
  const [categories, setCategories] = useState<Category[]>(
    () => productsPageCache?.categories ?? [],
  );
  const [brands, setBrands] = useState<Brand[]>(
    () => productsPageCache?.brands ?? [],
  );
  const [vatClasses, setVatClasses] = useState<VatClass[]>(
    () => productsPageCache?.vatClasses ?? [],
  );
  const [digitalAssets, setDigitalAssets] = useState<DigitalAsset[]>(
    () => productsPageCache?.digitalAssets ?? [],
  );
  const [features, setFeatures] = useState<ProductModuleFeatures>(
    () => productsPageCache?.features ?? DEFAULT_PRODUCT_MODULE_FEATURES,
  );
  const [loading, setLoading] = useState(() => !productsPageCache);

  const loadAll = useCallback(async () => {
    if (productsPageCache) {
      setCategories(productsPageCache.categories);
      setBrands(productsPageCache.brands);
      setVatClasses(productsPageCache.vatClasses);
      setDigitalAssets(productsPageCache.digitalAssets);
      setFeatures(productsPageCache.features);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const featureResponse = await fetch("/api/store-features", {
        cache: "no-store",
      });
      const featurePayload = featureResponse.ok
        ? await featureResponse.json()
        : null;
      const nextFeatures: ProductModuleFeatures = {
        DIGITAL_PRODUCTS:
          featurePayload?.features?.DIGITAL_PRODUCTS ?? true,
        SERVICE_PRODUCTS:
          featurePayload?.features?.SERVICE_PRODUCTS ?? true,
        BUNDLES: featurePayload?.features?.BUNDLES ?? true,
        BOOKS: featurePayload?.features?.BOOKS ?? false,
      };
      const [c, b, vat, da] = await Promise.all([
        fetchJsonArray<Category>("/api/categories", "categories"),
        fetchJsonArray<Brand>("/api/brands", "brands"),
        fetchJsonArray<VatClass>("/api/vat-classes", "VAT classes"),
        nextFeatures.DIGITAL_PRODUCTS
          ? fetchJsonArray<DigitalAsset>("/api/digital-assets", "digital assets")
          : Promise.resolve([]),
      ]);

      productsPageCache = {
        categories: c,
        brands: b,
        vatClasses: vat,
        digitalAssets: da,
        features: nextFeatures,
      };

      setCategories(c);
      setBrands(b);
      setVatClasses(vat);
      setDigitalAssets(da);
      setFeatures(nextFeatures);
    } catch (error) {
      console.error("Error loading products:", error);
      setProducts([]);
      setCategories([]);
      setBrands([]);
      setVatClasses([]);
      setDigitalAssets([]);
      productsPageCache = null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createProduct = useCallback(async (data: unknown) => {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Create failed");
    }

    invalidateStorefrontProductCache();
    refreshProducts();
  }, [refreshProducts]);

  const updateProduct = useCallback(async (id: number, data: unknown) => {
    const res = await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Update failed");
    }

    const updated = await res.json();

    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));

    invalidateStorefrontProductCache();
    refreshProducts();

    return updated;
  }, [refreshProducts]);

  const updateProductAvailability = useCallback(
    async (id: number, available: boolean, expectedUpdatedAt: string) => {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available, expectedUpdatedAt }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          refreshProducts();
        }

        throw new Error(
          payload?.error || "Failed to update product availability",
        );
      }

      const updated = payload as Product;
      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));

      invalidateStorefrontProductCache();
      refreshProducts();
      return updated;
    },
    [refreshProducts],
  );

  const updateProductFlashSale = useCallback((id: number, data: any) => {
    const patch = {
      flashSaleEnabled: Boolean(data.flashSaleEnabled),
      flashSalePrice:
        data.flashSalePrice === null || data.flashSalePrice === undefined
          ? null
          : Number(data.flashSalePrice),
      flashSaleStartsAt: data.flashSaleStartsAt ?? null,
      flashSaleEndsAt: data.flashSaleEndsAt ?? null,
      flashSaleSortOrder: Number(data.flashSaleSortOrder ?? 0),
      updatedAt: data.updatedAt,
    };

    setProducts((prev) =>
      prev.map((product) =>
        product.id === id ? { ...product, ...patch } : product,
      ),
    );

    invalidateStorefrontProductCache();
    refreshProducts();
  }, [refreshProducts]);

  const deleteProduct = useCallback(async (id: number) => {
    const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Delete failed");
    }

    setProducts((prev) => prev.filter((p) => p.id !== id));

    invalidateStorefrontProductCache();
    refreshProducts();
  }, [refreshProducts]);

  const memoizedProducts = useMemo(() => products, [products]);
  const memoizedCategories = useMemo(() => categories, [categories]);
  const memoizedBrands = useMemo(() => brands, [brands]);
  const memoizedVatClasses = useMemo(() => vatClasses, [vatClasses]);
  const memoizedDigitalAssets = useMemo(() => digitalAssets, [digitalAssets]);

  return (
    <div className="min-h-screen bg-background">
      {loadError && <div role="alert" className="p-4 text-destructive">
        {loadError} <button type="button" onClick={refreshProducts}>Retry</button>
      </div>}
      <ProductManager
        products={memoizedProducts}
        categories={memoizedCategories}
        brands={memoizedBrands}
        vatClasses={memoizedVatClasses}
        digitalAssets={memoizedDigitalAssets}
        features={features}
        loading={loading || productsLoading}
        pagination={pagination}
        onQueryChange={setQuery}
        onCreate={createProduct}
        onUpdate={updateProduct}
        onAvailabilityChange={updateProductAvailability}
        onFlashSaleChange={updateProductFlashSale}
        onDelete={deleteProduct}
      />
    </div>
  );
}
