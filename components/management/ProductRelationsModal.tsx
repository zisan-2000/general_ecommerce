"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Edit3, Plus, Printer, RefreshCw, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseMultiSelectValue, type CatalogAttributeType } from "@/lib/attribute-schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProductType = "PHYSICAL" | "DIGITAL" | "SERVICE";

interface ProductLite {
  id: number;
  name: string;
  type: ProductType;
  categoryId: number;
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
  productId: number;
  sku: string;
  price: number | string;
  currency: string;
  stock: number;
  digitalAssetId?: number | null;
  options: any;
  codes?: ProductCode[];
  stockLevels?: StockLevel[];
}

interface ProductCode {
  id: number;
  kind: "BARCODE" | "QRCODE";
  symbology: "CODE128" | "EAN13" | "QR";
  value: string;
  token?: string | null;
}

interface AttributeValue {
  id: number;
  value: string;
}

interface Attribute {
  id: number;
  name: string;
  type: CatalogAttributeType;
  unit: string | null;
  values: AttributeValue[];
  categoryAttributes: Array<{
    categoryId: number;
    isRequired: boolean;
    sortOrder: number;
  }>;
}

interface ProductAttribute {
  id: number;
  productId: number;
  attributeId: number;
  value: string;
  attribute: { id: number; name: string };
}

interface ServiceSlot {
  id: number;
  productId: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  timezone?: string | null;
  location?: string | null;
  notes?: string | null;
}

interface InventoryLog {
  id: number;
  change: number;
  reason: string;
  createdAt: string;
  variant?: { id: number; sku: string } | null;
  warehouse?: { id: number; name: string; code: string } | null;
}

interface DigitalAsset {
  id: number;
  title: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  product: ProductLite | null;
  booksEnabled?: boolean;
}

type BookPartyOption = { id: number; name: string };

export default function ProductRelationsModal({ open, onClose, product, booksEnabled = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [productAttributes, setProductAttributes] = useState<ProductAttribute[]>([]);
  const [serviceSlots, setServiceSlots] = useState<ServiceSlot[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [digitalAssets, setDigitalAssets] = useState<DigitalAsset[]>([]);
  const [writers, setWriters] = useState<BookPartyOption[]>([]);
  const [publishers, setPublishers] = useState<BookPartyOption[]>([]);
  const [bookMetadata, setBookMetadata] = useState({ writerId: "", publisherId: "" });
  const [bookSaving, setBookSaving] = useState(false);

  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

  const [variantFormOpen, setVariantFormOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState<number[]>([]);
  const [variantForm, setVariantForm] = useState({
    sku: "",
    price: "",
    currency: "USD",
    stock: "0",
    option1Name: "",
    option1Value: "",
    option2Name: "",
    option2Value: "",
    digitalAssetId: "",
  });

  const [newAttr, setNewAttr] = useState({ attributeId: "", value: "" });
  const [stockDraft, setStockDraft] = useState<Record<number, string>>({});

  const [slotForm, setSlotForm] = useState({
    startsAt: "",
    endsAt: "",
    capacity: "1",
    timezone: "",
    location: "",
    notes: "",
  });

  const selectedVariant = useMemo(() => {
    if (!selectedVariantId) return null;
    return variants.find((v) => v.id === selectedVariantId) || null;
  }, [selectedVariantId, variants]);

  const selectedAttr = useMemo(() => {
    const id = Number(newAttr.attributeId);
    if (!id) return null;
    return attributes.find((a) => a.id === id) || null;
  }, [newAttr.attributeId, attributes]);
  const availableAttributes = useMemo(() => {
    if (!product?.categoryId) return attributes;
    const mapped = attributes
      .flatMap((attribute) => {
        const mapping = attribute.categoryAttributes?.find(
          (item) => item.categoryId === product.categoryId,
        );
        return mapping ? [{ attribute, mapping }] : [];
      })
      .sort((a, b) => a.mapping.sortOrder - b.mapping.sortOrder)
      .map((item) => item.attribute);
    return mapped.length > 0 ? mapped : attributes;
  }, [attributes, product?.categoryId]);

  const loadAll = async () => {
    if (!product?.id) return;
    try {
      setLoading(true);
      const [vRes, wRes, aRes, paRes, lRes, daRes, ssRes] = await Promise.all([
        fetch(`/api/product-variants?productId=${product.id}`, { cache: "no-store" }),
        fetch(`/api/warehouses`, { cache: "no-store" }),
        fetch(`/api/attributes`, { cache: "no-store" }),
        fetch(`/api/product-attributes?productId=${product.id}`, { cache: "no-store" }),
        fetch(`/api/inventory-logs?productId=${product.id}`, { cache: "no-store" }),
        fetch(`/api/digital-assets`, { cache: "no-store" }),
        product.type === "SERVICE"
          ? fetch(`/api/service-slots?productId=${product.id}`, { cache: "no-store" })
          : Promise.resolve(null as any),
      ]);

      const [v, w, a, pa, l, da, ss] = await Promise.all([
        vRes.json(),
        wRes.json(),
        aRes.json(),
        paRes.json(),
        lRes.json(),
        daRes.json(),
        ssRes ? ssRes.json() : Promise.resolve([]),
      ]);

      setVariants(Array.isArray(v) ? v : []);
      setWarehouses(Array.isArray(w) ? w : []);
      setAttributes(Array.isArray(a) ? a : []);
      setProductAttributes(Array.isArray(pa) ? pa : []);
      setLogs(Array.isArray(l) ? l : []);
      setDigitalAssets(da || []);
      setServiceSlots(ss || []);

      const firstVariantId = (v || [])[0]?.id;
      setSelectedVariantId((prev) => prev ?? firstVariantId ?? null);
    } catch {
      toast.error("Failed to load product relations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSelectedVariantId(null);
    setSelectedVariantIds([]);
    setVariantFormOpen(false);
    setEditingVariant(null);
    setVariantForm({
      sku: "",
      price: "",
      currency: "USD",
      stock: "0",
      option1Name: "",
      option1Value: "",
      option2Name: "",
      option2Value: "",
      digitalAssetId: "",
    });
    setNewAttr({ attributeId: "", value: "" });
    setStockDraft({});
    setSlotForm({
      startsAt: "",
      endsAt: "",
      capacity: "1",
      timezone: "",
      location: "",
      notes: "",
    });
    void loadAll();
  }, [open, product?.id]);

  useEffect(() => {
    if (!open || !product?.id || !booksEnabled) return;
    let active = true;
    void Promise.all([
      fetch(`/api/book-metadata/${product.id}`, { cache: "no-store" }),
      fetch("/api/writers", { cache: "no-store" }),
      fetch("/api/publishers", { cache: "no-store" }),
    ]).then(async ([metadataResponse, writersResponse, publishersResponse]) => {
      const [metadataPayload, writersPayload, publishersPayload] = await Promise.all([
        metadataResponse.status === 404 ? null : metadataResponse.json(),
        writersResponse.json(),
        publishersResponse.json(),
      ]);
      if (!active) return;
      setBookMetadata({
        writerId: metadataPayload?.writerId ? String(metadataPayload.writerId) : "",
        publisherId: metadataPayload?.publisherId ? String(metadataPayload.publisherId) : "",
      });
      setWriters(Array.isArray(writersPayload) ? writersPayload : []);
      setPublishers(Array.isArray(publishersPayload) ? publishersPayload : []);
    }).catch(() => {
      if (active) toast.error("Failed to load book metadata");
    });
    return () => {
      active = false;
    };
  }, [booksEnabled, open, product?.id]);

  const saveBookMetadata = async () => {
    if (!product) return;
    setBookSaving(true);
    try {
      const response = await fetch(`/api/book-metadata/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          writerId: bookMetadata.writerId || null,
          publisherId: bookMetadata.publisherId || null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Failed to save book metadata");
      toast.success("Book metadata saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save book metadata");
    } finally {
      setBookSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedVariant) return;
    const next: Record<number, string> = {};
    for (const w of warehouses) {
      const level = selectedVariant.stockLevels?.find((sl) => sl.warehouseId === w.id);
      next[w.id] = level ? String(level.quantity) : "0";
    }
    setStockDraft(next);
  }, [selectedVariant, warehouses]);

  const openAddVariant = () => {
    setEditingVariant(null);
    setVariantFormOpen(true);
    setVariantForm({
      sku: "",
      price: "",
      currency: "USD",
      stock: "0",
      option1Name: "",
      option1Value: "",
      option2Name: "",
      option2Value: "",
      digitalAssetId: "",
    });
  };

  const openEditVariant = (v: Variant) => {
    setEditingVariant(v);
    setVariantFormOpen(true);

    const opts = v.options && typeof v.options === "object" ? v.options : {};
    const entries = Object.entries(opts);
    const [o1, o2] = entries as any[];

    setVariantForm({
      sku: v.sku || "",
      price: String(v.price ?? ""),
      currency: v.currency || "USD",
      stock: String(v.stock ?? 0),
      option1Name: o1?.[0] || "",
      option1Value: o1?.[1] != null ? String(o1[1]) : "",
      option2Name: o2?.[0] || "",
      option2Value: o2?.[1] != null ? String(o2[1]) : "",
      digitalAssetId: v.digitalAssetId ? String(v.digitalAssetId) : "",
    });
  };

  const getPrimaryCode = (variant: Variant, kind: ProductCode["kind"]) =>
    variant.codes?.find((code) => code.kind === kind) ?? null;

  const buildStickerUrl = (variantIds: number[]) => {
    const params = new URLSearchParams({
      variantIds: variantIds.join(","),
    });
    return `/print/stickers?${params.toString()}`;
  };

  const toggleVariantSelection = (variantId: number, checked: boolean) => {
    setSelectedVariantIds((prev) =>
      checked ? Array.from(new Set([...prev, variantId])) : prev.filter((id) => id !== variantId),
    );
  };

  const toggleSelectAllVariants = (checked: boolean) => {
    setSelectedVariantIds(checked ? variants.map((variant) => variant.id) : []);
  };

  const printStickers = (variantIds: number[]) => {
    if (variantIds.length === 0) {
      toast.error("Select at least one variant");
      return;
    }

    window.open(buildStickerUrl(variantIds), "_blank", "noopener,noreferrer");
  };

  const buildCodeImageUrl = (
    code: ProductCode | null,
    format: "svg" | "png" = "svg",
    download = false,
  ) => {
    if (!code) return "";
    const params = new URLSearchParams({ format });
    if (download) params.set("download", "1");
    return `/api/product-codes/${code.id}/image?${params.toString()}`;
  };

  const saveVariant = async () => {
    if (!product) return;

    const sku = variantForm.sku.trim();
    const price = Number(variantForm.price);
    const stock = Number(variantForm.stock);

    if (!sku) {
      toast.error("SKU is required");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Price is required");
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      toast.error("Stock must be 0 or more");
      return;
    }

    const options: Record<string, any> = {};
    if (variantForm.option1Name.trim()) {
      options[variantForm.option1Name.trim()] = variantForm.option1Value;
    }
    if (variantForm.option2Name.trim()) {
      options[variantForm.option2Name.trim()] = variantForm.option2Value;
    }

    const payload: any = {
      productId: product.id,
      sku,
      price,
      currency: variantForm.currency || "USD",
      stock,
      options,
      digitalAssetId: variantForm.digitalAssetId
        ? Number(variantForm.digitalAssetId)
        : null,
    };

    try {
      const url = editingVariant
        ? `/api/product-variants/${editingVariant.id}`
        : `/api/product-variants`;

      const res = await fetch(url, {
        method: editingVariant ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Save failed");

      toast.success(editingVariant ? "Variant updated" : "Variant created");
      setVariantFormOpen(false);
      setEditingVariant(null);
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    }
  };

  const deleteVariant = async (variantId: number) => {
    if (!confirm("Delete this variant?")) return;
    try {
      const res = await fetch(`/api/product-variants/${variantId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      toast.success("Variant deleted");
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || "Delete failed");
    }
  };

  const regenerateVariantCodes = async (variant: Variant) => {
    try {
      const res = await fetch(`/api/product-variants/${variant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: variant.sku,
          price: variant.price,
          currency: variant.currency,
          stock: variant.stock,
          options: variant.options ?? {},
          digitalAssetId: variant.digitalAssetId ?? null,
          regenerateCodes: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Regenerate failed");
      toast.success("Variant codes regenerated");
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || "Regenerate failed");
    }
  };

  const addProductAttribute = async () => {
    if (!product) return;
    const attributeId = Number(newAttr.attributeId);
    const value = newAttr.value.trim();
    if (!attributeId) {
      toast.error("Select an attribute");
      return;
    }
    if (!value) {
      toast.error("Value is required");
      return;
    }

    try {
      const res = await fetch("/api/product-attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, attributeId, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Add failed");

      toast.success("Attribute added");
      setNewAttr({ attributeId: "", value: "" });
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || "Add failed");
    }
  };

  const deleteProductAttribute = async (id: number) => {
    if (!confirm("Remove this product attribute?")) return;
    try {
      const res = await fetch(`/api/product-attributes/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      toast.success("Removed");
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || "Delete failed");
    }
  };

  const saveStockLevel = async (warehouseId: number) => {
    if (!selectedVariant) return;
    const qty = Number(stockDraft[warehouseId]);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error("Quantity must be 0 or more");
      return;
    }

    try {
      const res = await fetch("/api/stock-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId,
          productVariantId: selectedVariant.id,
          quantity: qty,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Save failed");

      toast.success("Saved");
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    }
  };

  const deleteStockLevel = async (stockLevelId: number) => {
    if (!confirm("Delete this warehouse stock entry?")) return;
    try {
      const res = await fetch(`/api/stock-levels/${stockLevelId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      toast.success("Deleted");
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || "Delete failed");
    }
  };

  const addServiceSlot = async () => {
    if (!product) return;
    if (!slotForm.startsAt || !slotForm.endsAt) {
      toast.error("Start and End are required");
      return;
    }

    const capacity = Number(slotForm.capacity || "1");
    if (!Number.isFinite(capacity) || capacity < 1) {
      toast.error("Capacity must be 1 or more");
      return;
    }

    try {
      const res = await fetch("/api/service-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          startsAt: slotForm.startsAt,
          endsAt: slotForm.endsAt,
          capacity,
          timezone: slotForm.timezone || null,
          location: slotForm.location || null,
          notes: slotForm.notes || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Create failed");
      toast.success("Service slot created");
      setSlotForm({
        startsAt: "",
        endsAt: "",
        capacity: "1",
        timezone: "",
        location: "",
        notes: "",
      });
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || "Create failed");
    }
  };

  const deleteServiceSlot = async (id: number) => {
    if (!confirm("Delete this service slot?")) return;
    try {
      const res = await fetch(`/api/service-slots/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      toast.success("Deleted");
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || "Delete failed");
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col" showCloseButton={false}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="truncate text-lg sm:text-xl">
              Manage: {product.name} ({product.type})
            </span>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={loadAll}
                disabled={loading}
                className="flex-shrink-0"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Refresh</span>
                <span className="sm:hidden">↻</span>
              </Button>
              <Button size="icon" variant="ghost" onClick={onClose} className="flex-shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="variants" className="w-full flex-1 overflow-hidden flex flex-col">
          <TabsList className="justify-start h-auto p-1 flex flex-wrap gap-1 bg-muted/50">
            <TabsTrigger value="variants" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Variants</TabsTrigger>
            <TabsTrigger value="attributes" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Attributes</TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Inventory</TabsTrigger>
            {product.type === "SERVICE" && (
              <TabsTrigger value="service" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Service Slots</TabsTrigger>
            )}
            {booksEnabled ? <TabsTrigger value="book" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Book Metadata</TabsTrigger> : null}
            <TabsTrigger value="logs" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Inventory Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="variants" className="flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Variants (SKU, price, stock, options)
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => printStickers(selectedVariantIds)}
                      disabled={selectedVariantIds.length === 0}
                      className="w-full sm:w-auto"
                    >
                      <Printer className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Print Selected</span>
                      <span className="sm:hidden">Print</span>
                    </Button>
                    <Button onClick={openAddVariant} size="sm" className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Variant
                    </Button>
                  </div>
                </div>

              {variantFormOpen && (
                <div className="border rounded-lg p-3 sm:p-4 space-y-3 bg-card">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm sm:text-base">
                      {editingVariant ? "Edit Variant" : "New Variant"}
                    </p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setVariantFormOpen(false);
                        setEditingVariant(null);
                      }}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="sm:col-span-2 lg:col-span-2">
                      <Label className="text-xs sm:text-sm">SKU *</Label>
                      <Input
                        value={variantForm.sku}
                        onChange={(e) =>
                          setVariantForm({ ...variantForm, sku: e.target.value })
                        }
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm">Price *</Label>
                      <Input
                        type="number"
                        value={variantForm.price}
                        onChange={(e) =>
                          setVariantForm({
                            ...variantForm,
                            price: e.target.value,
                          })
                        }
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm">Currency</Label>
                      <Input
                        value={variantForm.currency}
                        onChange={(e) =>
                          setVariantForm({
                            ...variantForm,
                            currency: e.target.value.toUpperCase(),
                          })
                        }
                        className="text-sm"
                      />
                    </div>
                  </div>

                  {product.type === "PHYSICAL" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs sm:text-sm">Stock</Label>
                        <Input
                          type="number"
                          value={variantForm.stock}
                          onChange={(e) =>
                            setVariantForm({
                              ...variantForm,
                              stock: e.target.value,
                            })
                          }
                          className="text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3 text-xs text-muted-foreground flex items-end">
                        <span className="block">Tip: for multiple warehouses, manage stock from the Inventory tab.</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Stock is not used for {product.type} products.
                    </p>
                  )}

                  {product.type === "DIGITAL" && (
                    <div>
                      <Label className="text-xs sm:text-sm">Digital Asset (optional)</Label>
                      <select
                        className="border border-input bg-background text-sm p-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-ring"
                        value={variantForm.digitalAssetId}
                        onChange={(e) =>
                          setVariantForm({
                            ...variantForm,
                            digitalAssetId: e.target.value,
                          })
                        }
                      >
                        <option value="">Select</option>
                        {digitalAssets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs sm:text-sm">Option 1 Name</Label>
                      <Input
                        value={variantForm.option1Name}
                        onChange={(e) =>
                          setVariantForm({
                            ...variantForm,
                            option1Name: e.target.value,
                          })
                        }
                        placeholder="e.g. Color"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm">Option 1 Value</Label>
                      <Input
                        value={variantForm.option1Value}
                        onChange={(e) =>
                          setVariantForm({
                            ...variantForm,
                            option1Value: e.target.value,
                          })
                        }
                        placeholder="e.g. Red"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm">Option 2 Name</Label>
                      <Input
                        value={variantForm.option2Name}
                        onChange={(e) =>
                          setVariantForm({
                            ...variantForm,
                            option2Name: e.target.value,
                          })
                        }
                        placeholder="e.g. Size"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm">Option 2 Value</Label>
                      <Input
                        value={variantForm.option2Value}
                        onChange={(e) =>
                          setVariantForm({
                            ...variantForm,
                            option2Value: e.target.value,
                          })
                        }
                        placeholder="e.g. XL"
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        setVariantFormOpen(false);
                        setEditingVariant(null);
                      }}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button onClick={saveVariant} disabled={loading} className="w-full sm:w-auto">
                      {editingVariant ? "Update" : "Create"}
                    </Button>
                  </div>
                </div>
              )}

              {variants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No variants found</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={variants.length > 0 && selectedVariantIds.length === variants.length}
                              onCheckedChange={(checked) => toggleSelectAllVariants(Boolean(checked))}
                              aria-label="Select all variants"
                            />
                          </TableHead>
                          <TableHead className="min-w-[100px]">SKU</TableHead>
                          <TableHead className="min-w-[200px] hidden lg:table-cell">Codes</TableHead>
                          <TableHead className="min-w-[80px]">Price</TableHead>
                          {product.type === "PHYSICAL" && <TableHead className="min-w-[60px]">Stock</TableHead>}
                          <TableHead className="min-w-[120px] hidden sm:table-cell">Options</TableHead>
                          <TableHead className="text-right min-w-[200px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variants.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedVariantIds.includes(v.id)}
                                onCheckedChange={(checked) =>
                                  toggleVariantSelection(v.id, Boolean(checked))
                                }
                                aria-label={`Select variant ${v.sku}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{v.sku}</TableCell>
                            <TableCell className="min-w-[240px] hidden lg:table-cell">
                              {(() => {
                                const barcodeCode = getPrimaryCode(v, "BARCODE");
                                const qrCode = getPrimaryCode(v, "QRCODE");

                                return (
                                  <div className="space-y-3 text-xs">
                                    <div className="space-y-1">
                                      <div>
                                        <span className="font-medium">Barcode:</span>{" "}
                                        {barcodeCode?.value || "-"}
                                      </div>
                                      {barcodeCode ? (
                                        <>
                                          <img
                                            src={buildCodeImageUrl(barcodeCode, "svg")}
                                            alt={`Barcode for ${v.sku}`}
                                            className="h-16 w-full max-w-[220px] rounded border bg-white object-contain p-1"
                                            loading="lazy"
                                          />
                                          <div className="flex flex-wrap gap-2">
                                            <a
                                              href={buildCodeImageUrl(barcodeCode, "svg")}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-primary underline underline-offset-2"
                                            >
                                              SVG
                                            </a>
                                            <a
                                              href={buildCodeImageUrl(barcodeCode, "png")}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-primary underline underline-offset-2"
                                            >
                                              PNG
                                            </a>
                                            <a
                                              href={buildCodeImageUrl(barcodeCode, "png", true)}
                                              className="text-primary underline underline-offset-2"
                                            >
                                              Download
                                            </a>
                                          </div>
                                        </>
                                      ) : null}
                                    </div>
                                    <div className="space-y-1">
                                      <div className="truncate">
                                        <span className="font-medium">QR:</span>{" "}
                                        {qrCode?.value || "-"}
                                      </div>
                                      {qrCode ? (
                                        <>
                                          <img
                                            src={buildCodeImageUrl(qrCode, "svg")}
                                            alt={`QR code for ${v.sku}`}
                                            className="h-28 w-28 rounded border bg-white p-1"
                                            loading="lazy"
                                          />
                                          <div className="flex flex-wrap gap-2">
                                            <a
                                              href={buildCodeImageUrl(qrCode, "svg")}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-primary underline underline-offset-2"
                                            >
                                              SVG
                                            </a>
                                            <a
                                              href={buildCodeImageUrl(qrCode, "png")}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-primary underline underline-offset-2"
                                                    >
                                              PNG
                                            </a>
                                            <a
                                              href={buildCodeImageUrl(qrCode, "png", true)}
                                              className="text-primary underline underline-offset-2"
                                            >
                                              Download
                                            </a>
                                          </div>
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{v.currency} {String(v.price)}</div>
                                <div className="lg:hidden text-xs text-muted-foreground mt-1">
                                  {v.options && typeof v.options === "object"
                                    ? Object.entries(v.options)
                                        .map(([k, val]) => `${k}: ${String(val)}`)
                                        .join(", ")
                                    : "-"}
                                </div>
                              </div>
                            </TableCell>
                            {product.type === "PHYSICAL" && (
                              <TableCell>{v.stock}</TableCell>
                            )}
                            <TableCell className="max-w-[320px] truncate hidden sm:table-cell">
                              {v.options && typeof v.options === "object"
                                ? Object.entries(v.options)
                                    .map(([k, val]) => `${k}: ${String(val)}`)
                                    .join(", ")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col sm:flex-row justify-end gap-1 sm:gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => printStickers([v.id])}
                                  className="w-full sm:w-auto"
                                >
                                  <Printer className="h-3 w-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Sticker</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => regenerateVariantCodes(v)}
                                  className="w-full sm:w-auto"
                                >
                                  <RefreshCw className="h-3 w-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Regenerate</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditVariant(v)}
                                  className="w-full sm:w-auto"
                                >
                                  <Edit3 className="h-3 w-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Edit</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive w-full sm:w-auto"
                                  onClick={() => deleteVariant(v.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="attributes" className="flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="border rounded-lg p-3 sm:p-4 space-y-3 bg-card">
                <p className="font-semibold text-sm sm:text-base">Add Product Attribute</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs sm:text-sm">Attribute</Label>
                    <select
                      className="border border-input bg-background text-sm p-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-ring"
                      value={newAttr.attributeId}
                      onChange={(e) =>
                        setNewAttr({ attributeId: e.target.value, value: "" })
                      }
                    >
                      <option value="">Select</option>
                      {availableAttributes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-2">
                    <Label className="text-xs sm:text-sm">Value</Label>
                    {selectedAttr?.type === "SELECT" || selectedAttr?.type === "COLOR" ? (
                      <select
                        className="w-full rounded-md border border-input bg-background p-2 text-sm"
                        value={newAttr.value}
                        onChange={(event) => setNewAttr({ ...newAttr, value: event.target.value })}
                      >
                        <option value="">Select</option>
                        {selectedAttr.values.map((item) => (
                          <option key={item.id} value={item.value}>{item.value}</option>
                        ))}
                      </select>
                    ) : selectedAttr?.type === "BOOLEAN" ? (
                      <select
                        className="w-full rounded-md border border-input bg-background p-2 text-sm"
                        value={newAttr.value}
                        onChange={(event) => setNewAttr({ ...newAttr, value: event.target.value })}
                      >
                        <option value="">Select</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : selectedAttr?.type === "MULTI_SELECT" && selectedAttr.values.length > 0 ? (
                      <select
                        multiple
                        className="min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm"
                        value={parseMultiSelectValue(newAttr.value)}
                        onChange={(event) => setNewAttr({
                          ...newAttr,
                          value: JSON.stringify(
                            Array.from(event.currentTarget.selectedOptions, (option) => option.value),
                          ),
                        })}
                      >
                        {selectedAttr.values.map((item) => (
                          <option key={item.id} value={item.value}>{item.value}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={selectedAttr?.type === "NUMBER" ? "number" : "text"}
                        step={selectedAttr?.type === "NUMBER" ? "any" : undefined}
                        value={newAttr.value}
                        onChange={(e) => setNewAttr({ ...newAttr, value: e.target.value })}
                        placeholder={selectedAttr?.type === "MULTI_SELECT" ? "Comma-separated values" : "Type value"}
                        className="text-sm"
                      />
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={addProductAttribute} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>

              {productAttributes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No product attributes yet
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Attribute</TableHead>
                          <TableHead className="min-w-[200px]">Value</TableHead>
                          <TableHead className="text-right min-w-[80px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productAttributes.map((pa) => (
                          <TableRow key={pa.id}>
                            <TableCell className="font-medium">
                              {pa.attribute?.name || pa.attributeId}
                            </TableCell>
                            <TableCell className="break-all">{pa.value}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive w-full sm:w-auto"
                                onClick={() => deleteProductAttribute(pa.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
            {product.type !== "PHYSICAL" ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-sm text-muted-foreground">
                  Inventory is only available for PHYSICAL products.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="w-full sm:w-auto">
                    <Label className="text-xs sm:text-sm">Variant</Label>
                    <select
                      className="border border-input bg-background text-sm p-2 rounded-md w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-ring"
                      value={selectedVariantId ?? ""}
                      onChange={(e) =>
                        setSelectedVariantId(
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    >
                      <option value="">Select</option>
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.sku}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedVariant && (
                    <p className="text-sm text-muted-foreground pt-6">
                      Total stock:{" "}
                      <span className="font-medium">{selectedVariant.stock}</span>
                    </p>
                  )}
                </div>

                {!selectedVariant ? (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-sm text-muted-foreground">
                      Select a variant to manage stock levels.
                    </p>
                  </div>
                ) : warehouses.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-sm text-muted-foreground">
                      No warehouses yet. Create one from the Warehouses button on the products page.
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[150px]">Warehouse</TableHead>
                            <TableHead className="min-w-[100px]">Quantity</TableHead>
                            <TableHead className="min-w-[80px]">Reserved</TableHead>
                            <TableHead className="min-w-[80px]">Available</TableHead>
                            <TableHead className="text-right min-w-[120px]">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {warehouses.map((w) => {
                            const level =
                              selectedVariant.stockLevels?.find(
                                (sl) => sl.warehouseId === w.id,
                              ) || null;
                            const reserved = level ? Number(level.reserved) : 0;
                            const qty = Number(stockDraft[w.id] ?? 0);
                            const available = Math.max(0, qty - reserved);

                            return (
                              <TableRow key={w.id}>
                                <TableCell className="font-medium">
                                  <div className="flex flex-col">
                                    <span>{w.name}</span>
                                    <span className="text-xs text-muted-foreground">({w.code})</span>
                                    {w.isDefault && (
                                      <span className="mt-1 text-xs px-2 py-0.5 rounded-full border inline-block w-fit">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    className="w-20 sm:w-28 text-sm"
                                    value={stockDraft[w.id] ?? "0"}
                                    onChange={(e) =>
                                      setStockDraft((prev) => ({
                                        ...prev,
                                        [w.id]: e.target.value,
                                      }))
                                    }
                                  />
                                </TableCell>
                                <TableCell>{reserved}</TableCell>
                                <TableCell>{available}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex flex-col sm:flex-row justify-end gap-1 sm:gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => saveStockLevel(w.id)}
                                      disabled={loading}
                                      className="w-full sm:w-auto"
                                    >
                                      Save
                                    </Button>
                                    {level && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-destructive w-full sm:w-auto"
                                        onClick={() => deleteStockLevel(level.id)}
                                        disabled={loading}
                                      >
                                        <Trash2 className="h-3 w-3" />
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
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {product.type === "SERVICE" && (
            <TabsContent value="service" className="flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="border rounded-lg p-3 sm:p-4 space-y-3 bg-card">
                  <p className="font-semibold text-sm sm:text-base">Add Service Slot</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs sm:text-sm">Start *</Label>
                      <Input
                        type="datetime-local"
                        value={slotForm.startsAt}
                        onChange={(e) =>
                          setSlotForm({ ...slotForm, startsAt: e.target.value })
                        }
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm">End *</Label>
                      <Input
                        type="datetime-local"
                        value={slotForm.endsAt}
                        onChange={(e) =>
                          setSlotForm({ ...slotForm, endsAt: e.target.value })
                        }
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs sm:text-sm">Capacity</Label>
                      <Input
                        type="number"
                        value={slotForm.capacity}
                        onChange={(e) =>
                          setSlotForm({ ...slotForm, capacity: e.target.value })
                        }
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm">Timezone</Label>
                      <Input
                        value={slotForm.timezone}
                        onChange={(e) =>
                          setSlotForm({ ...slotForm, timezone: e.target.value })
                        }
                        placeholder="Optional"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm">Location</Label>
                      <Input
                        value={slotForm.location}
                        onChange={(e) =>
                          setSlotForm({ ...slotForm, location: e.target.value })
                        }
                        placeholder="Optional"
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Notes</Label>
                    <Input
                      value={slotForm.notes}
                      onChange={(e) =>
                        setSlotForm({ ...slotForm, notes: e.target.value })
                      }
                      placeholder="Optional"
                      className="text-sm"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={addServiceSlot} className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Slot
                    </Button>
                  </div>
                </div>

                {serviceSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No service slots yet
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[140px]">Start</TableHead>
                            <TableHead className="min-w-[140px]">End</TableHead>
                            <TableHead className="min-w-[80px]">Capacity</TableHead>
                            <TableHead className="min-w-[80px]">Booked</TableHead>
                            <TableHead className="text-right min-w-[80px]">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {serviceSlots.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="text-xs sm:text-sm">
                                <div className="hidden sm:block">
                                  {String(s.startsAt).replace("T", " ").slice(0, 16)}
                                </div>
                                <div className="sm:hidden">
                                  {String(s.startsAt).replace("T", " ").slice(0, 10)}
                                  <br />
                                  {String(s.startsAt).replace("T", " ").slice(11, 16)}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm">
                                <div className="hidden sm:block">
                                  {String(s.endsAt).replace("T", " ").slice(0, 16)}
                                </div>
                                <div className="sm:hidden">
                                  {String(s.endsAt).replace("T", " ").slice(0, 10)}
                                  <br />
                                  {String(s.endsAt).replace("T", " ").slice(11, 16)}
                                </div>
                              </TableCell>
                              <TableCell>{s.capacity}</TableCell>
                              <TableCell>{s.bookedCount}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive w-full sm:w-auto"
                                  onClick={() => deleteServiceSlot(s.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {booksEnabled ? (
            <TabsContent value="book" className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-2xl space-y-5 rounded-lg border bg-card p-4 sm:p-6">
                <div>
                  <h3 className="font-semibold">Book-specific relations</h3>
                  <p className="text-sm text-muted-foreground">BookMetadata is authoritative and legacy fields are updated automatically during the compatibility window.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="book-writer">Writer</Label>
                    <select id="book-writer" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={bookMetadata.writerId} onChange={(event) => setBookMetadata((current) => ({ ...current, writerId: event.target.value }))}>
                      <option value="">No writer</option>
                      {writers.map((writer) => <option key={writer.id} value={writer.id}>{writer.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="book-publisher">Publisher</Label>
                    <select id="book-publisher" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={bookMetadata.publisherId} onChange={(event) => setBookMetadata((current) => ({ ...current, publisherId: event.target.value }))}>
                      <option value="">No publisher</option>
                      {publishers.map((publisher) => <option key={publisher.id} value={publisher.id}>{publisher.name}</option>)}
                    </select>
                  </div>
                </div>
                <Button type="button" onClick={() => void saveBookMetadata()} disabled={bookSaving}>
                  {bookSaving ? "Saving…" : "Save Book Metadata"}
                </Button>
              </div>
            </TabsContent>
          ) : null}

          <TabsContent value="logs" className="flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-sm text-muted-foreground">No inventory logs</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[140px]">Date</TableHead>
                          <TableHead className="min-w-[80px]">Change</TableHead>
                          <TableHead className="min-w-[100px]">Variant</TableHead>
                          <TableHead className="min-w-[100px]">Warehouse</TableHead>
                          <TableHead className="min-w-[200px]">Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="whitespace-nowrap text-xs sm:text-sm">
                              <div className="hidden sm:block">
                                {String(l.createdAt).replace("T", " ").slice(0, 19)}
                              </div>
                              <div className="sm:hidden">
                                {String(l.createdAt).replace("T", " ").slice(0, 10)}
                                <br />
                                {String(l.createdAt).replace("T", " ").slice(11, 19)}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">{l.change}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{l.variant?.sku || "-"}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{l.warehouse?.code || "-"}</TableCell>
                            <TableCell className="max-w-[200px] sm:max-w-[420px] truncate text-xs sm:text-sm">
                              {l.reason}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
