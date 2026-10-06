"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BundleBuilderGroup, CatalogCategory, CatalogProduct, CatalogVariant } from "./ConfigurableBundleGroupBuilder";
import { appendSimpleBundleItems, bundleItemKey, type SimpleBundleChoice } from "./simple-bundle";

function defaultVariant(product: CatalogProduct) {
  return product.variants.find((variant) => variant.isDefault) ?? product.variants[0] ?? null;
}

export default function SimpleBundleBuilder({
  groups,
  onChange,
  categories,
  warehouseId,
}: {
  groups: BundleBuilderGroup[];
  onChange: (groups: BundleBuilderGroup[]) => void;
  categories: CatalogCategory[];
  warehouseId: string;
}) {
  const t = useTranslations("AdminBundles.simple");
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [selectedVariants, setSelectedVariants] = useState<Record<number, number>>({});
  const [pending, setPending] = useState<Record<number, SimpleBundleChoice>>({});
  const existingKeys = useMemo(() => new Set(groups.flatMap((group) => group.options.map(
    (option) => bundleItemKey(option.productId, option.variantId),
  ))), [groups]);
  const pendingChoices = Object.values(pending).filter(
    ({ product, variant }) => !existingKeys.has(bundleItemKey(product.id, variant?.id ?? null)),
  );

  useEffect(() => {
    if (!warehouseId) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ warehouseId, search, limit: "50" });
        if (categoryId !== "all") params.set("categoryIds", categoryId);
        const response = await fetch(`/api/admin/operations/products/bundles/search-products?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Failed to load bundle products");
        const data = await response.json();
        if (!controller.signal.aborted) setProducts(Array.isArray(data.products) ? data.products : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Failed to load simple bundle products:", error);
          setProducts([]);
          setLoadError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [categoryId, search, warehouseId, retryNonce]);

  const addSelected = () => {
    onChange(appendSimpleBundleItems(groups, pendingChoices));
    setPending({});
  };

  const changeVariant = (groupIndex: number, variant: CatalogVariant) => {
    const group = groups[groupIndex];
    const option = group.options[0];
    if (option.variantId === variant.id) return;
    if (existingKeys.has(bundleItemKey(option.productId, variant.id))) {
      toast.error(t("duplicateItem"));
      return;
    }
    onChange(groups.map((row, index) => index === groupIndex ? {
      ...row,
      options: [{ ...option, variantId: variant.id, variant }],
    } : row));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="simple-bundle-category">{t("category")}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="simple-bundle-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCategories")}</SelectItem>
                {categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="simple-bundle-search">{t("search")}</Label>
            <Input id="simple-bundle-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchPlaceholder")} />
          </div>
        </div>
        {!warehouseId ? <p className="text-sm text-muted-foreground">{t("chooseWarehouse")}</p> : loading ? (
          <p className="text-sm text-muted-foreground" role="status">{t("loading")}</p>
        ) : loadError ? (
          <div className="flex items-center justify-between gap-2" role="alert">
            <p className="text-sm text-destructive">{t("loadError")}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setRetryNonce((value) => value + 1)}><RefreshCw className="mr-2 h-4 w-4" />{t("retry")}</Button>
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {products.map((product) => {
              const variant = product.variants.find((row) => row.id === selectedVariants[product.id]) ?? defaultVariant(product);
              const stock = variant?.stock ?? product.stock;
              const key = bundleItemKey(product.id, variant?.id ?? null);
              const alreadyAdded = existingKeys.has(key);
              const unavailable = product.type === "PHYSICAL" && (!variant || stock <= 0);
              return (
                <div key={product.id} className="grid items-center gap-3 rounded-md border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <label className="flex min-w-0 items-center gap-3">
                    <Checkbox
                      checked={Boolean(pending[product.id]) && !alreadyAdded && !unavailable}
                      disabled={alreadyAdded || unavailable}
                      onCheckedChange={(checked) => {
                        if (checked === true && variant) {
                          setSelectedVariants((current) => ({ ...current, [product.id]: variant.id }));
                        }
                        setPending((current) => {
                          const next = { ...current };
                          if (checked === true) next[product.id] = { product, variant };
                          else delete next[product.id];
                          return next;
                        });
                      }}
                    />
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-medium">{product.name}</span>
                      <span className="block text-xs text-muted-foreground">{alreadyAdded ? t("alreadyAdded") : product.type === "PHYSICAL" ? t("warehouseStock", { count: stock }) : t("noStockTracking")}</span>
                    </span>
                  </label>
                  {product.variants.length > 0 ? (
                    <Select value={String(variant?.id)} onValueChange={(value) => {
                      const nextVariant = product.variants.find((row) => row.id === Number(value));
                      if (!nextVariant) return;
                      setSelectedVariants((current) => ({ ...current, [product.id]: nextVariant.id }));
                      setPending((current) => {
                        if (!current[product.id]) return current;
                        const next = { ...current };
                        if (existingKeys.has(bundleItemKey(product.id, nextVariant.id))) delete next[product.id];
                        else next[product.id] = { product, variant: nextVariant };
                        return next;
                      });
                    }}>
                      <SelectTrigger aria-label={t("variantFor", { product: product.name })}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {product.variants.map((row) => <SelectItem key={row.id} value={String(row.id)} disabled={product.type === "PHYSICAL" && row.stock <= 0}>{row.sku}{product.type === "PHYSICAL" ? ` · ${t("warehouseStock", { count: row.stock })}` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : <p className="text-xs text-muted-foreground">{t("noVariant")}</p>}
                </div>
              );
            })}
            {products.length === 0 ? <p className="p-3 text-center text-sm text-muted-foreground">{t("emptyResults")}</p> : null}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t("searchHint")}</p>
          <div className="flex gap-2">
            {pendingChoices.length > 0 ? <Button type="button" size="sm" variant="ghost" onClick={() => setPending({})}>{t("clearSelection")}</Button> : null}
            <Button type="button" size="sm" disabled={!warehouseId || pendingChoices.length === 0} onClick={addSelected}><Plus className="mr-2 h-4 w-4" />{t("addSelected", { count: pendingChoices.length })}</Button>
          </div>
        </div>
      </div>

      <p className="text-sm font-medium" aria-live="polite">{t("selectedItems", { count: groups.length })}</p>
      {groups.map((group, index) => {
        const option = group.options[0];
        const productName = option.product?.name ?? t("productNumber", { id: option.productId });
        const variants = option.product?.variants ?? [];
        const selectedVariant = option.variant ?? variants.find((variant) => variant.id === option.variantId);
        const stock = selectedVariant?.stock ?? option.product?.stock ?? 0;
        return (
          <div key={group.key} className="grid items-center gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_100px_auto]">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-semibold">{productName}</p>
              {variants.length > 0 ? (
                <Select value={option.variantId === null ? "" : String(option.variantId)} onValueChange={(value) => {
                  const variant = variants.find((row) => row.id === Number(value));
                  if (variant) changeVariant(index, variant);
                }}>
                  <SelectTrigger aria-label={t("variantFor", { product: productName })}><SelectValue placeholder={t("chooseVariant")} /></SelectTrigger>
                  <SelectContent>
                    {!variants.some((variant) => variant.id === option.variantId) && option.variantId !== null ? <SelectItem value={String(option.variantId)} disabled>{selectedVariant?.sku ?? t("variantNumber", { id: option.variantId })}</SelectItem> : null}
                    {variants.map((variant) => <SelectItem key={variant.id} value={String(variant.id)}>{variant.sku}{option.product?.type === "PHYSICAL" ? ` · ${t("warehouseStock", { count: variant.stock })}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : <p className="text-xs text-muted-foreground">{selectedVariant?.sku ?? t("noVariant")}</p>}
              <p className="text-xs text-muted-foreground">{option.product?.type === "PHYSICAL" ? t("warehouseStock", { count: stock }) : t("noStockTracking")}</p>
              {group.pricingMode === "MANUAL" ? <p className="text-xs text-muted-foreground">{t("preservedPricing")}</p> : null}
            </div>
            <div>
              <Label htmlFor={`simple-bundle-quantity-${group.key}`} className="text-xs">{t("quantity")}</Label>
              <Input id={`simple-bundle-quantity-${group.key}`} type="number" min="1" step="1" value={group.defaultQuantity || ""} onChange={(event) => {
                const quantity = Number(event.target.value);
                onChange(groups.map((row, rowIndex) => rowIndex === index ? {
                  ...row, defaultQuantity: quantity, minQuantity: quantity, maxQuantity: quantity,
                } : row));
              }} />
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" size="icon" variant="ghost" disabled={index === 0} aria-label={t("moveUp", { product: productName })} onClick={() => moveItem(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="ghost" disabled={index === groups.length - 1} aria-label={t("moveDown", { product: productName })} onClick={() => moveItem(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="ghost" className="text-destructive" aria-label={t("remove", { product: productName })} onClick={() => onChange(groups.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        );
      })}
      {groups.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t("emptyItems")}</p> : null}
    </div>
  );
}
