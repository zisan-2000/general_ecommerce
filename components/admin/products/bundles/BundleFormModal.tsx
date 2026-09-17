"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { DollarSign, Package, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ConfigurableBundleGroupBuilder, {
  createBundleGroup,
  type BundleBuilderGroup,
} from "./ConfigurableBundleGroupBuilder";
import {
  calculateBundlePricing,
  mergeDuplicateBundleItems,
  type DiscountType,
} from "@/lib/bundle";
import { computeVariantAvailableStock } from "@/lib/warehouse-stock";

type Category = { id: number; name: string };
type Brand = { id: number; name: string };
type VatClass = { id: number; name: string; code: string };

type BundleSelectedItem = {
  product: any;
  variant?: any | null;
  quantity: number;
};

type BundleFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  bundleId?: number;
  onSuccess?: (bundleId: number) => void | Promise<void>;
};

const defaultFormData = {
  name: "",
  sku: "",
  description: "",
  shortDesc: "",
  categoryId: "",
  brandId: "none",
  image: "",
  gallery: [] as string[],
  available: true,
  featured: false,
  currency: "BDT",
  vatClassId: "none",
  bundleStockLimit: "",
};

export default function BundleFormModal({
  open,
  onOpenChange,
  mode,
  bundleId,
  onSuccess,
}: BundleFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState(defaultFormData);
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("15");
  const [manualPrice, setManualPrice] = useState("");
  const [selectedItems, setSelectedItems] = useState<BundleSelectedItem[]>([]);
  const [groups, setGroups] = useState<BundleBuilderGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [vatClasses, setVatClasses] = useState<VatClass[]>([]);

  const resetState = () => {
    setFormData(defaultFormData);
    setDiscountType("PERCENTAGE");
    setDiscountValue("15");
    setManualPrice("");
    setSelectedItems([]);
    setGroups([]);
  };

  const formatCurrency = (amount: number, currency = "BDT") =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(amount)
      .replace("BDT", "৳");

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }

    const loadModalData = async () => {
      setLoading(true);
      try {
        const lookupRequests = [
          fetch("/api/categories"),
          fetch("/api/brands"),
          fetch("/api/vat-classes"),
        ];

        const requests =
          isEdit && bundleId
            ? [
                ...lookupRequests,
                fetch(`/api/admin/operations/products/bundles/${bundleId}`),
              ]
            : lookupRequests;

        const responses = await Promise.all(requests);
        const [
          categoriesRes,
          brandsRes,
          vatClassesRes,
          bundleRes,
        ] = responses;

        const [
          categoriesData,
          brandsData,
          vatClassesData,
          bundleData,
        ] = await Promise.all([
          categoriesRes.json().catch(() => []),
          brandsRes.json().catch(() => []),
          vatClassesRes.json().catch(() => []),
          bundleRes?.json().catch(() => null),
        ]);

        const nextCategories =
          categoriesData.categories || categoriesData || [];
        const nextBrands = brandsData.brands || brandsData || [];
        const nextVatClasses = vatClassesData || [];

        setCategories(nextCategories);
        setBrands(nextBrands);
        setVatClasses(nextVatClasses);

        if (isEdit) {
          if (!bundleRes?.ok || !bundleData) {
            throw new Error(bundleData?.error || "Failed to load bundle");
          }

          setFormData({
            name: bundleData.name || "",
            sku:
              bundleData.sku ||
              bundleData.variants?.find((variant: any) => variant.isDefault)
                ?.sku ||
              bundleData.variants?.[0]?.sku ||
              "",
            description: bundleData.description || "",
            shortDesc: bundleData.shortDesc || "",
            categoryId: String(bundleData.categoryId || ""),
            brandId: bundleData.brandId ? String(bundleData.brandId) : "none",
            image: bundleData.image || "",
            gallery: bundleData.gallery || [],
            available: Boolean(bundleData.available),
            featured: Boolean(bundleData.featured),
            currency: bundleData.currency || "BDT",
            vatClassId: bundleData.VatClassId
              ? String(bundleData.VatClassId)
              : "none",
            bundleStockLimit:
              bundleData.bundleStockLimit !== null && bundleData.bundleStockLimit !== undefined
                ? String(bundleData.bundleStockLimit)
                : "",
          });

          const loadedGroups: BundleBuilderGroup[] = (bundleData.bundleGroups || []).map(
            (group: any, groupIndex: number) => ({
              key: `saved-group-${group.id || groupIndex}`,
              name: group.name || "",
              selectionType: group.selectionType || "FIXED",
              pricingMode: group.pricingMode || "AUTOMATIC",
              catalogCategoryId: String(
                group.options?.[0]?.product?.categoryId ??
                group.options?.[0]?.product?.category?.id ??
                bundleData.categoryId ??
                "",
              ),
              required: Boolean(group.required),
              minSelect: Number(group.minSelect ?? 1),
              maxSelect: Number(group.maxSelect ?? 1),
              defaultQuantity: Number(group.defaultQuantity ?? 1),
              minQuantity: Number(group.minQuantity ?? 1),
              maxQuantity: Number(group.maxQuantity ?? 1),
              allowQuantityChange: Boolean(group.allowQuantityChange),
              options: (group.options || []).map((option: any) => {
                const availableVariant = option.variant
                  ? {
                      ...option.variant,
                      stock: computeVariantAvailableStock(option.variant),
                    }
                  : null;
                const fallbackVariant = option.product.variants?.[0];
                return {
                  productId: option.productId,
                  variantId: option.variantId ?? option.variant?.id ?? null,
                  isDefault: Boolean(option.isDefault),
                  priceAdjustment: Number(option.priceAdjustment ?? 0),
                  product: {
                    ...option.product,
                    defaultPrice: Number(option.variant?.price ?? option.product.basePrice),
                    stock: availableVariant
                      ? availableVariant.stock
                      : fallbackVariant
                        ? computeVariantAvailableStock(fallbackVariant)
                        : 0,
                  },
                  variant: availableVariant,
                };
              }),
            }),
          );
          setGroups(loadedGroups);
          setSelectedItems(
            loadedGroups.flatMap((group) =>
              group.options
                .filter((option) => option.isDefault && option.product)
                .map((option) => ({
                  product: option.product,
                  variant: option.variant,
                  quantity: group.defaultQuantity,
                })),
            ),
          );

          const regularTotal = Number(bundleData._stats?.regularTotal || 0);
          const discountedPrice = Number(
            bundleData._stats?.discountedPrice || 0,
          );
          const discountAmount = regularTotal - discountedPrice;
          const discountPercentage =
            regularTotal > 0 ? (discountAmount / regularTotal) * 100 : 0;

          setDiscountType("PERCENTAGE");
          setDiscountValue(discountPercentage.toFixed(1));
          setManualPrice("");
        } else {
          setFormData((prev) => ({
            ...prev,
            bundleStockLimit: "",
          }));
          setGroups([createBundleGroup(), createBundleGroup()]);
        }
      } catch (error) {
        console.error("Error loading bundle form data:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to load bundle form",
        );
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    };

    void loadModalData();
  }, [open, isEdit, bundleId, onOpenChange]);

  const pricingState = useMemo(() => {
    const validItems = selectedItems.filter((item) => item?.product?.id);
    if (validItems.length < 1) {
      return { value: null, error: "Choose enough default components to calculate a bundle price" };
    }

    try {
      return {
        value: calculateBundlePricing({
          items: mergeDuplicateBundleItems(validItems),
          discountType,
          discountValue: parseFloat(discountValue) || 0,
          manualPrice:
            discountType === "MANUAL" && manualPrice
              ? parseFloat(manualPrice)
              : undefined,
        }),
        error: "",
      };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : "Bundle pricing is invalid",
      };
    }
  }, [selectedItems, discountType, discountValue, manualPrice]);
  const pricing = pricingState.value;

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (formData.bundleStockLimit !== "") {
      const stockLimit = Number(formData.bundleStockLimit);
      if (!Number.isInteger(stockLimit) || stockLimit < 0) {
        errors.push("Bundle stock must be a whole number of zero or more");
      }
    }
    if (groups.length < 2) errors.push("At least two groups are required");
    const names = new Set<string>();
    for (const [index, group] of groups.entries()) {
      const label = `Group ${index + 1}`;
      const normalizedName = group.name.trim().toLowerCase();
      if (!normalizedName) errors.push(`${label} requires a name`);
      if (normalizedName && names.has(normalizedName)) errors.push(`${label} has a duplicate name`);
      if (normalizedName) names.add(normalizedName);
      if (group.options.length === 0) errors.push(`${label} requires a choice`);
      if (group.selectionType === "FIXED" && group.options.length !== 1) {
        errors.push(`${label} must have exactly one fixed choice`);
      }
      if (group.selectionType === "OPTIONAL" && group.required) {
        errors.push(`${label} is optional and cannot be required`);
      }
      if (group.selectionType !== "OPTIONAL" && !group.required) {
        errors.push(`${label} must be required`);
      }
      if (group.selectionType === "FIXED" && (group.minSelect !== 1 || group.maxSelect !== 1)) {
        errors.push(`${label} must select exactly one fixed choice`);
      }
      if (group.selectionType === "OPTIONAL" && group.minSelect !== 0) {
        errors.push(`${label} must allow zero choices`);
      }
      if (group.selectionType !== "OPTIONAL" && group.minSelect < 1) {
        errors.push(`${label} must require at least one choice`);
      }
      if (!Number.isInteger(group.minSelect) || !Number.isInteger(group.maxSelect) || group.minSelect < 0 || group.maxSelect < 1 || group.minSelect > group.maxSelect) {
        errors.push(`${label} has invalid selection limits`);
      }
      if (group.maxSelect > group.options.length) {
        errors.push(`${label} cannot select more choices than it provides`);
      }
      const defaultCount = group.options.filter((option) => option.isDefault).length;
      if (defaultCount < group.minSelect || defaultCount > group.maxSelect) {
        errors.push(`${label} defaults must satisfy selection limits`);
      }
      if (
        !Number.isInteger(group.minQuantity) || group.minQuantity < 1 ||
        !Number.isInteger(group.maxQuantity) || group.maxQuantity < group.minQuantity ||
        !Number.isInteger(group.defaultQuantity) || group.defaultQuantity < group.minQuantity || group.defaultQuantity > group.maxQuantity
      ) {
        errors.push(`${label} has invalid quantity limits`);
      }
      const choiceKeys = new Set<string>();
      const productIds = new Set<number>();
      for (const option of group.options) {
        const key = `${option.productId}:${option.variantId ?? "default"}`;
        if (choiceKeys.has(key)) errors.push(`${label} contains a duplicate choice`);
        choiceKeys.add(key);
        productIds.add(option.productId);
        if (!Number.isFinite(option.priceAdjustment)) errors.push(`${label} has an invalid price adjustment`);
      }
      if (group.selectionType === "VARIANT_SELECT" && productIds.size > 1) {
        errors.push(`${label} can only contain variants of one product`);
      }
    }
    return { isValid: errors.length === 0, errors };
  }, [groups, formData.bundleStockLimit]);

  const bundleStockMetrics = useMemo(() => {
    const validItems = selectedItems.filter(
      (item) => item?.product?.id && item.product.type === "PHYSICAL",
    );

    if (validItems.length === 0) {
      return {
        maxBundlesFromStock: 0,
        effectiveBundleStock: 0,
        limitingItems: [] as Array<{
          key: string;
          name: string;
          stock: number;
          quantityPerBundle: number;
          maxBundles: number;
        }>,
      };
    }

    const agg = new Map<
      string,
      {
        product: any;
        stock: number;
        totalQuantity: number;
        variantSku?: string;
      }
    >();

    for (const item of validItems) {
      const key = item.variant?.id
        ? `variant:${item.variant.id}`
        : `product:${item.product.id}`;
      const stock = Number(item.variant?.stock ?? item.product?.stock ?? 0);
      const qty = Number(item.quantity || 0);

      const existing = agg.get(key);
      if (existing) {
        existing.totalQuantity += qty;
        existing.stock = Math.min(existing.stock, stock);
      } else {
        agg.set(key, {
          product: item.product,
          stock,
          totalQuantity: qty,
          variantSku: item.variant?.sku,
        });
      }
    }

    const limitingItems = Array.from(agg.entries()).map(([key, entry]) => {
      const stock = entry.stock;
      const quantityPerBundle = entry.totalQuantity;
      const maxBundles =
        quantityPerBundle > 0 ? Math.floor(stock / quantityPerBundle) : 0;
      const name = entry.variantSku
        ? `${entry.product.name} (${entry.variantSku})`
        : entry.product.name;

      return {
        key,
        name,
        stock,
        quantityPerBundle,
        maxBundles,
      };
    });

    const maxBundlesFromStock =
      limitingItems.length > 0
        ? Math.min(...limitingItems.map((item) => item.maxBundles))
        : 0;

    const requestedBundleStock = formData.bundleStockLimit === ""
      ? null
      : Number(formData.bundleStockLimit);
    const effectiveBundleStock =
      requestedBundleStock !== null &&
      Number.isInteger(requestedBundleStock) &&
      requestedBundleStock >= 0
        ? Math.min(requestedBundleStock, maxBundlesFromStock)
        : maxBundlesFromStock;

    return {
      maxBundlesFromStock,
      effectiveBundleStock,
      limitingItems,
    };
  }, [selectedItems, formData.bundleStockLimit]);

  const hasOutOfStockItems = selectedItems.some((item) => {
    if (!item?.product || item.product.type !== "PHYSICAL") return false;
    const itemStock = item.variant ? item.variant.stock : item.product.stock;
    return Number(itemStock) <= 0;
  });

  const handleGroupsChange = (nextGroups: BundleBuilderGroup[]) => {
    setGroups(nextGroups);
    setSelectedItems(
      nextGroups.flatMap((group) =>
        group.options
          .filter((option) => option.isDefault && option.product)
          .map((option) => ({
            product: option.product,
            variant: option.variant,
            quantity: group.defaultQuantity,
          })),
      ),
    );
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Upload failed");
      }

      setFormData((prev) => ({ ...prev, image: data.fileUrl }));
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validItems = selectedItems.filter((item) => item?.product?.id);

    if (!formData.name.trim()) {
      toast.error("Bundle name is required");
      return;
    }

    if (!formData.sku.trim()) {
      toast.error("Bundle SKU is required");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Bundle description is required");
      return;
    }

    if (!formData.categoryId) {
      toast.error("Please select a bundle category");
      return;
    }

    if (groups.length < 2 || groups.some((group) => !group.name.trim() || group.options.length === 0)) {
      toast.error("Add at least two complete selection groups");
      return;
    }

    if (!validation.isValid || !pricing || validItems.length < 1) {
      toast.error("Please fix the bundle configuration");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        description: formData.description.trim(),
        shortDesc: formData.shortDesc.trim(),
        categoryId: parseInt(formData.categoryId, 10),
        brandId:
          formData.brandId && formData.brandId !== "none"
            ? parseInt(formData.brandId, 10)
            : null,
        image: formData.image,
        gallery: formData.gallery,
        available: formData.available,
        featured: formData.featured,
        currency: formData.currency,
        vatClassId:
          formData.vatClassId && formData.vatClassId !== "none"
            ? parseInt(formData.vatClassId, 10)
            : null,
        bundleStockLimit: formData.bundleStockLimit
          ? parseInt(formData.bundleStockLimit, 10)
          : null,
        discountType,
        discountValue: parseFloat(discountValue) || 0,
        manualPrice:
          discountType === "MANUAL" ? parseFloat(manualPrice) || 0 : undefined,
        items: mergeDuplicateBundleItems(validItems).map((item: any) => ({
          product: item.product,
          variant: item.variant || null,
          quantity: Number(item.quantity) || 1,
        })),
        groups: groups.map((group) => ({
          name: group.name,
          selectionType: group.selectionType,
          pricingMode: group.pricingMode,
          required: group.required,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          defaultQuantity: group.defaultQuantity,
          minQuantity: group.minQuantity,
          maxQuantity: group.maxQuantity,
          allowQuantityChange: group.allowQuantityChange,
          options: group.options.map((option) => ({
            productId: option.productId,
            variantId: option.variantId,
            isDefault: option.isDefault,
            priceAdjustment: option.priceAdjustment,
          })),
        })),
      };

      const response = await fetch(
        isEdit && bundleId
          ? `/api/admin/operations/products/bundles/${bundleId}`
          : "/api/admin/operations/products/bundles",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Failed to save bundle");
      }

      toast.success(
        isEdit ? "Bundle updated successfully" : "Bundle created successfully",
      );
      const nextBundleId = Number(result.bundle?.id || bundleId);
      onOpenChange(false);
      if (nextBundleId && onSuccess) {
        await onSuccess(nextBundleId);
      }
    } catch (error) {
      console.error("Error saving bundle:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save bundle",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl p-0 sm:rounded-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{isEdit ? "Edit Bundle" : "Create Bundle"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update customer choices, component inventory and pricing."
              : "Create a configurable bundle with fixed, selectable or optional groups."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="max-h-[85vh] overflow-y-auto px-6 py-6"
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="bundle-name">Bundle Name *</Label>
                      <Input
                        id="bundle-name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="e.g., Summer Bundle, Starter Pack"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="bundle-sku">Bundle SKU *</Label>
                      <Input
                        id="bundle-sku"
                        value={formData.sku}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            sku: e.target.value,
                          }))
                        }
                        placeholder="e.g., BUNDLE-STARTER-001"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="bundle-short-desc">
                        Short Description
                      </Label>
                      <Input
                        id="bundle-short-desc"
                        value={formData.shortDesc}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            shortDesc: e.target.value,
                          }))
                        }
                        placeholder="Brief description for product listings"
                      />
                    </div>

                    <div>
                      <Label htmlFor="bundle-description">
                        Full Description *
                      </Label>
                      <Textarea
                        id="bundle-description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Detailed description of what's included in this bundle..."
                        rows={4}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="bundle-category">
                          Bundle Category *
                        </Label>
                        <Select
                          value={formData.categoryId}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              categoryId: value,
                            }))
                          }
                        >
                          <SelectTrigger id="bundle-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem
                                key={category.id}
                                value={String(category.id)}
                              >
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="bundle-brand">Brand</Label>
                        <Select
                          value={formData.brandId}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, brandId: value }))
                          }
                        >
                          <SelectTrigger id="bundle-brand">
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No brand</SelectItem>
                            {brands.map((brand) => (
                              <SelectItem
                                key={brand.id}
                                value={String(brand.id)}
                              >
                                {brand.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="bundle-vat">VAT Class</Label>
                        <Select
                          value={formData.vatClassId}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              vatClassId: value,
                            }))
                          }
                        >
                          <SelectTrigger id="bundle-vat">
                            <SelectValue placeholder="Select VAT class" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No VAT Class</SelectItem>
                            {vatClasses.map((vatClass) => (
                              <SelectItem
                                key={vatClass.id}
                                value={String(vatClass.id)}
                              >
                                {vatClass.name} ({vatClass.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="bundle-stock-limit">
                        Bundle Stock
                      </Label>
                      <Input
                        id="bundle-stock-limit"
                        type="number"
                        min="0"
                        value={formData.bundleStockLimit}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            bundleStockLimit: e.target.value,
                          }))
                        }
                        placeholder={
                          bundleStockMetrics.maxBundlesFromStock > 0
                            ? `Max ${bundleStockMetrics.maxBundlesFromStock}`
                            : "Calculated from selected products"
                        }
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Optional global sale cap. Leave empty to use the
                        capacity calculated from the selected components.
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <label className="flex items-center space-x-2">
                        <Switch
                          checked={formData.available}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              available: checked,
                            }))
                          }
                        />
                        <span className="text-sm">Available</span>
                      </label>

                      <label className="flex items-center space-x-2">
                        <Switch
                          checked={formData.featured}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              featured: checked,
                            }))
                          }
                        />
                        <span className="text-sm">Featured</span>
                      </label>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Configurable Bundle Groups
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ConfigurableBundleGroupBuilder
                      groups={groups}
                      onChange={handleGroupsChange}
                      defaultCategoryId={formData.categoryId}
                      categories={categories}
                    />

                    {(!validation.isValid || hasOutOfStockItems || pricingState.error) && (
                      <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3" role="alert">
                        <p className="mb-1 text-sm font-medium text-destructive">
                          Complete these bundle requirements
                        </p>
                        <ul className="list-inside list-disc text-sm text-destructive">
                          {validation.errors.map((error, index) => (
                            <li key={`${error}-${index}`}>{error}</li>
                          ))}
                          {hasOutOfStockItems && <li>Some selected physical items are out of stock</li>}
                          {pricingState.error && <li>{pricingState.error}</li>}
                        </ul>
                      </div>
                    )}

                    {selectedItems.length > 0 && (
                      <div className="mt-4 rounded-lg border bg-muted/30 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">
                              Bundle Stock Summary
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Default configuration capacity from available
                              component stock
                            </p>
                          </div>
                          <Badge variant="secondary">
                            Max Buildable Bundles:{" "}
                            {bundleStockMetrics.maxBundlesFromStock}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          {bundleStockMetrics.limitingItems.map((item) => (
                            <div
                              key={item.key}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                            >
                              <span className="font-medium">{item.name}</span>
                              <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                                <span>Stock: {item.stock}</span>
                                <span>
                                  Qty / Bundle: {item.quantityPerBundle}
                                </span>
                                <span>Possible Bundles: {item.maxBundles}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Pricing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="discount-type">Discount Type</Label>
                      <Select
                        value={discountType}
                        onValueChange={(value: DiscountType) =>
                          setDiscountType(value)
                        }
                      >
                        <SelectTrigger id="discount-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PERCENTAGE">
                            Percentage Discount
                          </SelectItem>
                          <SelectItem value="FIXED">
                            Fixed Amount Discount
                          </SelectItem>
                          <SelectItem value="MANUAL">Manual Price</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {discountType === "PERCENTAGE" && (
                      <div>
                        <Label htmlFor="discount-value">
                          Discount Percentage
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="discount-value"
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={discountValue}
                            onChange={(e) => setDiscountValue(e.target.value)}
                          />
                          <span className="text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>
                    )}

                    {discountType === "FIXED" && (
                      <div>
                        <Label htmlFor="discount-amount">Discount Amount</Label>
                        <Input
                          id="discount-amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                        />
                      </div>
                    )}

                    {discountType === "MANUAL" && (
                      <div>
                        <Label htmlFor="manual-price">Final Bundle Price</Label>
                        <Input
                          id="manual-price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={manualPrice}
                          onChange={(e) => setManualPrice(e.target.value)}
                        />
                      </div>
                    )}

                    {pricing && (
                      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Regular Total:
                          </span>
                          <span className="font-medium line-through">
                            {formatCurrency(
                              pricing.regularTotal,
                              formData.currency,
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Bundle Price:
                          </span>
                          <span className="text-lg font-bold text-green-600">
                            {formatCurrency(
                              pricing.discountedPrice,
                              formData.currency,
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Savings:
                          </span>
                          <Badge
                            variant="secondary"
                            className="bg-green-50 text-green-700"
                          >
                            {pricing.discountPercentage}% (
                            {formatCurrency(
                              pricing.discountAmount,
                              formData.currency,
                            )}
                            )
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Bundle Availability</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Default component capacity
                      </span>
                      <span className="font-medium">
                        {bundleStockMetrics.maxBundlesFromStock}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Bundle sale limit
                      </span>
                      <span className="font-medium">
                        {formData.bundleStockLimit || "Not set"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-3">
                      <span className="text-sm font-medium">
                        Effective bundle stock
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {bundleStockMetrics.effectiveBundleStock}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Bundle Image
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {formData.image ? (
                      <div className="relative">
                        <div className="h-48 w-full overflow-hidden rounded-lg bg-muted">
                          <Image
                            src={formData.image}
                            alt="Bundle preview"
                            width={300}
                            height={200}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, image: "" }))
                          }
                        >
                          Remove Image
                        </Button>
                      </div>
                    ) : (
                      <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted">
                        <div className="text-center">
                          <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Upload bundle image
                          </p>
                        </div>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void handleImageUpload(file);
                        }
                      }}
                    />

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? "Uploading..." : "Choose Image"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, image: "" }))
                        }
                        disabled={!formData.image}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Clear
                      </Button>
                    </div>

                    <Input
                      type="text"
                      placeholder="Enter image URL"
                      value={formData.image}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          image: e.target.value,
                        }))
                      }
                    />
                  </CardContent>
                </Card>

              </div>
            </div>
            <div className="sticky bottom-0 z-20 -mx-6 mt-6 flex flex-col-reverse gap-3 border-t bg-background/95 px-6 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {validation.isValid && pricing && !hasOutOfStockItems
                  ? "Bundle configuration is ready to save."
                  : "Complete the highlighted requirements before saving."}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !validation.isValid || !pricing || hasOutOfStockItems}
                >
                  {saving ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                      {isEdit ? "Updating Bundle..." : "Creating Bundle..."}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {isEdit ? "Update Bundle" : "Create Bundle"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
