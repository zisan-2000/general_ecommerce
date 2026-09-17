"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CatalogVariant = {
  id: number;
  sku: string;
  price: number;
  stock: number;
  isDefault: boolean;
  options: unknown;
};

type CatalogProduct = {
  id: number;
  name: string;
  image?: string | null;
  type: string;
  basePrice: number;
  defaultPrice: number;
  currency: string;
  stock: number;
  variants: CatalogVariant[];
};

type CatalogCategory = {
  id: number;
  name: string;
};

export type BundleBuilderOption = {
  productId: number;
  variantId: number | null;
  isDefault: boolean;
  priceAdjustment: number;
  product?: CatalogProduct;
  variant?: CatalogVariant | null;
};

export type BundleBuilderGroup = {
  key: string;
  name: string;
  selectionType: "FIXED" | "PRODUCT_SELECT" | "VARIANT_SELECT" | "OPTIONAL";
  required: boolean;
  minSelect: number;
  maxSelect: number;
  defaultQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  allowQuantityChange: boolean;
  options: BundleBuilderOption[];
};

let groupSequence = 0;
export const createBundleGroup = (): BundleBuilderGroup => ({
  key: `bundle-group-${Date.now()}-${++groupSequence}`,
  name: "",
  selectionType: "PRODUCT_SELECT",
  required: true,
  minSelect: 1,
  maxSelect: 1,
  defaultQuantity: 1,
  minQuantity: 1,
  maxQuantity: 1,
  allowQuantityChange: false,
  options: [],
});

export default function ConfigurableBundleGroupBuilder({
  groups,
  onChange,
  categoryIds = [],
  categories = [],
}: {
  groups: BundleBuilderGroup[];
  onChange: (groups: BundleBuilderGroup[]) => void;
  categoryIds?: string[];
  categories?: CatalogCategory[];
}) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const usableCategoryIds = useMemo(
    () => categoryIds.filter((id) => Number.isInteger(Number(id)) && Number(id) > 0),
    [categoryIds],
  );
  const categoryKey = usableCategoryIds.join(",");
  const selectedCategory = categories.find(
    (category) => String(category.id) === selectedCategoryId,
  );

  useEffect(() => {
    setSelectedCategoryId((current) =>
      usableCategoryIds.includes(current) ? current : usableCategoryIds[0] ?? "",
    );
  }, [categoryKey, usableCategoryIds]);

  useEffect(() => {
    if (!selectedCategoryId) {
      setProducts([]);
      setLoadError("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setLoadError("");
      try {
        const params = new URLSearchParams({
          search,
          categoryIds: selectedCategoryId,
          limit: "100",
        });
        const response = await fetch(`/api/admin/operations/products/bundles/search-products?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Could not load products");
        }
        setProducts(Array.isArray(data.products) ? data.products : []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Bundle product search failed", error);
          setProducts([]);
          setLoadError(error instanceof Error ? error.message : "Could not load products");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, selectedCategoryId, retryNonce]);

  const choices = useMemo(
    () => products.flatMap((product) => {
      if (product.type === "PHYSICAL" && product.variants.length === 0) return [];
      const variants = product.variants.length ? product.variants : [null];
      return variants.map((variant) => ({
        key: `${product.id}:${variant?.id ?? "default"}`,
        product,
        variant,
        label: `${product.name}${variant ? ` — ${variant.sku}` : ""} (stock ${variant?.stock ?? product.stock})`,
      }));
    }),
    [products],
  );

  const updateGroup = (index: number, patch: Partial<BundleBuilderGroup>) => {
    onChange(groups.map((group, groupIndex) => groupIndex === index ? { ...group, ...patch } : group));
  };

  const moveGroup = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= groups.length) return;
    const nextGroups = [...groups];
    [nextGroups[index], nextGroups[nextIndex]] = [nextGroups[nextIndex], nextGroups[index]];
    onChange(nextGroups);
  };

  const choicesForGroup = (group: BundleBuilderGroup) => {
    const selectedProductId = group.options[0]?.productId;
    if (group.selectionType !== "VARIANT_SELECT" || !selectedProductId) return choices;
    return choices.filter((choice) => choice.product.id === selectedProductId);
  };

  const addOption = (groupIndex: number, key: string) => {
    const group = groups[groupIndex];
    const choice = choicesForGroup(group).find((candidate) => candidate.key === key);
    if (!choice) return;
    if (group.options.some((option) => option.productId === choice.product.id && option.variantId === (choice.variant?.id ?? null))) return;
    const shouldDefault = group.selectionType !== "OPTIONAL" &&
      group.options.filter((option) => option.isDefault).length < group.minSelect;
    updateGroup(groupIndex, {
      options: [...group.options, {
        productId: choice.product.id,
        variantId: choice.variant?.id ?? null,
        isDefault: shouldDefault,
        priceAdjustment: 0,
        product: choice.product,
        variant: choice.variant,
      }],
    });
  };

  const updateOption = (groupIndex: number, optionIndex: number, patch: Partial<BundleBuilderOption>) => {
    const group = groups[groupIndex];
    let options = group.options.map((option, index) => index === optionIndex ? { ...option, ...patch } : option);
    if (patch.isDefault && group.maxSelect === 1) {
      options = options.map((option, index) => ({ ...option, isDefault: index === optionIndex }));
    }
    updateGroup(groupIndex, { options });
  };

  const removeOption = (groupIndex: number, optionIndex: number) => {
    const group = groups[groupIndex];
    let options = group.options.filter((_, index) => index !== optionIndex);
    if (group.required) {
      let defaultsNeeded = Math.max(0, group.minSelect - options.filter((option) => option.isDefault).length);
      options = options.map((option) => {
        if (!option.isDefault && defaultsNeeded > 0) {
          defaultsNeeded -= 1;
          return { ...option, isDefault: true };
        }
        return option;
      });
    }
    updateGroup(groupIndex, {
      options,
      maxSelect: Math.min(group.maxSelect, Math.max(1, options.length)),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-end">
        <div className="min-w-52">
          <Label htmlFor="bundle-catalog-category">Catalog category</Label>
          <Select
            value={selectedCategoryId}
            onValueChange={setSelectedCategoryId}
            disabled={usableCategoryIds.length === 0}
          >
            <SelectTrigger id="bundle-catalog-category" className="mt-1">
              <SelectValue placeholder="Select categories above" />
            </SelectTrigger>
            <SelectContent>
              {usableCategoryIds.map((categoryId) => {
                const category = categories.find(
                  (candidate) => String(candidate.id) === categoryId,
                );
                return (
                  <SelectItem key={categoryId} value={categoryId}>
                    {category?.name ?? `Category ${categoryId}`}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label htmlFor="bundle-choice-search">Search allowed products and variants</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="bundle-choice-search" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Product, SKU or variant" />
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange([...groups, createBundleGroup()])}>
          <Plus className="mr-2 h-4 w-4" />Add selection group
        </Button>
      </div>

      {usableCategoryIds.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Select one or more Product Categories above to load products for this bundle.
        </p>
      ) : loadError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{loadError}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setRetryNonce((value) => value + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" />Retry
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {loading
            ? `Loading products from ${selectedCategory?.name ?? "the selected category"}…`
            : `${products.length} product${products.length === 1 ? "" : "s"} available in ${selectedCategory?.name ?? "the selected category"}.`}
        </p>
      )}

      {groups.map((group, groupIndex) => (
        <Card key={group.key}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span>Group {groupIndex + 1}</span>
              <span className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label={`Move group ${groupIndex + 1} up`} disabled={groupIndex === 0} onClick={() => moveGroup(groupIndex, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label={`Move group ${groupIndex + 1} down`} disabled={groupIndex === groups.length - 1} onClick={() => moveGroup(groupIndex, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => onChange(groups.filter((_, index) => index !== groupIndex))}>
                  <Trash2 className="mr-1 h-4 w-4" />Remove
                </Button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label htmlFor={`bundle-group-name-${groupIndex}`}>Group name</Label>
                <Input id={`bundle-group-name-${groupIndex}`} value={group.name} onChange={(event) => updateGroup(groupIndex, { name: event.target.value })} placeholder="e.g. Choose your soap" />
              </div>
              <div>
                <Label htmlFor={`bundle-group-type-${groupIndex}`}>Selection type</Label>
                <Select value={group.selectionType} onValueChange={(value: BundleBuilderGroup["selectionType"]) => updateGroup(groupIndex, {
                  selectionType: value,
                  required: value === "OPTIONAL" ? false : true,
                  minSelect: value === "OPTIONAL" ? 0 : 1,
                  maxSelect: 1,
                  options: value === "FIXED"
                    ? group.options.slice(0, 1).map((option) => ({ ...option, isDefault: true }))
                    : value === "VARIANT_SELECT"
                      ? group.options
                          .filter((option) => option.productId === group.options[0]?.productId)
                          .map((option, index) => ({ ...option, isDefault: index === 0 }))
                      : group.options.map((option, index) => ({
                          ...option,
                          isDefault: value === "PRODUCT_SELECT" && index === 0,
                        })),
                })}>
                  <SelectTrigger id={`bundle-group-type-${groupIndex}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixed</SelectItem>
                    <SelectItem value="PRODUCT_SELECT">Product select</SelectItem>
                    <SelectItem value="VARIANT_SELECT">Variant select</SelectItem>
                    <SelectItem value="OPTIONAL">Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="flex items-center rounded border px-3 py-2 text-sm">
                <span>{group.selectionType === "OPTIONAL" ? "Optional group" : "Required group"}</span>
              </div>
              <div><Label htmlFor={`bundle-group-min-${groupIndex}`}>Min choices</Label><Input id={`bundle-group-min-${groupIndex}`} type="number" min={group.required ? 1 : 0} value={group.minSelect} disabled={group.selectionType === "FIXED" || group.selectionType === "OPTIONAL"} onChange={(event) => updateGroup(groupIndex, { minSelect: Number(event.target.value) })} /></div>
              <div><Label htmlFor={`bundle-group-max-${groupIndex}`}>Max choices</Label><Input id={`bundle-group-max-${groupIndex}`} type="number" min="1" value={group.maxSelect} disabled={group.selectionType === "FIXED"} onChange={(event) => updateGroup(groupIndex, { maxSelect: Number(event.target.value) })} /></div>
              <div><Label htmlFor={`bundle-group-default-qty-${groupIndex}`}>Default quantity</Label><Input id={`bundle-group-default-qty-${groupIndex}`} type="number" min="1" value={group.defaultQuantity} onChange={(event) => updateGroup(groupIndex, { defaultQuantity: Number(event.target.value) })} /></div>
              <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm"><Switch aria-label={`Allow customer quantity changes for group ${groupIndex + 1}`} checked={group.allowQuantityChange} onCheckedChange={(allowQuantityChange) => updateGroup(groupIndex, { allowQuantityChange, maxQuantity: allowQuantityChange ? Math.max(2, group.maxQuantity) : group.defaultQuantity, minQuantity: allowQuantityChange ? group.minQuantity : group.defaultQuantity })} />Customer quantity</label>
            </div>
            {group.allowQuantityChange ? (
              <div className="grid max-w-sm grid-cols-2 gap-3">
                <div><Label htmlFor={`bundle-group-min-qty-${groupIndex}`}>Min quantity</Label><Input id={`bundle-group-min-qty-${groupIndex}`} type="number" min="1" value={group.minQuantity} onChange={(event) => updateGroup(groupIndex, { minQuantity: Number(event.target.value) })} /></div>
                <div><Label htmlFor={`bundle-group-max-qty-${groupIndex}`}>Max quantity</Label><Input id={`bundle-group-max-qty-${groupIndex}`} type="number" min="1" value={group.maxQuantity} onChange={(event) => updateGroup(groupIndex, { maxQuantity: Number(event.target.value) })} /></div>
              </div>
            ) : null}

            <div>
              <Label htmlFor={`bundle-group-choice-${groupIndex}`}>Add an allowed choice</Label>
              <Select value="" onValueChange={(value) => addOption(groupIndex, value)} disabled={loading || Boolean(loadError) || (group.selectionType === "FIXED" && group.options.length >= 1)}>
                <SelectTrigger id={`bundle-group-choice-${groupIndex}`}><SelectValue placeholder={loading ? "Loading products…" : "Select product / exact variant"} /></SelectTrigger>
                <SelectContent>
                  {choicesForGroup(group).length > 0 ? choicesForGroup(group).map((choice) => <SelectItem key={choice.key} value={choice.key}>{choice.label}</SelectItem>) : <SelectItem value="no-products" disabled>No products found in this category</SelectItem>}
                </SelectContent>
              </Select>
              {group.selectionType === "VARIANT_SELECT" && group.options[0] ? <p className="mt-1 text-xs text-muted-foreground">Only variants of {group.options[0].product?.name ?? `product #${group.options[0].productId}`} can be added to this group.</p> : null}
            </div>

            <div className="space-y-2">
              {group.options.map((option, optionIndex) => (
                <div key={`${option.productId}:${option.variantId ?? "default"}`} className="grid items-center gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_130px_120px_40px]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{option.product?.name ?? `Product #${option.productId}`}</p>
                    <p className="truncate text-xs text-muted-foreground">{option.variant?.sku ?? "Default variant"}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs"><Switch aria-label={`Use choice ${optionIndex + 1} as a default in group ${groupIndex + 1}`} checked={option.isDefault} disabled={group.selectionType === "FIXED"} onCheckedChange={(isDefault) => updateOption(groupIndex, optionIndex, { isDefault })} />Default</label>
                  <div><Label htmlFor={`bundle-option-price-${groupIndex}-${optionIndex}`} className="text-xs">Price +/−</Label><Input id={`bundle-option-price-${groupIndex}-${optionIndex}`} type="number" step="0.01" value={option.priceAdjustment} onChange={(event) => updateOption(groupIndex, optionIndex, { priceAdjustment: Number(event.target.value) })} /></div>
                  <Button type="button" size="icon" variant="ghost" className="text-destructive" aria-label={`Remove choice ${optionIndex + 1} from group ${groupIndex + 1}`} onClick={() => removeOption(groupIndex, optionIndex)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {group.options.length === 0 ? <p className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">No allowed choices yet.</p> : null}
            </div>
          </CardContent>
        </Card>
      ))}
      {groups.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Add at least two groups to create a bundle.</p> : null}
    </div>
  );
}
