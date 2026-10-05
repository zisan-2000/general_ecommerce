"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
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
import { ResponsiveInput } from "./ResponsiveFormField";

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

const GroupCatalogPicker = memo(function GroupCatalogPicker({
  group,
  groupIndex,
  categories,
  defaultCategoryId,
  warehouseId,
  onCategoryChange,
  onAdd,
}: {
  group: BundleBuilderGroup;
  groupIndex: number;
  categories: CatalogCategory[];
  defaultCategoryId: string;
  warehouseId: string;
  onCategoryChange: (groupIndex: number, categoryId: string) => void;
  onAdd: (groupIndex: number, choice: CatalogChoice) => void;
}) {
  const t = useTranslations("AdminBundles.builder.catalog");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const categoryId = group.catalogCategoryId || defaultCategoryId;

  useEffect(() => {
    if (!categoryId || !warehouseId) {
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
          categoryIds: categoryId,
          warehouseId,
          limit: "30",
        });
        const response = await fetch(
          `/api/admin/operations/products/bundles/search-products?${params}`,
          { signal: controller.signal },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(t("errors.load"));
        setProducts(Array.isArray(data.products) ? data.products : []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Bundle product search failed", error);
          setProducts([]);
          setLoadError(error instanceof Error ? error.message : t("errors.load"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [categoryId, retryNonce, search, t, warehouseId]);

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
          <Label htmlFor={`bundle-group-category-${groupIndex}`}>{t("categoryLabel")}</Label>
          <Select value={categoryId} onValueChange={(value) => onCategoryChange(groupIndex, value)}>
            <SelectTrigger id={`bundle-group-category-${groupIndex}`} className="mt-1">
              <SelectValue placeholder={t("categoryPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`bundle-group-search-${groupIndex}`}>{t("searchLabel")}</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`bundle-group-search-${groupIndex}`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder={t("searchPlaceholder")}
              disabled={!categoryId || fixedComplete}
            />
          </div>
        </div>
      </div>

      {!warehouseId ? (
        <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
          {t("chooseWarehouseHint")}
        </p>
      ) : !categoryId ? (
        <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
          {t("chooseCategoryHint")}
        </p>
      ) : loadError ? (
        <div className="flex items-center justify-between gap-2 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{loadError}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setRetryNonce((value) => value + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" />{t("retry")}
          </Button>
        </div>
      ) : fixedComplete ? (
        <p className="text-xs text-muted-foreground">{t("fixedComplete")}</p>
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground" aria-live="polite">
            <span>{loading ? t("loading") : t("eligibleChoices", { count: choices.length })}</span>
            <span>{categoryName ?? t("selectedCategory")}</span>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {!loading && choices.length === 0 ? (
              <p className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">{t("empty")}</p>
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
                      {choice.variant?.sku ?? t("defaultProduct")} · {t("stock", { count: stock })} · {money(price, choice.product.currency)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={selected ? "secondary" : "outline"}
                    disabled={selected || stock <= 0}
                    onClick={() => onAdd(groupIndex, choice)}
                  >
                    {selected ? <Check className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
                    {selected ? t("added") : stock > 0 ? t("add") : t("outOfStock")}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {group.selectionType === "VARIANT_SELECT" && group.options[0] ? (
        <p className="text-xs text-muted-foreground">
          {t("variantLocked", { product: group.options[0].product?.name ?? t("productNumber", { id: group.options[0].productId }) })}
        </p>
      ) : null}
    </div>
  );
}, (previous, next) =>
  previous.group.catalogCategoryId === next.group.catalogCategoryId &&
  previous.group.selectionType === next.group.selectionType &&
  previous.group.options === next.group.options &&
  previous.groupIndex === next.groupIndex &&
  previous.categories === next.categories &&
  previous.defaultCategoryId === next.defaultCategoryId &&
  previous.warehouseId === next.warehouseId &&
  previous.onCategoryChange === next.onCategoryChange &&
  previous.onAdd === next.onAdd,
);

function ConfigurableBundleGroupBuilder({
  groups,
  onChange,
  defaultCategoryId = "",
  categories = [],
  warehouseId,
}: {
  groups: BundleBuilderGroup[];
  onChange: (groups: BundleBuilderGroup[]) => void;
  defaultCategoryId?: string;
  categories?: CatalogCategory[];
  warehouseId: string;
}) {
  const t = useTranslations("AdminBundles.builder");
  const groupsRef = useRef(groups);
  const onChangeRef = useRef(onChange);
  const [advancedGroups, setAdvancedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    groupsRef.current = groups;
    onChangeRef.current = onChange;
  }, [groups, onChange]);

  const updateGroup = useCallback((index: number, patch: Partial<BundleBuilderGroup>) => {
    onChangeRef.current(
      groupsRef.current.map((group, groupIndex) =>
        groupIndex === index ? { ...group, ...patch } : group,
      ),
    );
  }, []);

  const moveGroup = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= groups.length) return;
    const nextGroups = [...groups];
    [nextGroups[index], nextGroups[nextIndex]] = [nextGroups[nextIndex], nextGroups[index]];
    onChange(nextGroups);
  };

  const addOption = useCallback((groupIndex: number, choice: CatalogChoice) => {
    const group = groupsRef.current[groupIndex];
    if (!group) return;
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
  }, [updateGroup]);

  const changeCatalogCategory = useCallback((groupIndex: number, catalogCategoryId: string) => {
    const group = groupsRef.current[groupIndex];
    if (!group) return;
    const categoryName = categories.find(
      (category) => String(category.id) === catalogCategoryId,
    )?.name;
    updateGroup(groupIndex, {
      catalogCategoryId,
      ...(!group.name.trim() && categoryName
        ? { name: t("defaultGroupName", { category: categoryName }) }
        : {}),
    });
  }, [categories, t, updateGroup]);

  const toggleAdvanced = (key: string) => {
    setAdvancedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
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
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange([...groups, createBundleGroup(defaultCategoryId)])}>
          <Plus className="mr-2 h-4 w-4" />{t("actions.addGroup")}
        </Button>
      </div>

      {groups.map((group, groupIndex) => (
        <Card key={group.key}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span>{t("groupNumber", { number: groupIndex + 1 })}{group.name ? ` · ${group.name}` : ""}</span>
              <span className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label={t("actions.moveUp", { number: groupIndex + 1 })} disabled={groupIndex === 0} onClick={() => moveGroup(groupIndex, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label={t("actions.moveDown", { number: groupIndex + 1 })} disabled={groupIndex === groups.length - 1} onClick={() => moveGroup(groupIndex, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => onChange(groups.filter((_, index) => index !== groupIndex))}><Trash2 className="mr-1 h-4 w-4" />{t("actions.remove")}</Button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor={`bundle-group-name-${groupIndex}`}>{t("fields.name")}</Label>
                <ResponsiveInput id={`bundle-group-name-${groupIndex}`} value={group.name} onValueChange={(value) => updateGroup(groupIndex, { name: value })} placeholder={t("fields.namePlaceholder")} />
              </div>
              <div>
                <Label htmlFor={`bundle-group-type-${groupIndex}`}>{t("fields.selectionType")}</Label>
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
                    <SelectItem value="FIXED">{t("selectionTypes.FIXED")}</SelectItem>
                    <SelectItem value="PRODUCT_SELECT">{t("selectionTypes.PRODUCT_SELECT")}</SelectItem>
                    <SelectItem value="VARIANT_SELECT">{t("selectionTypes.VARIANT_SELECT")}</SelectItem>
                    <SelectItem value="OPTIONAL">{t("selectionTypes.OPTIONAL")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {group.selectionType === "OPTIONAL" ? t("groupTypes.optional") : t("groupTypes.required")} · {t("choices.summary", { count: group.options.length, min: group.minSelect, max: group.maxSelect })} · {t(`pricingModes.${group.pricingMode}`)}
              </p>
              <Button type="button" size="sm" variant="ghost" onClick={() => toggleAdvanced(group.key)}>
                {advancedGroups.has(group.key) ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                {advancedGroups.has(group.key) ? t("actions.hideAdvanced") : t("actions.showAdvanced")}
              </Button>
            </div>

            {advancedGroups.has(group.key) ? (
              <div className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <Label htmlFor={`bundle-group-pricing-${groupIndex}`}>{t("fields.pricingMode")}</Label>
                    <Select value={group.pricingMode} onValueChange={(pricingMode: BundleBuilderGroup["pricingMode"]) => updateGroup(groupIndex, { pricingMode })}>
                      <SelectTrigger id={`bundle-group-pricing-${groupIndex}`}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="AUTOMATIC">{t("pricingModes.AUTOMATIC")}</SelectItem><SelectItem value="MANUAL">{t("pricingModes.MANUAL")}</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label htmlFor={`bundle-group-min-${groupIndex}`}>{t("fields.minChoices")}</Label><Input id={`bundle-group-min-${groupIndex}`} type="number" min={group.required ? 1 : 0} value={group.minSelect} disabled={group.selectionType === "FIXED" || group.selectionType === "OPTIONAL"} onChange={(event) => updateGroup(groupIndex, { minSelect: Number(event.target.value) })} /></div>
                  <div><Label htmlFor={`bundle-group-max-${groupIndex}`}>{t("fields.maxChoices")}</Label><Input id={`bundle-group-max-${groupIndex}`} type="number" min="1" value={group.maxSelect} disabled={group.selectionType === "FIXED"} onChange={(event) => updateGroup(groupIndex, { maxSelect: Number(event.target.value) })} /></div>
                  <div><Label htmlFor={`bundle-group-default-qty-${groupIndex}`}>{t("fields.defaultQuantity")}</Label><Input id={`bundle-group-default-qty-${groupIndex}`} type="number" min="1" value={group.defaultQuantity} onChange={(event) => {
                    const defaultQuantity = Number(event.target.value);
                    updateGroup(groupIndex, {
                      defaultQuantity,
                      ...(!group.allowQuantityChange ? { minQuantity: defaultQuantity, maxQuantity: defaultQuantity } : {}),
                    });
                  }} /></div>
                  <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm"><Switch aria-label={t("fields.allowQuantityAria", { number: groupIndex + 1 })} checked={group.allowQuantityChange} onCheckedChange={(allowQuantityChange) => updateGroup(groupIndex, { allowQuantityChange, maxQuantity: allowQuantityChange ? Math.max(2, group.maxQuantity) : group.defaultQuantity, minQuantity: allowQuantityChange ? group.minQuantity : group.defaultQuantity })} />{t("fields.customerQuantity")}</label>
                </div>
                {group.allowQuantityChange ? <div className="grid max-w-sm grid-cols-2 gap-3"><div><Label htmlFor={`bundle-group-min-qty-${groupIndex}`}>{t("fields.minQuantity")}</Label><Input id={`bundle-group-min-qty-${groupIndex}`} type="number" min="1" value={group.minQuantity} onChange={(event) => updateGroup(groupIndex, { minQuantity: Number(event.target.value) })} /></div><div><Label htmlFor={`bundle-group-max-qty-${groupIndex}`}>{t("fields.maxQuantity")}</Label><Input id={`bundle-group-max-qty-${groupIndex}`} type="number" min="1" value={group.maxQuantity} onChange={(event) => updateGroup(groupIndex, { maxQuantity: Number(event.target.value) })} /></div></div> : null}
              </div>
            ) : null}

            <GroupCatalogPicker
              group={group}
              groupIndex={groupIndex}
              categories={categories}
            defaultCategoryId={defaultCategoryId}
            warehouseId={warehouseId}
              onCategoryChange={changeCatalogCategory}
              onAdd={addOption}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("choices.title")}</Label>
                <span className="text-xs text-muted-foreground">{t("choices.summary", { count: group.options.length, min: group.minSelect, max: group.maxSelect })}</span>
              </div>
              {group.options.map((option, optionIndex) => (
                <div key={`${option.productId}:${option.variantId ?? "default"}`} className="grid items-center gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_120px_170px_40px]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{option.product?.name ?? t("choices.productNumber", { id: option.productId })}</p>
                    <p className="truncate text-xs text-muted-foreground">{option.variant?.sku ?? t("choices.defaultProduct")} · {money(Number(option.variant?.price ?? option.product?.defaultPrice ?? option.product?.basePrice ?? 0), option.product?.currency ?? "BDT")}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs"><Switch aria-label={t("choices.defaultAria", { choice: optionIndex + 1, group: groupIndex + 1 })} checked={option.isDefault} disabled={group.selectionType === "FIXED"} onCheckedChange={(isDefault) => updateOption(groupIndex, optionIndex, { isDefault })} />{t("choices.default")}</label>
                  {group.pricingMode === "MANUAL" ? (
                    <div><Label htmlFor={`bundle-option-price-${groupIndex}-${optionIndex}`} className="text-xs">{t("choices.manualPrice")}</Label><Input id={`bundle-option-price-${groupIndex}-${optionIndex}`} type="number" step="0.01" value={option.priceAdjustment} onChange={(event) => updateOption(groupIndex, optionIndex, { priceAdjustment: Number(event.target.value) })} /></div>
                  ) : (
                    <p className="text-xs font-medium text-primary">{t("choices.automaticPrice")}</p>
                  )}
                  <Button type="button" size="icon" variant="ghost" className="text-destructive" aria-label={t("choices.removeAria", { choice: optionIndex + 1, group: groupIndex + 1 })} onClick={() => removeOption(groupIndex, optionIndex)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {group.options.length === 0 ? <p className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">{t("choices.empty")}</p> : null}
            </div>
          </CardContent>
        </Card>
      ))}
      {groups.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t("empty")}</p> : null}
    </div>
  );
}

export default memo(ConfigurableBundleGroupBuilder);
