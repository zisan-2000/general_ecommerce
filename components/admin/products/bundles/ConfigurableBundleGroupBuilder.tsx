"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
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

type CatalogCategory = { id: number; name: string };

type CatalogChoice = {
  key: string;
  product: CatalogProduct;
  variant: CatalogVariant | null;
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
  pricingMode: "AUTOMATIC" | "MANUAL";
  catalogCategoryId: string;
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
export const createBundleGroup = (catalogCategoryId = ""): BundleBuilderGroup => ({
  key: `bundle-group-${Date.now()}-${++groupSequence}`,
  name: "",
  selectionType: "PRODUCT_SELECT",
  pricingMode: "AUTOMATIC",
  catalogCategoryId,
  required: true,
  minSelect: 1,
  maxSelect: 1,
  defaultQuantity: 1,
  minQuantity: 1,
  maxQuantity: 1,
  allowQuantityChange: false,
  options: [],
});

const money = (value: number, currency: string) =>
  currency.toUpperCase() === "BDT"
    ? `৳${Math.round(value).toLocaleString("en-US")}`
    : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

function GroupCatalogPicker({
  group,
  groupIndex,
  categories,
  defaultCategoryId,
  onCategoryChange,
  onAdd,
}: {
  group: BundleBuilderGroup;
  groupIndex: number;
  categories: CatalogCategory[];
  defaultCategoryId: string;
  onCategoryChange: (categoryId: string) => void;
  onAdd: (choice: CatalogChoice) => void;
}) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const categoryId = group.catalogCategoryId || defaultCategoryId;

  useEffect(() => {
    if (!categoryId) {
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
        const params = new URLSearchParams({ search, categoryIds: categoryId, limit: "100" });
        const response = await fetch(
          `/api/admin/operations/products/bundles/search-products?${params}`,
          { signal: controller.signal },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load products");
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
  }, [categoryId, retryNonce, search]);

  const choices = useMemo(() => {
    const selectedProductId = group.options[0]?.productId;
    return products.flatMap((product) => {
      if (product.type === "PHYSICAL" && product.variants.length === 0) return [];
      if (
        group.selectionType === "VARIANT_SELECT" &&
        selectedProductId &&
        product.id !== selectedProductId
      ) return [];
      const variants = product.variants.length ? product.variants : [null];
      return variants.map((variant) => ({
        key: `${product.id}:${variant?.id ?? "default"}`,
        product,
        variant,
      }));
    });
  }, [group.options, group.selectionType, products]);

  const selectedKeys = new Set(
    group.options.map((option) => `${option.productId}:${option.variantId ?? "default"}`),
  );
  const categoryName = categories.find((category) => String(category.id) === categoryId)?.name;
  const fixedComplete = group.selectionType === "FIXED" && group.options.length >= 1;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <Label htmlFor={`bundle-group-category-${groupIndex}`}>Product category</Label>
          <Select value={categoryId} onValueChange={onCategoryChange}>
            <SelectTrigger id={`bundle-group-category-${groupIndex}`} className="mt-1">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`bundle-group-search-${groupIndex}`}>Find products or variants</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`bundle-group-search-${groupIndex}`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="Search product name, SKU or variant"
              disabled={!categoryId || fixedComplete}
            />
          </div>
        </div>
      </div>

      {!categoryId ? (
        <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
          Choose a category for this group to browse eligible products.
        </p>
      ) : loadError ? (
        <div className="flex items-center justify-between gap-2 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{loadError}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setRetryNonce((value) => value + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" />Retry
          </Button>
        </div>
      ) : fixedComplete ? (
        <p className="text-xs text-muted-foreground">A fixed group already has its one allowed product.</p>
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground" aria-live="polite">
            <span>{loading ? "Loading products…" : `${choices.length} eligible choice${choices.length === 1 ? "" : "s"}`}</span>
            <span>{categoryName ?? "Selected category"}</span>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {!loading && choices.length === 0 ? (
              <p className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">No eligible products found.</p>
            ) : null}
            {choices.map((choice) => {
              const selected = selectedKeys.has(choice.key);
              const stock = choice.variant?.stock ?? choice.product.stock;
              const price = choice.variant?.price ?? choice.product.defaultPrice;
              return (
                <div key={choice.key} className="flex items-center gap-3 rounded-md border bg-background p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{choice.product.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {choice.variant?.sku ?? "Default product"} · Stock {stock} · {money(price, choice.product.currency)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={selected ? "secondary" : "outline"}
                    disabled={selected || stock <= 0}
                    onClick={() => onAdd(choice)}
                  >
                    {selected ? <Check className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
                    {selected ? "Added" : stock > 0 ? "Add" : "Out of stock"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {group.selectionType === "VARIANT_SELECT" && group.options[0] ? (
        <p className="text-xs text-muted-foreground">
          Locked to {group.options[0].product?.name ?? `product #${group.options[0].productId}`}; only its variants can be added.
        </p>
      ) : null}
    </div>
  );
}

export default function ConfigurableBundleGroupBuilder({
  groups,
  onChange,
  defaultCategoryId = "",
  categories = [],
}: {
  groups: BundleBuilderGroup[];
  onChange: (groups: BundleBuilderGroup[]) => void;
  defaultCategoryId?: string;
  categories?: CatalogCategory[];
}) {
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

  const addOption = (groupIndex: number, choice: CatalogChoice) => {
    const group = groups[groupIndex];
    if (group.options.some((option) => option.productId === choice.product.id && option.variantId === (choice.variant?.id ?? null))) return;
    const shouldDefault = group.selectionType !== "OPTIONAL" && group.options.filter((option) => option.isDefault).length < group.minSelect;
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
    updateGroup(groupIndex, { options, maxSelect: Math.min(group.maxSelect, Math.max(1, options.length)) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Bundle selection groups</p>
          <p className="text-xs text-muted-foreground">Each group has its own category, product search and pricing rule.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange([...groups, createBundleGroup(defaultCategoryId)])}>
          <Plus className="mr-2 h-4 w-4" />Add selection group
        </Button>
      </div>

      {groups.map((group, groupIndex) => (
        <Card key={group.key}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span>Group {groupIndex + 1}{group.name ? ` · ${group.name}` : ""}</span>
              <span className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label={`Move group ${groupIndex + 1} up`} disabled={groupIndex === 0} onClick={() => moveGroup(groupIndex, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label={`Move group ${groupIndex + 1} down`} disabled={groupIndex === groups.length - 1} onClick={() => moveGroup(groupIndex, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => onChange(groups.filter((_, index) => index !== groupIndex))}><Trash2 className="mr-1 h-4 w-4" />Remove</Button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label htmlFor={`bundle-group-name-${groupIndex}`}>Group name</Label>
                <Input id={`bundle-group-name-${groupIndex}`} value={group.name} onChange={(event) => updateGroup(groupIndex, { name: event.target.value })} placeholder="e.g. Choose your monitor" />
              </div>
              <div>
                <Label htmlFor={`bundle-group-type-${groupIndex}`}>Selection type</Label>
                <Select value={group.selectionType} onValueChange={(value: BundleBuilderGroup["selectionType"]) => updateGroup(groupIndex, {
                  selectionType: value,
                  required: value !== "OPTIONAL",
                  minSelect: value === "OPTIONAL" ? 0 : 1,
                  maxSelect: 1,
                  options: value === "FIXED"
                    ? group.options.slice(0, 1).map((option) => ({ ...option, isDefault: true }))
                    : value === "VARIANT_SELECT"
                      ? group.options.filter((option) => option.productId === group.options[0]?.productId).map((option, index) => ({ ...option, isDefault: index === 0 }))
                      : group.options.map((option, index) => ({ ...option, isDefault: value === "PRODUCT_SELECT" && index === 0 })),
                })}>
                  <SelectTrigger id={`bundle-group-type-${groupIndex}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixed item</SelectItem>
                    <SelectItem value="PRODUCT_SELECT">Choose product</SelectItem>
                    <SelectItem value="VARIANT_SELECT">Choose variant</SelectItem>
                    <SelectItem value="OPTIONAL">Optional add-on</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`bundle-group-pricing-${groupIndex}`}>Price calculation</Label>
                <Select value={group.pricingMode} onValueChange={(pricingMode: BundleBuilderGroup["pricingMode"]) => updateGroup(groupIndex, { pricingMode })}>
                  <SelectTrigger id={`bundle-group-pricing-${groupIndex}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTOMATIC">Automatic price difference</SelectItem>
                    <SelectItem value="MANUAL">Manual adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="flex items-center rounded border px-3 py-2 text-sm"><span>{group.selectionType === "OPTIONAL" ? "Optional group" : "Required group"}</span></div>
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

            <GroupCatalogPicker
              group={group}
              groupIndex={groupIndex}
              categories={categories}
              defaultCategoryId={defaultCategoryId}
              onCategoryChange={(catalogCategoryId) => updateGroup(groupIndex, { catalogCategoryId })}
              onAdd={(choice) => addOption(groupIndex, choice)}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Allowed choices</Label>
                <span className="text-xs text-muted-foreground">{group.options.length} added · customer selects {group.minSelect}–{group.maxSelect}</span>
              </div>
              {group.options.map((option, optionIndex) => (
                <div key={`${option.productId}:${option.variantId ?? "default"}`} className="grid items-center gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_120px_170px_40px]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{option.product?.name ?? `Product #${option.productId}`}</p>
                    <p className="truncate text-xs text-muted-foreground">{option.variant?.sku ?? "Default product"} · {money(Number(option.variant?.price ?? option.product?.defaultPrice ?? option.product?.basePrice ?? 0), option.product?.currency ?? "BDT")}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs"><Switch aria-label={`Use choice ${optionIndex + 1} as a default in group ${groupIndex + 1}`} checked={option.isDefault} disabled={group.selectionType === "FIXED"} onCheckedChange={(isDefault) => updateOption(groupIndex, optionIndex, { isDefault })} />Default</label>
                  {group.pricingMode === "MANUAL" ? (
                    <div><Label htmlFor={`bundle-option-price-${groupIndex}-${optionIndex}`} className="text-xs">Manual price +/−</Label><Input id={`bundle-option-price-${groupIndex}-${optionIndex}`} type="number" step="0.01" value={option.priceAdjustment} onChange={(event) => updateOption(groupIndex, optionIndex, { priceAdjustment: Number(event.target.value) })} /></div>
                  ) : (
                    <p className="text-xs font-medium text-primary">Automatic from actual price</p>
                  )}
                  <Button type="button" size="icon" variant="ghost" className="text-destructive" aria-label={`Remove choice ${optionIndex + 1} from group ${groupIndex + 1}`} onClick={() => removeOption(groupIndex, optionIndex)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {group.options.length === 0 ? <p className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">No allowed choices yet. Use the category results above to add products.</p> : null}
            </div>
          </CardContent>
        </Card>
      ))}
      {groups.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Add at least two groups to create a bundle.</p> : null}
    </div>
  );
}
