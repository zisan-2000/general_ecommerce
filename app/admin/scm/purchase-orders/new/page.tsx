"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";

type Supplier = { id: number; name: string; code: string; currency: string };
type Warehouse = { id: number; name: string; code: string };
type Variant = { id: number; sku: string; productId: number; stock: number };
type PurchaseOrderTermsTemplate = { id: number; code: string; name: string; body: string; isDefault: boolean; isActive: boolean };
type PurchaseOrderDraftItem = { productVariantId: string; quantityOrdered: string; unitCost: string; description: string };

const emptyLine = (): PurchaseOrderDraftItem => ({
  productVariantId: "",
  quantityOrdered: "1",
  unitCost: "",
  description: "",
});

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || fallbackMessage);
  }
  return data as T;
}

export default function NewPurchaseOrderPage() {
  const tScm = useTranslations("ScmAuto");
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [termsTemplates, setTermsTemplates] = useState<PurchaseOrderTermsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [termsTemplateId, setTermsTemplateId] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [items, setItems] = useState<PurchaseOrderDraftItem[]>([emptyLine()]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [warehousesRes, variantsRes, suppliersRes, templatesRes] = await Promise.all([
        fetch("/api/warehouses", { cache: "no-store" }),
        fetch("/api/product-variants", { cache: "no-store" }),
        fetch("/api/scm/suppliers", { cache: "no-store" }),
        fetch("/api/scm/purchase-order-terms-templates", { cache: "no-store" }),
      ]);
      const [warehouseData, variantData, supplierData, templateData] = await Promise.all([
        readJson<Warehouse[]>(warehousesRes, "Failed to load warehouses"),
        readJson<Variant[]>(variantsRes, "Failed to load variants"),
        readJson<Supplier[]>(suppliersRes, "Failed to load suppliers"),
        readJson<PurchaseOrderTermsTemplate[]>(templatesRes, "Failed to load PO terms templates"),
      ]);
      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
      setVariants(Array.isArray(variantData) ? variantData : []);
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setTermsTemplates(Array.isArray(templateData) ? templateData : []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load purchase order setup data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const defaultTemplate = useMemo(
    () => termsTemplates.find((template) => template.isDefault) ?? termsTemplates[0] ?? null,
    [termsTemplates],
  );

  useEffect(() => {
    if (!termsTemplateId && defaultTemplate) {
      setTermsTemplateId(String(defaultTemplate.id));
      setTermsAndConditions(defaultTemplate.body);
    }
  }, [defaultTemplate, termsTemplateId]);

  const applyTemplateSelection = (nextTemplateId: string) => {
    setTermsTemplateId(nextTemplateId);
    const selectedTemplate = termsTemplates.find((template) => String(template.id) === nextTemplateId);
    if (selectedTemplate) {
      setTermsAndConditions(selectedTemplate.body);
      return;
    }
    if (!nextTemplateId) {
      setTermsAndConditions("");
    }
  };

  const estimatedTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantityOrdered);
      const unitCost = Number(item.unitCost);
      if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) return sum;
      return sum + quantity * unitCost;
    }, 0);
  }, [items]);

  const createPurchaseOrder = async () => {
    if (!supplierId || !warehouseId) {
      toast.error(tScm("k_9f9b8f762ecc"));
      return;
    }
    try {
      setSaving(true);
      const response = await fetch("/api/scm/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: Number(supplierId),
          warehouseId: Number(warehouseId),
          expectedAt: expectedAt || null,
          notes,
          termsTemplateId: termsTemplateId ? Number(termsTemplateId) : null,
          termsAndConditions,
          items: items.map((item) => ({
            productVariantId: Number(item.productVariantId),
            quantityOrdered: Number(item.quantityOrdered),
            unitCost: Number(item.unitCost),
            description: item.description,
          })),
        }),
      });
      const created = await readJson<{ id: number }>(response, "Failed to create purchase order");
      toast.success(tScm("k_f490986bc6c4"));
      router.push(`/admin/scm/purchase-orders/${created.id}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to create purchase order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/scm/purchase-orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tScm("k_1763e9ae8697")}
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{tScm("k_ab431d5b6294")}</h1>
            <p className="text-sm text-muted-foreground">
              {tScm("k_bab20a84a581")}
            </p>
          </div>
        </div>
        <Button onClick={() => void createPurchaseOrder()} disabled={saving || loading}>
          {saving ? "Saving..." : "Create Draft"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ScmStatCard label={tScm("k_55edd462872a")} value={suppliers.find((row) => row.id === Number(supplierId))?.name || "Not selected"} hint={tScm("k_d039fe161d05")} />
        <ScmStatCard label={tScm("k_298dff72dae2")} value={warehouses.find((row) => row.id === Number(warehouseId))?.name || "Not selected"} hint={tScm("k_0fdadd25e9a3")} />
        <ScmStatCard label={tScm("k_c6fd3870c86e")} value={String(items.length)} hint={tScm("k_167eb397b036")} />
        <ScmStatCard label={tScm("k_1636f5a9808d")} value={estimatedTotal.toFixed(2)} hint={suppliers.find((row) => row.id === Number(supplierId))?.currency || "BDT"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_f586059328a9")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>{tScm("k_55edd462872a")}</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                  <option value="">{tScm("k_cfce52686188")}</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name} ({supplier.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{tScm("k_298dff72dae2")}</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
                  <option value="">{tScm("k_cfab2ae6ca21")}</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{tScm("k_b8130a089018")}</Label>
                <Input type="date" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_2ee79a96103d")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{tScm("k_6b19500df386")}</p>
                <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, emptyLine()])}>
                  <Plus className="mr-2 h-4 w-4" />
                  {tScm("k_63dcfb6701b9")}
                </Button>
              </div>
              {items.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[2fr_1fr_1fr_2fr_auto]">
                  <div>
                    <Label>{tScm("k_cc91b1ea2c16")}</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2" value={item.productVariantId} onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, productVariantId: event.target.value } : row))}>
                      <option value="">{tScm("k_3785e871dc02")}</option>
                      {variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>{variant.sku}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>{tScm("k_1e5ff9e500c2")}</Label>
                    <Input type="number" min="1" value={item.quantityOrdered} onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, quantityOrdered: event.target.value } : row))} />
                  </div>
                  <div>
                    <Label>{tScm("k_0105252023c5")}</Label>
                    <Input type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, unitCost: event.target.value } : row))} />
                  </div>
                  <div>
                    <Label>{tScm("k_55f8ebc805e6")}</Label>
                    <Input value={item.description} onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} />
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" size="icon" onClick={() => setItems((prev) => prev.length === 1 ? prev : prev.filter((_, rowIndex) => rowIndex !== index))} disabled={items.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_3ebb7be64f01")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tScm("k_d4d97a486a7e")}</Label>
                  <select className="w-full rounded-md border bg-background px-3 py-2" value={termsTemplateId} onChange={(event) => applyTemplateSelection(event.target.value)}>
                    <option value="">{tScm("k_aaeb18315059")}</option>
                    {termsTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}{template.isDefault ? " (Default)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{tScm("k_70440046a3dc")}</Label>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
                </div>
              </div>
              <div>
                <Label>{tScm("k_894031ed8d34")}</Label>
                <Textarea value={termsAndConditions} onChange={(event) => setTermsAndConditions(event.target.value)} rows={7} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_61b294646988")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className={supplierId ? "text-foreground" : "text-muted-foreground"}>{tScm("k_177a2e385661")}</div>
              <div className={warehouseId ? "text-foreground" : "text-muted-foreground"}>{tScm("k_cd0191561649")}</div>
              <div className={items.some((item) => item.productVariantId && item.unitCost && item.quantityOrdered) ? "text-foreground" : "text-muted-foreground"}>{tScm("k_201e8d5ef1cd")}</div>
              <div className={termsAndConditions ? "text-foreground" : "text-muted-foreground"}>{tScm("k_1b65922f82cb")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_4e141c6d3967")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_b8130a089018")}</div>
                <div className="mt-1 font-medium">{expectedAt || "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_4e279c840887")}</div>
                <div className="mt-1 font-medium">{items.length}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_d4d97a486a7e")}</div>
                <div className="mt-1 font-medium">{termsTemplates.find((template) => String(template.id) === termsTemplateId)?.name || "Custom / None"}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
