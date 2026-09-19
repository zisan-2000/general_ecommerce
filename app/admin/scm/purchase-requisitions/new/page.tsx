"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { uploadFile } from "@/lib/upload-file";

type Warehouse = {
  id: number;
  name: string;
  code: string;
};

type Variant = {
  id: number;
  sku: string;
  productId: number;
  stock: number;
  product?: {
    id: number;
    name: string;
  };
};

type DraftItem = {
  productVariantId: string;
  quantityRequested: string;
  description: string;
};

type RequisitionAttachmentDraft = {
  file?: File;
  fileUrl?: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  note?: string;
};

const emptyLine = (): DraftItem => ({
  productVariantId: "",
  quantityRequested: "1",
  description: "",
});

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || fallbackMessage);
  }
  return data as T;
}

export default function NewPurchaseRequisitionPage() {
  const tScm = useTranslations("ScmAuto");
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [warehouseId, setWarehouseId] = useState("");
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [budgetCode, setBudgetCode] = useState("");
  const [boqReference, setBoqReference] = useState("");
  const [specification, setSpecification] = useState("");
  const [planningNote, setPlanningNote] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [endorsementRequiredCount, setEndorsementRequiredCount] = useState("1");
  const [neededBy, setNeededBy] = useState("");
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<RequisitionAttachmentDraft[]>([]);
  const [items, setItems] = useState<DraftItem[]>([emptyLine()]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [warehousesRes, variantsRes] = await Promise.all([
        fetch("/api/warehouses", { cache: "no-store" }),
        fetch("/api/product-variants", { cache: "no-store" }),
      ]);
      const [warehouseData, variantData] = await Promise.all([
        readJson<Warehouse[]>(warehousesRes, "Failed to load warehouses"),
        readJson<Variant[]>(variantsRes, "Failed to load variants"),
      ]);
      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
      setVariants(Array.isArray(variantData) ? variantData : []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load requisition setup data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === Number(warehouseId)) ?? null,
    [warehouseId, warehouses],
  );

  const selectedItems = useMemo(() => {
    return items
      .map((item) => ({
        ...item,
        variant: variants.find((variant) => variant.id === Number(item.productVariantId)) ?? null,
      }))
      .filter((item) => item.variant);
  }, [items, variants]);

  const updateItem = (index: number, key: keyof DraftItem, value: string) => {
    setItems((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  };

  const addAttachmentRows = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = [...files].slice(0, 20).map((file) => ({
      file,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      note: "",
    }));
    setAttachments((prev) => [...prev, ...next].slice(0, 20));
  };

  const updateAttachmentNote = (index: number, value: string) => {
    setAttachments((prev) =>
      prev.map((attachment, itemIndex) =>
        itemIndex === index ? { ...attachment, note: value } : attachment,
      ),
    );
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const resetForm = () => {
    setWarehouseId("");
    setTitle("");
    setPurpose("");
    setBudgetCode("");
    setBoqReference("");
    setSpecification("");
    setPlanningNote("");
    setEstimatedAmount("");
    setEndorsementRequiredCount("1");
    setNeededBy("");
    setNote("");
    setAttachments([]);
    setItems([emptyLine()]);
  };

  const deleteLocalUpload = (fileUrl: string) => {
    if (!fileUrl.startsWith("/upload/")) return Promise.resolve();
    return fetch(`/api/delete-file?path=${encodeURIComponent(fileUrl.replace(/^\//, ""))}`, {
      method: "DELETE",
    }).catch(() => undefined);
  };

  const createRequisition = async () => {
    if (!warehouseId) {
      toast.error(tScm("k_8e8ea1054915"));
      return;
    }

    const validItems = items.filter((item) => item.productVariantId && Number(item.quantityRequested) > 0);
    if (validItems.length === 0) {
      toast.error(tScm("k_1ce5a25eaeb0"));
      return;
    }

    const uploadedFileUrls: string[] = [];
    try {
      setSaving(true);
      const uploadedAttachments = [];
      for (const attachment of attachments) {
        if (!attachment.file) continue;
        const fileUrl = await uploadFile(attachment.file);
        uploadedFileUrls.push(fileUrl);
        uploadedAttachments.push({
          fileUrl,
          fileName: attachment.fileName || attachment.file.name,
          mimeType: attachment.mimeType || attachment.file.type || null,
          fileSize: attachment.fileSize || attachment.file.size || null,
          note: attachment.note?.trim() || null,
        });
      }

      const response = await fetch("/api/scm/purchase-requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: Number(warehouseId),
          title,
          purpose,
          budgetCode,
          boqReference,
          specification,
          planningNote,
          estimatedAmount: estimatedAmount || null,
          endorsementRequiredCount: Number(endorsementRequiredCount || 1),
          neededBy: neededBy || null,
          note,
          attachments: uploadedAttachments,
          items: validItems.map((item) => ({
            productVariantId: Number(item.productVariantId),
            quantityRequested: Number(item.quantityRequested),
            description: item.description,
          })),
        }),
      });

      const created = await readJson<{ id: number }>(response, "Failed to create purchase requisition");
      toast.success(tScm("k_2ca891706785"));
      router.push(`/admin/scm/purchase-requisitions/${created.id}`);
    } catch (error: any) {
      await Promise.all(uploadedFileUrls.map((fileUrl) => deleteLocalUpload(fileUrl)));
      toast.error(error?.message || "Failed to create purchase requisition");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/scm/purchase-requisitions">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tScm("k_1763e9ae8697")}
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{tScm("k_b1a907b8a356")}</h1>
            <p className="text-sm text-muted-foreground">
              {tScm("k_bda7616d2d91")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetForm} disabled={saving}>
            {tScm("k_719ea396ad92")}
          </Button>
          <Button onClick={() => void createRequisition()} disabled={saving || loading}>
            {saving ? "Saving..." : "Create Draft"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ScmStatCard label={tScm("k_298dff72dae2")} value={selectedWarehouse?.name || "Not selected"} hint={selectedWarehouse?.code || "Choose operating warehouse"} />
        <ScmStatCard label={tScm("k_7cea20a1a00e")} value={String(selectedItems.length)} hint={tScm("k_fa0633a13f98")} />
        <ScmStatCard label={tScm("k_6771ade6e896")} value={String(attachments.length)} hint={tScm("k_143e819fb605")} />
        <ScmStatCard label={tScm("k_7b4964797053")} value={estimatedAmount || "0.00"} hint={budgetCode || "Budget code pending"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_34301a7ccc8c")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>{tScm("k_367675b2142f")}</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={tScm("k_d47963204654")} />
              </div>
              <div>
                <Label>{tScm("k_298dff72dae2")}</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
                  <option value="">{tScm("k_cfab2ae6ca21")}</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{tScm("k_a0fb821bdaf9")}</Label>
                <Input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder={tScm("k_055e139d452b")} />
              </div>
              <div>
                <Label>{tScm("k_7b1121c3271f")}</Label>
                <Input type="date" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} />
              </div>
              <div>
                <Label>{tScm("k_88f4ea85a48f")}</Label>
                <Input value={budgetCode} onChange={(event) => setBudgetCode(event.target.value)} placeholder={tScm("k_14085eebcd80")} />
              </div>
              <div>
                <Label>{tScm("k_f3ffde94f687")}</Label>
                <Input value={boqReference} onChange={(event) => setBoqReference(event.target.value)} placeholder={tScm("k_91455af71045")} />
              </div>
              <div>
                <Label>{tScm("k_7b4964797053")}</Label>
                <Input type="number" min="0" step="0.01" value={estimatedAmount} onChange={(event) => setEstimatedAmount(event.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label>{tScm("k_cf356bf4d9ce")}</Label>
                <Input type="number" min="1" value={endorsementRequiredCount} onChange={(event) => setEndorsementRequiredCount(event.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>{tScm("k_1ccf5d25dfed")}</Label>
                <Textarea rows={4} value={specification} onChange={(event) => setSpecification(event.target.value)} placeholder={tScm("k_2eeca991e648")} />
              </div>
              <div className="md:col-span-2">
                <Label>{tScm("k_5ecebcab21fd")}</Label>
                <Textarea rows={4} value={planningNote} onChange={(event) => setPlanningNote(event.target.value)} placeholder={tScm("k_e06a85e7a98a")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_b9408be854cc")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{tScm("k_30a46f2a7b9c")}</p>
                <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, emptyLine()])}>
                  <Plus className="mr-2 h-4 w-4" />
                  {tScm("k_63dcfb6701b9")}
                </Button>
              </div>
              {items.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[2fr_1fr_2fr_auto]">
                  <div>
                    <Label>{tScm("k_cc91b1ea2c16")}</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2" value={item.productVariantId} onChange={(event) => updateItem(index, "productVariantId", event.target.value)}>
                      <option value="">{tScm("k_3785e871dc02")}</option>
                      {variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.product?.name || "Variant"} ({variant.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>{tScm("k_1e5ff9e500c2")}</Label>
                    <Input type="number" min="1" value={item.quantityRequested} onChange={(event) => updateItem(index, "quantityRequested", event.target.value)} />
                  </div>
                  <div>
                    <Label>{tScm("k_55f8ebc805e6")}</Label>
                    <Input value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} placeholder={tScm("k_06d78feb5eac")} />
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" size="icon" onClick={() => setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index)))} disabled={items.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_e4f9f5d15379")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-dashed p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Paperclip className="h-4 w-4" />
                  {tScm("k_a127925a2d60")}
                </div>
                <Input type="file" multiple onChange={(event) => addAttachmentRows(event.target.files)} />
                <p className="mt-2 text-xs text-muted-foreground">{tScm("k_61760d179663")}</p>
              </div>
              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((attachment, index) => (
                    <div key={`${attachment.fileName}-${index}`} className="grid gap-2 rounded-md border p-2 md:grid-cols-[2fr_3fr_auto]">
                      <div className="text-sm text-muted-foreground">{attachment.fileName}</div>
                      <Input placeholder={tScm("k_50e053baa1b9")} value={attachment.note || ""} onChange={(event) => updateAttachmentNote(index, event.target.value)} />
                      <Button type="button" variant="outline" size="sm" onClick={() => removeAttachment(index)}>
                        {tScm("k_e963907dac5c")}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div>
                <Label>{tScm("k_70440046a3dc")}</Label>
                <Textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder={tScm("k_d9d0bf2f6f8a")} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_d9714b944053")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className={warehouseId ? "text-foreground" : "text-muted-foreground"}>{tScm("k_ee2b430356bc")}</div>
              <div className={selectedItems.length > 0 ? "text-foreground" : "text-muted-foreground"}>{tScm("k_7f54a8059022")}</div>
              <div className={purpose ? "text-foreground" : "text-muted-foreground"}>{tScm("k_e87ed78c946f")}</div>
              <div className={budgetCode ? "text-foreground" : "text-muted-foreground"}>{tScm("k_3d9b758243b3")}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_ecb221545370")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_298dff72dae2")}</div>
                <div className="mt-1 font-medium">{selectedWarehouse ? `${selectedWarehouse.name} (${selectedWarehouse.code})` : "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_7b1121c3271f")}</div>
                <div className="mt-1 font-medium">{neededBy || "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_c6fd3870c86e")}</div>
                <div className="mt-1 font-medium">{selectedItems.length}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_6771ade6e896")}</div>
                <div className="mt-1 font-medium">{attachments.length}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
