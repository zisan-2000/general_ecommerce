"use client";

import { useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, Search, Trash2 } from "lucide-react";
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
}: {
  groups: BundleBuilderGroup[];
  onChange: (groups: BundleBuilderGroup[]) => void;
}) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ search, limit: "100" });
        const response = await fetch(`/api/admin/operations/products/bundles/search-products?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) setProducts(Array.isArray(data.products) ? data.products : []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") console.error("Bundle product search failed", error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  const choices = useMemo(
    () => products.flatMap((product) => {
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

  const addOption = (groupIndex: number, key: string) => {
    const choice = choices.find((candidate) => candidate.key === key);
    if (!choice) return;
    const group = groups[groupIndex];
    if (group.options.some((option) => option.productId === choice.product.id && option.variantId === (choice.variant?.id ?? null))) return;
    const shouldDefault = group.options.filter((option) => option.isDefault).length < Math.max(1, group.minSelect);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-end">
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

      {groups.map((group, groupIndex) => (
        <Card key={group.key}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span className="flex items-center gap-2"><GripVertical className="h-4 w-4 text-muted-foreground" />Group {groupIndex + 1}</span>
              <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => onChange(groups.filter((_, index) => index !== groupIndex))}>
                <Trash2 className="mr-1 h-4 w-4" />Remove
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label>Group name</Label>
                <Input value={group.name} onChange={(event) => updateGroup(groupIndex, { name: event.target.value })} placeholder="e.g. Choose your soap" />
              </div>
              <div>
                <Label>Selection type</Label>
                <Select value={group.selectionType} onValueChange={(value: BundleBuilderGroup["selectionType"]) => updateGroup(groupIndex, {
                  selectionType: value,
                  required: value === "OPTIONAL" ? false : true,
                  minSelect: value === "OPTIONAL" ? 0 : 1,
                  maxSelect: 1,
                  options: value === "FIXED" ? group.options.slice(0, 1).map((option) => ({ ...option, isDefault: true })) : group.options,
                })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
              <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <Switch checked={group.required} disabled={group.selectionType === "FIXED"} onCheckedChange={(required) => updateGroup(groupIndex, { required, minSelect: required ? Math.max(1, group.minSelect) : 0 })} />Required
              </label>
              <div><Label>Min choices</Label><Input type="number" min={group.required ? 1 : 0} value={group.minSelect} onChange={(event) => updateGroup(groupIndex, { minSelect: Number(event.target.value) })} /></div>
              <div><Label>Max choices</Label><Input type="number" min="1" value={group.maxSelect} onChange={(event) => updateGroup(groupIndex, { maxSelect: Number(event.target.value) })} /></div>
              <div><Label>Default quantity</Label><Input type="number" min="1" value={group.defaultQuantity} onChange={(event) => updateGroup(groupIndex, { defaultQuantity: Number(event.target.value) })} /></div>
              <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm"><Switch checked={group.allowQuantityChange} onCheckedChange={(allowQuantityChange) => updateGroup(groupIndex, { allowQuantityChange, maxQuantity: allowQuantityChange ? Math.max(2, group.maxQuantity) : group.defaultQuantity, minQuantity: allowQuantityChange ? group.minQuantity : group.defaultQuantity })} />Customer quantity</label>
            </div>
            {group.allowQuantityChange ? (
              <div className="grid max-w-sm grid-cols-2 gap-3">
                <div><Label>Min quantity</Label><Input type="number" min="1" value={group.minQuantity} onChange={(event) => updateGroup(groupIndex, { minQuantity: Number(event.target.value) })} /></div>
                <div><Label>Max quantity</Label><Input type="number" min="1" value={group.maxQuantity} onChange={(event) => updateGroup(groupIndex, { maxQuantity: Number(event.target.value) })} /></div>
              </div>
            ) : null}

            <div>
              <Label>Add an allowed choice</Label>
              <Select onValueChange={(value) => addOption(groupIndex, value)} disabled={loading || (group.selectionType === "FIXED" && group.options.length >= 1)}>
                <SelectTrigger><SelectValue placeholder={loading ? "Loading products…" : "Select product / exact variant"} /></SelectTrigger>
                <SelectContent>
                  {choices.map((choice) => <SelectItem key={choice.key} value={choice.key}>{choice.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {group.options.map((option, optionIndex) => (
                <div key={`${option.productId}:${option.variantId ?? "default"}`} className="grid items-center gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_130px_120px_40px]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{option.product?.name ?? `Product #${option.productId}`}</p>
                    <p className="truncate text-xs text-muted-foreground">{option.variant?.sku ?? "Default variant"}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs"><Switch checked={option.isDefault} onCheckedChange={(isDefault) => updateOption(groupIndex, optionIndex, { isDefault })} />Default</label>
                  <div><Label className="text-xs">Price +/−</Label><Input type="number" step="0.01" value={option.priceAdjustment} onChange={(event) => updateOption(groupIndex, optionIndex, { priceAdjustment: Number(event.target.value) })} /></div>
                  <Button type="button" size="icon" variant="ghost" className="text-destructive" aria-label="Remove choice" onClick={() => updateGroup(groupIndex, { options: group.options.filter((_, index) => index !== optionIndex) })}><Trash2 className="h-4 w-4" /></Button>
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
