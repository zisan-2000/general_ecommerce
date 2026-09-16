"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  RefreshCw,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { getInventoryStatus } from "@/lib/stock-status";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import WarehouseManagerModal from "@/components/management/WarehouseManagerModal";

interface Product {
  id: number;
  name: string;
  type: "PHYSICAL" | "DIGITAL" | "SERVICE";
  lowStockThreshold: number;
  category?: { name?: string | null } | null;
  attributes?: Array<{
    id: number;
    value: string;
    attribute?: { id: number; name: string } | null;
  }>;
}

interface Warehouse {
  id: number;
  name: string;
  code: string;
  isDefault: boolean;
}

interface StockLevel {
  id: number;
  warehouseId: number;
  productVariantId: number;
  quantity: number;
  reserved: number;
  warehouse: Warehouse;
}

interface Variant {
  id: number;
  sku: string;
  price: number | string;
  currency: string;
  stock: number;
  lowStockThreshold: number;
  options?: Record<string, string>;
  stockLevels?: StockLevel[];
}

interface InventoryLog {
  id: number;
  change: number;
  reason: string;
  createdAt: string;
  variant?: { id: number; sku: string } | null;
  warehouse?: { id: number; name: string; code: string } | null;
}

interface Attribute {
  id: number;
  name: string;
}

interface AttributeValue {
  id: number;
  value: string;
  attributeId: number;
}

const StockManagementPage = memo(function StockManagementPage() {
  const t = useTranslations("AdminStockManagement");

  const detailRequestIdRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [savingVariantThreshold, setSavingVariantThreshold] = useState(false);
  const [search, setSearch] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<AttributeValue[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);

  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null,
  );
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    null,
  );
  const [selectedAttributeId, setSelectedAttributeId] = useState("");
  const [selectedAttributeValue, setSelectedAttributeValue] = useState("");
  const [stockDraft, setStockDraft] = useState<Record<number, string>>({});
  const [variantThresholdDraft, setVariantThresholdDraft] = useState("");
  const [productThresholdDraft, setProductThresholdDraft] = useState("");

  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);

  const physicalProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => p.type === "PHYSICAL")
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.category?.name || "").toLowerCase().includes(q)
        );
      });
  }, [products, search]);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((item) => item.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const selectedAttributeName = useMemo(() => {
    const id = Number(selectedAttributeId);
    if (!id || Number.isNaN(id)) return "";
    return attributes.find((item) => item.id === id)?.name || "";
  }, [attributes, selectedAttributeId]);

  const attributeValueOptions = useMemo(() => {
    return attributeValues
      .map((item) => item.value)
      .filter((value) => value?.trim())
      .sort((a, b) => a.localeCompare(b));
  }, [attributeValues]);

  const attributeValueProductCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!selectedAttributeName) return counts;

    for (const product of physicalProducts) {
      const productValues = new Set<string>();
      for (const attr of product.attributes || []) {
        if (
          attr.attribute?.name === selectedAttributeName &&
          attr.value?.trim()
        ) {
          productValues.add(attr.value.trim());
        }
      }
      for (const value of productValues) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }
    return counts;
  }, [physicalProducts, selectedAttributeName]);

  const filteredVariants = useMemo(() => {
    return variants.filter((variant) => {
      if (selectedAttributeName) {
        const optionValue = variant.options?.[selectedAttributeName];
        if (!optionValue) return false;
        if (
          selectedAttributeValue &&
          String(optionValue) !== selectedAttributeValue
        ) {
          return false;
        }
      }
      return true;
    });
  }, [variants, selectedAttributeName, selectedAttributeValue]);

  const selectedAttributeValueProductCount = useMemo(() => {
    if (!selectedAttributeValue) return 0;
    return attributeValueProductCounts.get(selectedAttributeValue) || 0;
  }, [attributeValueProductCounts, selectedAttributeValue]);

  const sortedWarehouses = useMemo(() => {
    return [...warehouses].sort((a, b) =>
      a.isDefault === b.isDefault
        ? a.name.localeCompare(b.name)
        : a.isDefault
          ? -1
          : 1,
    );
  }, [warehouses]);

  const selectedVariant = useMemo(() => {
    if (!selectedVariantId) return null;
    return filteredVariants.find((v) => v.id === selectedVariantId) || null;
  }, [selectedVariantId, filteredVariants]);

  const lowStockVariants = useMemo(() => {
    return filteredVariants.filter(
      (variant) =>
        getInventoryStatus(variant.stock, variant.lowStockThreshold) ===
        "LOW_STOCK",
    );
  }, [filteredVariants]);

  const outOfStockVariants = useMemo(() => {
    return filteredVariants.filter(
      (variant) =>
        getInventoryStatus(variant.stock, variant.lowStockThreshold) ===
        "OUT_OF_STOCK",
    );
  }, [filteredVariants]);

  const totalVariantStock = useMemo(() => {
    return filteredVariants.reduce(
      (acc, item) => acc + (Number(item.stock) || 0),
      0,
    );
  }, [filteredVariants]);

  const visibleLogs = useMemo(() => {
    if (!selectedVariantId) return logs;
    return logs.filter((log) => log.variant?.id === selectedVariantId);
  }, [logs, selectedVariantId]);

  const formatVariantOptions = (variant: Variant) => {
    if (!variant.options || typeof variant.options !== "object") return "";
    const entries = Object.entries(variant.options).filter(
      ([key, value]) =>
        key && value !== null && value !== undefined && String(value).trim(),
    );
    if (!entries.length) return "";
    return entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ");
  };

  const loadBaseData = useCallback(async () => {
    try {
      setLoading(true);
      const [pRes, wRes, aRes] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/warehouses", { cache: "no-store" }),
        fetch("/api/attributes", { cache: "no-store" }),
      ]);

      const pData = await pRes.json();
      const wData = await wRes.json();
      const aData = await aRes.json();

      setProducts(Array.isArray(pData) ? pData : []);
      setWarehouses(Array.isArray(wData) ? wData : []);
      setAttributes(Array.isArray(aData) ? aData : []);
    } catch (err) {
      toast.error(t("errors.loadStockData"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProductDetails = useCallback(async (productId: number) => {
    const requestId = ++detailRequestIdRef.current;
    try {
      setLoading(true);
      const [vRes, lRes] = await Promise.all([
        fetch(`/api/product-variants?productId=${productId}`, {
          cache: "no-store",
        }),
        fetch(`/api/inventory-logs?productId=${productId}`, {
          cache: "no-store",
        }),
      ]);

      const vData = await vRes.json();
      const lData = await lRes.json();

      const nextVariants = Array.isArray(vData) ? vData : [];
      let nextLogs = Array.isArray(lData) ? lData : [];

      if (nextLogs.length === 0 && nextVariants.length > 0) {
        const variantIds = nextVariants
          .map((variant: Variant) => variant.id)
          .join(",");
        const fallbackRes = await fetch(
          `/api/inventory-logs?variantIds=${variantIds}`,
          { cache: "no-store" },
        );
        const fallbackData = await fallbackRes.json().catch(() => []);
        nextLogs = Array.isArray(fallbackData) ? fallbackData : [];
      }

      if (requestId !== detailRequestIdRef.current) return;

      setVariants(nextVariants);
      setLogs(nextLogs);

      const firstVariantId = nextVariants[0]?.id || null;
      setSelectedVariantId((prev) =>
        prev && nextVariants.some((v: Variant) => v.id === prev)
          ? prev
          : firstVariantId,
      );
    } catch (err) {
      toast.error(t("errors.loadDetails"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (!physicalProducts.length) {
      setSelectedProductId(null);
      setVariants([]);
      setLogs([]);
      return;
    }

    setSelectedProductId((prev) =>
      prev && physicalProducts.some((p) => p.id === prev)
        ? prev
        : physicalProducts[0].id,
    );
  }, [physicalProducts]);

  useEffect(() => {
    if (!selectedProductId) return;
    void loadProductDetails(selectedProductId);
  }, [selectedProductId, loadProductDetails]);

  useEffect(() => {
    if (!selectedAttributeId) {
      setAttributeValues([]);
      return;
    }

    const loadAttributeValues = async () => {
      try {
        const res = await fetch(
          `/api/attributes/${selectedAttributeId}/values`,
          { cache: "no-store" },
        );
        const data = await res.json();
        setAttributeValues(Array.isArray(data) ? data : []);
      } catch {
        setAttributeValues([]);
      }
    };

    void loadAttributeValues();
  }, [selectedAttributeId]);

  useEffect(() => {
    if (
      selectedAttributeId &&
      !attributes.some((attr) => String(attr.id) === selectedAttributeId)
    ) {
      setSelectedAttributeId("");
      setSelectedAttributeValue("");
    }
  }, [attributes, selectedAttributeId]);

  useEffect(() => {
    if (
      selectedAttributeValue &&
      !attributeValueOptions.includes(selectedAttributeValue)
    ) {
      setSelectedAttributeValue("");
    }
  }, [attributeValueOptions, selectedAttributeValue]);

  useEffect(() => {
    if (!filteredVariants.length) {
      setSelectedVariantId(null);
      return;
    }
    setSelectedVariantId((prev) =>
      prev && filteredVariants.some((variant) => variant.id === prev)
        ? prev
        : filteredVariants[0].id,
    );
  }, [filteredVariants]);

  useEffect(() => {
    if (!selectedVariant) {
      setStockDraft({});
      setVariantThresholdDraft("");
      return;
    }

    const nextDraft: Record<number, string> = {};
    for (const warehouse of sortedWarehouses) {
      const level = selectedVariant.stockLevels?.find(
        (entry) => entry.warehouseId === warehouse.id,
      );
      nextDraft[warehouse.id] = String(level?.quantity ?? 0);
    }
    setStockDraft(nextDraft);
    setVariantThresholdDraft(String(selectedVariant.lowStockThreshold ?? 10));
  }, [selectedVariant, sortedWarehouses]);

  useEffect(() => {
    setProductThresholdDraft(
      selectedProduct ? String(selectedProduct.lowStockThreshold ?? 10) : "",
    );
  }, [selectedProduct]);

  const refreshAll = async () => {
    await loadBaseData();
    if (selectedProductId) {
      await loadProductDetails(selectedProductId);
    }
  };

  const saveStockLevel = async (warehouseId: number) => {
    if (!selectedVariant || !selectedProductId) return;

    const quantity = Number(stockDraft[warehouseId] ?? "0");
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error(t("errors.quantityInvalid"));
      return;
    }

    try {
      setSaving((prev) => ({ ...prev, [warehouseId]: true }));
      const res = await fetch("/api/stock-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId,
          productVariantId: selectedVariant.id,
          quantity,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.saveFailed"));

      toast.success(t("success.stockSaved"));
      await loadProductDetails(selectedProductId);
    } catch (err: any) {
      toast.error(err?.message || t("errors.saveStockFailed"));
    } finally {
      setSaving((prev) => ({ ...prev, [warehouseId]: false }));
    }
  };

  const saveProductThreshold = async () => {
    if (!selectedProductId) return;

    const lowStockThreshold = Number(productThresholdDraft);
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      toast.error(t("errors.thresholdInvalid"));
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/products/${selectedProductId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockThreshold }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.saveFailed"));

      toast.success(t("success.productThresholdSaved"));
      await refreshAll();
    } catch (err: any) {
      toast.error(err?.message || t("errors.saveProductThresholdFailed"));
    } finally {
      setLoading(false);
    }
  };

  const saveVariantThreshold = async () => {
    if (!selectedVariant || !selectedProductId) return;

    const lowStockThreshold = Number(variantThresholdDraft);
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      toast.error(t("errors.thresholdInvalid"));
      return;
    }

    try {
      setSavingVariantThreshold(true);
      const res = await fetch(`/api/product-variants/${selectedVariant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockThreshold }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.saveFailed"));

      toast.success(t("success.variantThresholdSaved"));
      await loadProductDetails(selectedProductId);
    } catch (err: any) {
      toast.error(err?.message || t("errors.saveVariantThresholdFailed"));
    } finally {
      setSavingVariantThreshold(false);
    }
  };

  const clearStockLevel = async (stockLevelId: number) => {
    if (!selectedProductId) return;
    if (!confirm(t("confirm.deleteStockLevel"))) return;

    try {
      const res = await fetch(`/api/stock-levels/${stockLevelId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.deleteFailed"));

      toast.success(t("success.stockDeleted"));
      await loadProductDetails(selectedProductId);
    } catch (err: any) {
      toast.error(err?.message || t("errors.deleteStockFailed"));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setWarehouseModalOpen(true)}>
            <WarehouseIcon className="h-4 w-4 mr-1" />
            {t("actions.warehouses")}
          </Button>
          <Button variant="outline" onClick={refreshAll} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" />
            {t("actions.refresh")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Label>{t("filters.searchLabel")}</Label>
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <Label>{t("filters.productLabel")}</Label>
            <select
              className="w-full border rounded-md px-3 py-2 bg-background"
              value={selectedProductId ?? ""}
              onChange={(e) => {
                const nextProductId = e.target.value
                  ? Number(e.target.value)
                  : null;
                setSelectedProductId(nextProductId);
                setSelectedAttributeId("");
                setSelectedAttributeValue("");
                setSelectedVariantId(null);
              }}
            >
              <option value="">{t("filters.selectProduct")}</option>
              {physicalProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="stock-summary-card-physical-products">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t("stats.physicalProducts")}
            </p>
            <p className="text-2xl font-semibold">
              {loading ? (
                <span className="inline-block h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                physicalProducts.length
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="stock-summary-card-variants">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t("stats.variants")}
            </p>
            <p className="text-2xl font-semibold">
              {loading ? (
                <span className="inline-block h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                filteredVariants.length
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="stock-summary-card-total-stock">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t("stats.totalVariantStock")}
            </p>
            <p className="text-2xl font-semibold">
              {loading ? (
                <span className="inline-block h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                totalVariantStock
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="stock-summary-card-low-stock">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t("stats.lowStockVariants")}
            </p>
            <p className="text-2xl font-semibold">
              {loading ? (
                <span className="inline-block h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                lowStockVariants.length
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="stock-summary-card-out-of-stock col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t("stats.outOfStockVariants")}
            </p>
            <p className="text-2xl font-semibold">
              {loading ? (
                <span className="inline-block h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                outOfStockVariants.length
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{t("warehouseStock.title")}</p>
              </div>
              <div className="flex flex-col md:flex-row gap-2 items-center justify-between">
                <Label>{t("warehouseStock.attributeLabel")}</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 bg-background mb-2"
                  value={selectedAttributeId}
                  onChange={(e) => {
                    setSelectedAttributeId(e.target.value);
                    setSelectedAttributeValue("");
                  }}
                >
                  <option value="">{t("warehouseStock.allAttributes")}</option>
                  {attributes.map((attribute) => (
                    <option key={attribute.id} value={attribute.id}>
                      {attribute.name}
                    </option>
                  ))}
                </select>

                <Label>{t("warehouseStock.attributeValueLabel")}</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 bg-background mb-2"
                  value={selectedAttributeValue}
                  onChange={(e) => setSelectedAttributeValue(e.target.value)}
                  disabled={!selectedAttributeId}
                >
                  <option value="">{t("warehouseStock.allValues")}</option>
                  {attributeValueOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                      {selectedAttributeName
                        ? t("warehouseStock.valueProductCount", {
                            count: attributeValueProductCounts.get(value) || 0,
                          })
                        : ""}
                    </option>
                  ))}
                </select>

                <Label>{t("warehouseStock.variantLabel")}</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 bg-background"
                  value={selectedVariantId ?? ""}
                  onChange={(e) =>
                    setSelectedVariantId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                >
                  <option value="">{t("warehouseStock.selectVariant")}</option>
                  {filteredVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.sku} ({variant.currency} {String(variant.price)})
                      {formatVariantOptions(variant)
                        ? ` - ${formatVariantOptions(variant)}`
                        : ""}
                    </option>
                  ))}
                </select>
                {selectedAttributeName && selectedAttributeValue && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("warehouseStock.productCountInfo", {
                      count: selectedAttributeValueProductCount,
                      name: selectedAttributeName,
                      value: selectedAttributeValue,
                      productSuffix: selectedProduct
                        ? t("warehouseStock.productIncluded", {
                            name: selectedProduct.name,
                          })
                        : "",
                    })}
                  </p>
                )}
              </div>
            </div>

            {!selectedVariant ? (
              <p className="text-sm text-muted-foreground">
                {t("warehouseStock.selectHint")}
              </p>
            ) : (
              <div className="grid gap-4 grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="font-medium">
                    {t("thresholds.productThreshold")}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={productThresholdDraft}
                      onChange={(e) => setProductThresholdDraft(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      onClick={saveProductThreshold}
                      disabled={loading || !selectedProduct}
                    >
                      {t("actions.save")}
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="font-medium">
                    {t("thresholds.variantThreshold")}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={variantThresholdDraft}
                      onChange={(e) => setVariantThresholdDraft(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      onClick={saveVariantThreshold}
                      disabled={loading || savingVariantThreshold}
                    >
                      {savingVariantThreshold
                        ? t("actions.saving")
                        : t("actions.save")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {selectedVariant && loading ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {t("warehouseStock.table.warehouse")}
                      </TableHead>
                      <TableHead>
                        {t("warehouseStock.table.quantity")}
                      </TableHead>
                      <TableHead>
                        {t("warehouseStock.table.reserved")}
                      </TableHead>
                      <TableHead>
                        {t("warehouseStock.table.available")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("warehouseStock.table.action")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(5)].map((_, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                        </TableCell>
                        <TableCell>
                          <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                            <div className="h-8 w-12 bg-muted animate-pulse rounded" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : sortedWarehouses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("warehouseStock.noWarehouses")}
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {t("warehouseStock.table.warehouse")}
                      </TableHead>
                      <TableHead>
                        {t("warehouseStock.table.quantity")}
                      </TableHead>
                      <TableHead>
                        {t("warehouseStock.table.reserved")}
                      </TableHead>
                      <TableHead>
                        {t("warehouseStock.table.available")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("warehouseStock.table.action")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedWarehouses.map((warehouse) => {
                      const level =
                        selectedVariant?.stockLevels?.find(
                          (entry) => entry.warehouseId === warehouse.id,
                        ) || null;
                      const reserved = Number(level?.reserved || 0);
                      const quantity = Number(stockDraft[warehouse.id] || 0);
                      const available = Math.max(0, quantity - reserved);

                      return (
                        <TableRow key={warehouse.id}>
                          <TableCell>
                            <div className="font-medium">
                              {warehouse.name} ({warehouse.code})
                            </div>
                            {warehouse.isDefault && (
                              <div className="text-xs text-muted-foreground">
                                {t("warehouseStock.defaultBadge")}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-28"
                              value={stockDraft[warehouse.id] ?? "0"}
                              onChange={(e) =>
                                setStockDraft((prev) => ({
                                  ...prev,
                                  [warehouse.id]: e.target.value,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>{reserved}</TableCell>
                          <TableCell>{available}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => saveStockLevel(warehouse.id)}
                                disabled={!!saving[warehouse.id] || loading}
                              >
                                {saving[warehouse.id]
                                  ? t("actions.saving")
                                  : t("actions.save")}
                              </Button>
                              {level && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                                  onClick={() => clearStockLevel(level.id)}
                                  disabled={loading}
                                >
                                  {t("actions.clear")}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="font-semibold">{t("variantSummary.title")}</p>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded mb-2" />
                    <div className="h-3 w-32 bg-muted animate-pulse rounded mb-1" />
                    <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : filteredVariants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("variantSummary.empty")}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredVariants.map((variant) => {
                  const status = getInventoryStatus(
                    variant.stock,
                    variant.lowStockThreshold,
                  );
                  const isLow = status === "LOW_STOCK";
                  const isOut = status === "OUT_OF_STOCK";
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`w-full border rounded-lg p-3 text-left transition-all duration-200 ${
                        selectedVariantId === variant.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/50 hover:bg-accent/50"
                      }`}
                    >
                      <p className="font-medium">{variant.sku}</p>
                      {formatVariantOptions(variant) && (
                        <p className="text-xs text-muted-foreground">
                          {formatVariantOptions(variant)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {t("variantSummary.stockLabel", {
                          count: variant.stock,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("variantSummary.emergencyStockLabel", {
                          count: variant.lowStockThreshold,
                        })}
                      </p>
                      {isLow && (
                        <p className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t("variantSummary.lowStock")}
                        </p>
                      )}
                      {isOut && (
                        <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t("variantSummary.outOfStock")}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="font-semibold">{t("logs.title")}</p>
          {loading ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("logs.table.date")}</TableHead>
                    <TableHead>{t("logs.table.change")}</TableHead>
                    <TableHead>{t("logs.table.variant")}</TableHead>
                    <TableHead>{t("logs.table.warehouse")}</TableHead>
                    <TableHead>{t("logs.table.reason")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-8 bg-muted animate-pulse rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : visibleLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {selectedVariantId
                ? t("logs.emptyVariant")
                : t("logs.emptyProduct")}
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[640px] md:min-w-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">
                          {t("logs.table.date")}
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          {t("logs.table.change")}
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          {t("logs.table.variant")}
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          {t("logs.table.warehouse")}
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          {t("logs.table.reason")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {String(log.createdAt)
                              .replace("T", " ")
                              .slice(0, 19)}
                          </TableCell>
                          <TableCell
                            className={`whitespace-nowrap font-medium ${
                              log.change > 0
                                ? "text-green-600 dark:text-green-400"
                                : log.change < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : ""
                            }`}
                          >
                            {log.change > 0 ? `+${log.change}` : log.change}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {log.variant?.sku || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {log.warehouse?.code || "-"}
                          </TableCell>
                          <TableCell className="min-w-[200px] max-w-[300px]">
                            <p className="truncate" title={log.reason}>
                              {log.reason}
                            </p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {warehouseModalOpen && (
        <WarehouseManagerModal
          open={warehouseModalOpen}
          onClose={() => {
            setWarehouseModalOpen(false);
            void refreshAll();
          }}
        />
      )}
    </div>
  );
});

export default StockManagementPage;
