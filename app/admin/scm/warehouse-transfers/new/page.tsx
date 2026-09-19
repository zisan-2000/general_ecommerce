"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScmSectionHeader } from "@/components/admin/scm/ScmSectionHeader";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";

type Warehouse = {
  id: number;
  name: string;
  code: string;
};

type ProductVariant = {
  id: number;
  sku: string;
  product?: {
    name: string;
  };
};

type WarehouseTransfer = {
  id: number;
  transferNumber: string;
};

type DraftItem = {
  productVariantId: string;
  quantityRequested: string;
  description: string;
};

const emptyLine = (): DraftItem => ({
  productVariantId: "",
  quantityRequested: "",
  description: "",
});

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || fallback);
  }
  return payload as T;
}

export default function NewWarehouseTransferPage() {
  const tScm = useTranslations("ScmAuto");
  const router = useRouter();
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];
  const canManage = permissions.includes("warehouse_transfers.manage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [requiredBy, setRequiredBy] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyLine()]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const loadReferenceData = async () => {
    try {
      setLoading(true);
      const [warehouseData, variantData] = await Promise.all([
        fetch("/api/warehouses", { cache: "no-store" }).then((response) =>
          readJson<Warehouse[]>(response, "Failed to load warehouses"),
        ),
        fetch("/api/product-variants", { cache: "no-store" }).then((response) =>
          readJson<ProductVariant[]>(response, "Failed to load product variants"),
        ),
      ]);
      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
      setVariants(Array.isArray(variantData) ? variantData : []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load transfer references");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) {
      void loadReferenceData();
    }
  }, [canManage]);

  const updateItem = (index: number, key: keyof DraftItem, value: string) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  };

  const summary = useMemo(
    () => ({
      warehouses: warehouses.length,
      variants: variants.length,
      lines: items.length,
    }),
    [items.length, variants.length, warehouses.length],
  );

  const createTransfer = async () => {
    if (!sourceWarehouseId || !destinationWarehouseId) {
      toast.error(tScm("k_1a8d8577ebc0"));
      return;
    }
    if (sourceWarehouseId === destinationWarehouseId) {
      toast.error(tScm("k_0db18d43befc"));
      return;
    }

    const payloadItems = items
      .map((item) => ({
        productVariantId: Number(item.productVariantId),
        quantityRequested: Number(item.quantityRequested),
        description: item.description.trim(),
      }))
      .filter(
        (item) =>
          Number.isInteger(item.productVariantId) &&
          item.productVariantId > 0 &&
          Number.isInteger(item.quantityRequested) &&
          item.quantityRequested > 0,
      );

    if (payloadItems.length === 0) {
      toast.error(tScm("k_83be47018fcf"));
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/scm/warehouse-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceWarehouseId: Number(sourceWarehouseId),
          destinationWarehouseId: Number(destinationWarehouseId),
          requiredBy: requiredBy || null,
          note,
          items: payloadItems,
        }),
      });
      const created = await readJson<WarehouseTransfer>(
        response,
        "Failed to create warehouse transfer",
      );
      toast.success(tScm("k_83518dc2217a"));
      router.push(`/admin/scm/warehouse-transfers?search=${encodeURIComponent(created.transferNumber)}`);
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create warehouse transfer");
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{tScm("k_3dab5f6012e3")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {tScm("k_e5eba228d0c1")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <ScmSectionHeader
        title={tScm("k_dd26e793495a")}
        description={tScm("k_267bcd836cb9")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/scm/warehouse-transfers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tScm("k_31c9b2152c0c")}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void loadReferenceData()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {tScm("k_56e3badc4e6c")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <ScmStatCard label={tScm("k_65d6e169cb6e")} value={String(summary.warehouses)} hint={tScm("k_88a2d7dbdfc7")} />
        <ScmStatCard label={tScm("k_1bc3d368f8ad")} value={String(summary.variants)} hint={tScm("k_66328361e551")} />
        <ScmStatCard label={tScm("k_4dfc24a609dc")} value={String(summary.lines)} hint={tScm("k_4b4ee6a1cd98")} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_d9dc44ffcc32")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>{tScm("k_8b4bc74e600f")}</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={sourceWarehouseId}
              onChange={(event) => setSourceWarehouseId(event.target.value)}
            >
              <option value="">{tScm("k_cfab2ae6ca21")}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{tScm("k_b04156809d3f")}</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={destinationWarehouseId}
              onChange={(event) => setDestinationWarehouseId(event.target.value)}
            >
              <option value="">{tScm("k_cfab2ae6ca21")}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{tScm("k_e0951fc243c4")}</Label>
            <Input
              type="datetime-local"
              value={requiredBy}
              onChange={(event) => setRequiredBy(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{tScm("k_2c924e308820")}</Label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_0248c1602a16")}</CardTitle>
          <CardDescription>
            {tScm("k_faf5b6027fb9")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{tScm("k_4846eb7678d2")}</Label>
            <Button
              type="button"
              variant="outline"
              onClick={() => setItems((current) => [...current, emptyLine()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              {tScm("k_63dcfb6701b9")}
            </Button>
          </div>

          {items.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[2fr_1fr_2fr_auto]">
              <div className="space-y-2">
                <Label>{tScm("k_cc91b1ea2c16")}</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={item.productVariantId}
                  onChange={(event) => updateItem(index, "productVariantId", event.target.value)}
                >
                  <option value="">{tScm("k_3785e871dc02")}</option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.product?.name ?? "Variant"} ({variant.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{tScm("k_1e5ff9e500c2")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={item.quantityRequested}
                  onChange={(event) => updateItem(index, "quantityRequested", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{tScm("k_55f8ebc805e6")}</Label>
                <Input
                  value={item.description}
                  onChange={(event) => updateItem(index, "description", event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={items.length === 1}
                  onClick={() =>
                    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  {tScm("k_e963907dac5c")}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_8de48bbefeb1")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            {tScm("k_873c325d95b6")}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/admin/scm/warehouse-transfers")}>
              {tScm("k_77dfd2135f4d")}
            </Button>
            <Button onClick={() => void createTransfer()} disabled={saving || loading}>
              {saving ? "Saving..." : "Create Transfer"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
