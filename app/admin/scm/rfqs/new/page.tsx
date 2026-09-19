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

type Warehouse = { id: number; name: string; code: string };
type Supplier = { id: number; name: string; code: string };
type SupplierCategory = { id: number; name: string; code: string };
type Variant = { id: number; sku: string; product?: { name: string } };
type PurchaseRequisition = {
  id: number;
  requisitionNumber: string;
  warehouseId: number;
  title: string | null;
  purpose: string | null;
  budgetCode: string | null;
  boqReference: string | null;
  specification: string | null;
};

type DraftLine = {
  productVariantId: string;
  quantityRequested: string;
  targetUnitCost: string;
  description: string;
};

type DraftAttachment = {
  file: File;
  label: string;
};

const emptyLine = (): DraftLine => ({
  productVariantId: "",
  quantityRequested: "1",
  targetUnitCost: "",
  description: "",
});

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { error?: string }).error || fallback);
  return payload as T;
}

export default function NewRfqPage() {
  const tScm = useTranslations("ScmAuto");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [supplierCategories, setSupplierCategories] = useState<SupplierCategory[]>([]);
  const [approvedRequisitions, setApprovedRequisitions] = useState<PurchaseRequisition[]>([]);

  const [warehouseId, setWarehouseId] = useState("");
  const [purchaseRequisitionId, setPurchaseRequisitionId] = useState("");
  const [useRequisitionItems, setUseRequisitionItems] = useState(true);
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [note, setNote] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [boqDetails, setBoqDetails] = useState("");
  const [technicalSpecifications, setTechnicalSpecifications] = useState("");
  const [evaluationCriteria, setEvaluationCriteria] = useState("Technical compliance, lead time, pricing, service capability");
  const [resubmissionAllowed, setResubmissionAllowed] = useState(true);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [warehouseRes, variantRes, categoryRes, requisitionRes] = await Promise.all([
        fetch("/api/warehouses", { cache: "no-store" }),
        fetch("/api/product-variants", { cache: "no-store" }),
        fetch("/api/scm/supplier-categories?active=true", { cache: "no-store" }),
        fetch("/api/scm/purchase-requisitions?status=APPROVED", { cache: "no-store" }),
      ]);
      const [warehouseData, variantData, categoryData, requisitionData] = await Promise.all([
        readJson<Warehouse[]>(warehouseRes, "Failed to load warehouses"),
        readJson<Variant[]>(variantRes, "Failed to load variants"),
        readJson<SupplierCategory[]>(categoryRes, "Failed to load supplier categories"),
        readJson<PurchaseRequisition[]>(requisitionRes, "Failed to load approved MRFs"),
      ]);
      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
      setVariants(Array.isArray(variantData) ? variantData : []);
      setSupplierCategories(Array.isArray(categoryData) ? categoryData : []);
      setApprovedRequisitions(Array.isArray(requisitionData) ? requisitionData : []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load RFQ setup data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedRequisition = useMemo(
    () => approvedRequisitions.find((requisition) => requisition.id === Number(purchaseRequisitionId)) ?? null,
    [approvedRequisitions, purchaseRequisitionId],
  );

  useEffect(() => {
    if (!selectedRequisition) return;
    setWarehouseId(String(selectedRequisition.warehouseId));
    setScopeOfWork((current) => current || selectedRequisition.purpose || "");
    setBoqDetails((current) => current || selectedRequisition.boqReference || "");
    setTechnicalSpecifications((current) => current || selectedRequisition.specification || "");
  }, [selectedRequisition]);

  const validLines = useMemo(() => {
    return lines
      .map((line) => ({
        productVariantId: Number(line.productVariantId),
        quantityRequested: Number(line.quantityRequested),
        targetUnitCost: line.targetUnitCost ? Number(line.targetUnitCost) : null,
        description: line.description,
      }))
      .filter((line) => Number.isInteger(line.productVariantId) && line.productVariantId > 0 && Number.isInteger(line.quantityRequested) && line.quantityRequested > 0);
  }, [lines]);

  const addAttachment = (file: File | null) => {
    if (!file) return;
    setAttachments((current) => [...current, { file, label: "" }]);
  };

  const createRfq = async () => {
    if (!warehouseId) {
      toast.error(tScm("k_8e8ea1054915"));
      return;
    }
    if (selectedCategoryIds.length === 0) {
      toast.error(tScm("k_fb1119c4687c"));
      return;
    }

    const shouldSendManualItems = !purchaseRequisitionId || !useRequisitionItems;
    if (shouldSendManualItems && validLines.length === 0) {
      toast.error(tScm("k_98ca8d818152"));
      return;
    }

    setSaving(true);
    const uploadedAttachments: Array<{ fileUrl: string; fileName: string | null; mimeType: string | null; fileSize: number | null; label: string }> = [];
    try {
      for (const attachment of attachments) {
        const fileUrl = await uploadFile(attachment.file);
        uploadedAttachments.push({
          fileUrl,
          fileName: attachment.file.name,
          mimeType: attachment.file.type || null,
          fileSize: attachment.file.size,
          label: attachment.label.trim(),
        });
      }

      const response = await fetch("/api/scm/rfqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: Number(warehouseId),
          purchaseRequisitionId: purchaseRequisitionId ? Number(purchaseRequisitionId) : null,
          submissionDeadline: submissionDeadline || null,
          note,
          scopeOfWork,
          termsAndConditions,
          boqDetails,
          technicalSpecifications,
          evaluationCriteria,
          resubmissionAllowed,
          categoryIds: selectedCategoryIds.map((value) => Number(value)),
          attachments: uploadedAttachments,
          items: shouldSendManualItems ? validLines : [],
        }),
      });
      const created = await readJson<{ id: number }>(response, "Failed to create RFQ");
      toast.success(tScm("k_c066c294eb90"));
      router.push(`/admin/scm/rfqs/${created.id}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to create RFQ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/scm/rfqs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tScm("k_1763e9ae8697")}
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{tScm("k_80d8bf8ae26e")}</h1>
            <p className="text-sm text-muted-foreground">
              {tScm("k_102e44a0cc1d")}
            </p>
          </div>
        </div>
        <Button onClick={() => void createRfq()} disabled={saving || loading}>
          {saving ? "Saving..." : "Create RFQ Draft"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ScmStatCard label={tScm("k_298dff72dae2")} value={selectedRequisition ? warehouses.find((item) => item.id === selectedRequisition.warehouseId)?.name || "Inherited" : warehouses.find((item) => item.id === Number(warehouseId))?.name || "Not selected"} hint={selectedRequisition ? "Inherited from approved MRF" : "Choose sourcing warehouse"} />
        <ScmStatCard label={tScm("k_6ccb60071be8")} value={String(selectedCategoryIds.length)} hint={tScm("k_007cde8961fb")} />
        <ScmStatCard label={tScm("k_c6fd3870c86e")} value={String(validLines.length)} hint={purchaseRequisitionId && useRequisitionItems ? "Auto-pulled from MRF" : "Manual RFQ lines"} />
        <ScmStatCard label={tScm("k_6771ade6e896")} value={String(attachments.length)} hint={tScm("k_70e0dd3799f5")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_590aa6c76fec")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label>{tScm("k_e64043a21b30")}</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={purchaseRequisitionId} onChange={(e) => setPurchaseRequisitionId(e.target.value)}>
                  <option value="">{tScm("k_0c6c4102d4df")}</option>
                  {approvedRequisitions.map((requisition) => (
                    <option key={requisition.id} value={requisition.id}>{requisition.requisitionNumber}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{tScm("k_da81902f60ba")}</Label>
                <Input type="date" value={submissionDeadline} onChange={(e) => setSubmissionDeadline(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>{tScm("k_298dff72dae2")}</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  <option value="">{tScm("k_cfab2ae6ca21")}</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>
                  ))}
                </select>
              </div>
              {purchaseRequisitionId ? (
                <label className="md:col-span-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useRequisitionItems} onChange={(e) => setUseRequisitionItems(e.target.checked)} />
                  {tScm("k_079ed84d1cde")}
                </label>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_8a1c73115e1f")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><Label>{tScm("k_07438684e480")}</Label><Textarea rows={3} value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)} /></div>
              <div><Label>{tScm("k_894031ed8d34")}</Label><Textarea rows={3} value={termsAndConditions} onChange={(e) => setTermsAndConditions(e.target.value)} /></div>
              <div><Label>{tScm("k_61371345ade1")}</Label><Textarea rows={2} value={boqDetails} onChange={(e) => setBoqDetails(e.target.value)} /></div>
              <div><Label>{tScm("k_9719a1d80d88")}</Label><Textarea rows={2} value={technicalSpecifications} onChange={(e) => setTechnicalSpecifications(e.target.value)} /></div>
              <div><Label>{tScm("k_19fbd3efcc80")}</Label><Textarea rows={2} value={evaluationCriteria} onChange={(e) => setEvaluationCriteria(e.target.value)} /></div>
              <div><Label>{tScm("k_2c924e308820")}</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_822a555dddc2")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-3">
                {supplierCategories.map((category) => {
                  const checked = selectedCategoryIds.includes(String(category.id));
                  return (
                    <label key={category.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedCategoryIds((current) =>
                            checked ? current.filter((value) => value !== String(category.id)) : [...current, String(category.id)],
                          )
                        }
                      />
                      {category.name} ({category.code})
                    </label>
                  );
                })}
              </div>
              {supplierCategories.length === 0 ? (
                <p className="text-sm text-amber-700">
                  {tScm("k_7a1a2eb61569")}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {tScm("k_079d9051b7d9")}
                </p>
              )}
              <div className="space-y-2">
                <Label>{tScm("k_bb2679bcd42b")}</Label>
                <Input type="file" onChange={(event) => {
                  const file = event.target.files?.[0];
                  addAttachment(file || null);
                  event.target.value = "";
                }} />
                {attachments.length > 0 ? (
                  <div className="space-y-2">
                    {attachments.map((attachment, index) => (
                      <div key={`${attachment.file.name}-${index}`} className="grid gap-2 rounded-md border p-2 md:grid-cols-[2fr_2fr_auto]">
                        <div className="text-sm">{attachment.file.name}</div>
                        <Input placeholder={tScm("k_8496866d89b4")} value={attachment.label} onChange={(event) => setAttachments((current) => current.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} />
                        <Button variant="outline" size="sm" onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}>{tScm("k_e963907dac5c")}</Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {!useRequisitionItems || !purchaseRequisitionId ? (
            <Card>
              <CardHeader>
                <CardTitle>{tScm("k_d64c7dd80e94")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{tScm("k_98981f5f8875")}</p>
                  <Button variant="outline" size="sm" onClick={() => setLines((cur) => [...cur, emptyLine()])}>
                    <Plus className="mr-2 h-4 w-4" />
                    {tScm("k_63dcfb6701b9")}
                  </Button>
                </div>
                {lines.map((line, index) => (
                  <div key={index} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[2fr_1fr_1fr_2fr_auto]">
                    <select className="rounded-md border bg-background px-3 py-2" value={line.productVariantId} onChange={(e) => setLines((cur) => cur.map((item, i) => i === index ? { ...item, productVariantId: e.target.value } : item))}>
                      <option value="">{tScm("k_cc91b1ea2c16")}</option>
                      {variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>{variant.product?.name || "Variant"} ({variant.sku})</option>
                      ))}
                    </select>
                    <Input type="number" min="1" value={line.quantityRequested} onChange={(e) => setLines((cur) => cur.map((item, i) => i === index ? { ...item, quantityRequested: e.target.value } : item))} />
                    <Input type="number" min="0" step="0.01" placeholder={tScm("k_285f5e059f56")} value={line.targetUnitCost} onChange={(e) => setLines((cur) => cur.map((item, i) => i === index ? { ...item, targetUnitCost: e.target.value } : item))} />
                    <Input placeholder={tScm("k_55f8ebc805e6")} value={line.description} onChange={(e) => setLines((cur) => cur.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} />
                    <Button variant="outline" size="icon" disabled={lines.length === 1} onClick={() => setLines((cur) => cur.length === 1 ? cur : cur.filter((_, i) => i !== index))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_61b294646988")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className={warehouseId ? "text-foreground" : "text-muted-foreground"}>{tScm("k_ee2b430356bc")}</div>
              <div className={submissionDeadline ? "text-foreground" : "text-muted-foreground"}>{tScm("k_56ce983e7c90")}</div>
              <div className={selectedCategoryIds.length > 0 ? "text-foreground" : "text-destructive"}>{tScm("k_eae33741e201")}</div>
              <div className={purchaseRequisitionId && useRequisitionItems || validLines.length > 0 ? "text-foreground" : "text-muted-foreground"}>{tScm("k_b68e2bab58f6")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_4e141c6d3967")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_981e9af099cd")}</div>
                <div className="mt-1 font-medium">{selectedRequisition?.requisitionNumber || "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_6ccb60071be8")}</div>
                <div className="mt-1 font-medium">{selectedCategoryIds.length}</div>
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
