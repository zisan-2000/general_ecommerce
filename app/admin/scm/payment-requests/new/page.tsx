"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";

type Warehouse = { id: number; name: string; code: string };
type Supplier = { id: number; name: string; code: string; currency?: string | null };
type PurchaseOrder = { id: number; poNumber: string; supplierId: number; warehouseId: number };
type GoodsReceipt = { id: number; receiptNumber: string; purchaseOrderId: number; warehouseId: number; supplierId: number };
type SupplierInvoice = { id: number; invoiceNumber: string; total: number | string; status: string; supplierId: number; purchaseOrderId: number | null };
type ComparativeStatement = { id: number; csNumber: string; warehouseId: number };

type PaymentRequestBootstrap = {
  capabilities: {
    canManage: boolean;
    canApproveAdmin: boolean;
    canApproveFinance: boolean;
    canTreasury: boolean;
  };
  warehouses: Warehouse[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceipt[];
  supplierInvoices: SupplierInvoice[];
  comparativeStatements: ComparativeStatement[];
};

async function readJson<T>(res: Response, errorMessage: string) {
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error || errorMessage);
  }
  return (await res.json()) as T;
}

export default function NewPaymentRequestPage() {
  const tScm = useTranslations("ScmAuto");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bootstrap, setBootstrap] = useState<PaymentRequestBootstrap | null>(null);
  const [form, setForm] = useState({
    supplierId: "",
    warehouseId: "",
    purchaseOrderId: "",
    goodsReceiptId: "",
    supplierInvoiceId: "",
    comparativeStatementId: "",
    amount: "",
    currency: "BDT",
    referenceNumber: "",
    note: "",
  });

  const loadBootstrap = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/scm/payment-requests?bootstrap=true", { cache: "no-store" });
      const data = await readJson<PaymentRequestBootstrap>(response, "Failed to load payment request references");
      setBootstrap(data);
      if (!data.capabilities.canManage) {
        toast.error(tScm("k_258d571bb78a"));
        router.replace("/admin/scm/payment-requests");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load payment request references");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBootstrap();
  }, []);

  const supplierOptions = bootstrap?.suppliers ?? [];
  const selectedSupplierId = Number(form.supplierId);
  const selectedWarehouseId = Number(form.warehouseId);

  const filteredPurchaseOrders = useMemo(() => {
    return (bootstrap?.purchaseOrders ?? []).filter((row) => {
      if (selectedSupplierId && row.supplierId !== selectedSupplierId) return false;
      if (selectedWarehouseId && row.warehouseId !== selectedWarehouseId) return false;
      return true;
    });
  }, [bootstrap, selectedSupplierId, selectedWarehouseId]);

  const filteredGoodsReceipts = useMemo(() => {
    return (bootstrap?.goodsReceipts ?? []).filter((row) => {
      if (selectedSupplierId && row.supplierId !== selectedSupplierId) return false;
      if (selectedWarehouseId && row.warehouseId !== selectedWarehouseId) return false;
      if (form.purchaseOrderId && row.purchaseOrderId !== Number(form.purchaseOrderId)) return false;
      return true;
    });
  }, [bootstrap, selectedSupplierId, selectedWarehouseId, form.purchaseOrderId]);

  const filteredInvoices = useMemo(() => {
    return (bootstrap?.supplierInvoices ?? []).filter((row) => {
      if (selectedSupplierId && row.supplierId !== selectedSupplierId) return false;
      if (form.purchaseOrderId && row.purchaseOrderId !== Number(form.purchaseOrderId)) return false;
      return true;
    });
  }, [bootstrap, selectedSupplierId, form.purchaseOrderId]);

  const filteredComparativeStatements = useMemo(() => {
    return (bootstrap?.comparativeStatements ?? []).filter((row) => {
      if (selectedWarehouseId && row.warehouseId !== selectedWarehouseId) return false;
      return true;
    });
  }, [bootstrap, selectedWarehouseId]);

  const selectedSupplier = supplierOptions.find((row) => row.id === selectedSupplierId) ?? null;
  const selectedPo = filteredPurchaseOrders.find((row) => row.id === Number(form.purchaseOrderId)) ?? null;
  const selectedInvoice = filteredInvoices.find((row) => row.id === Number(form.supplierInvoiceId)) ?? null;

  useEffect(() => {
    if (selectedSupplier?.currency) {
      setForm((current) => ({ ...current, currency: selectedSupplier.currency || current.currency || "BDT" }));
    }
  }, [selectedSupplier?.currency]);

  const createRequest = async () => {
    if (!form.supplierId) {
      toast.error(tScm("k_f2737bb12b29"));
      return;
    }
    try {
      setSaving(true);
      const response = await fetch("/api/scm/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: Number(form.supplierId),
          warehouseId: form.warehouseId ? Number(form.warehouseId) : null,
          purchaseOrderId: form.purchaseOrderId ? Number(form.purchaseOrderId) : null,
          goodsReceiptId: form.goodsReceiptId ? Number(form.goodsReceiptId) : null,
          supplierInvoiceId: form.supplierInvoiceId ? Number(form.supplierInvoiceId) : null,
          comparativeStatementId: form.comparativeStatementId ? Number(form.comparativeStatementId) : null,
          amount: form.amount || null,
          currency: form.currency,
          referenceNumber: form.referenceNumber,
          note: form.note,
        }),
      });
      const created = await readJson<{ id: number }>(response, "Failed to create payment request");
      toast.success(tScm("k_f427e474c3ac"));
      router.push(`/admin/scm/payment-requests/${created.id}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to create payment request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/scm/payment-requests">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tScm("k_1763e9ae8697")}
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{tScm("k_72717183f3cb")}</h1>
            <p className="text-sm text-muted-foreground">
              {tScm("k_729ea63fe558")}
            </p>
          </div>
        </div>
        <Button onClick={() => void createRequest()} disabled={saving || loading || !bootstrap?.capabilities.canManage}>
          {saving ? "Saving..." : "Create PRF Draft"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ScmStatCard label={tScm("k_55edd462872a")} value={selectedSupplier?.name || "Not selected"} hint={selectedSupplier?.code || "Choose legal supplier"} />
        <ScmStatCard label={tScm("k_3c45b957fdc8")} value={selectedPo?.poNumber || "Optional"} hint={tScm("k_5614a7668ee1")} />
        <ScmStatCard label={tScm("k_f9f38818c406")} value={selectedInvoice?.invoiceNumber || "Optional"} hint={selectedInvoice ? `${Number(selectedInvoice.total).toFixed(2)}` : "Attach if AP already posted"} />
        <ScmStatCard label={tScm("k_43dc8532f7e5")} value={form.amount || "0.00"} hint={form.currency || "BDT"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_97fae3277194")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-1">
                <Label>{tScm("k_55edd462872a")}</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={form.supplierId} onChange={(e) => setForm((cur) => ({ ...cur, supplierId: e.target.value, purchaseOrderId: "", goodsReceiptId: "", supplierInvoiceId: "" }))}>
                  <option value="">{tScm("k_cfce52686188")}</option>
                  {supplierOptions.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>{tScm("k_298dff72dae2")}</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={form.warehouseId} onChange={(e) => setForm((cur) => ({ ...cur, warehouseId: e.target.value, comparativeStatementId: "" }))}>
                  <option value="">{tScm("k_0c6c4102d4df")}</option>
                  {(bootstrap?.warehouses ?? []).map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>{tScm("k_43dc8532f7e5")}</Label>
                <Input placeholder={tScm("k_43dc8532f7e5")} value={form.amount} onChange={(e) => setForm((cur) => ({ ...cur, amount: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_5128165965c0")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>{tScm("k_3c45b957fdc8")}</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={form.purchaseOrderId} onChange={(e) => setForm((cur) => ({ ...cur, purchaseOrderId: e.target.value, goodsReceiptId: "", supplierInvoiceId: "" }))}>
                  <option value="">{tScm("k_0c6c4102d4df")}</option>
                  {filteredPurchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>{po.poNumber}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{tScm("k_c60a3196b88f")}</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={form.goodsReceiptId} onChange={(e) => setForm((cur) => ({ ...cur, goodsReceiptId: e.target.value }))}>
                  <option value="">{tScm("k_0c6c4102d4df")}</option>
                  {filteredGoodsReceipts.map((grn) => (
                    <option key={grn.id} value={grn.id}>{grn.receiptNumber}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{tScm("k_dedacf19eaa9")}</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={form.supplierInvoiceId} onChange={(e) => setForm((cur) => ({ ...cur, supplierInvoiceId: e.target.value }))}>
                  <option value="">{tScm("k_0c6c4102d4df")}</option>
                  {filteredInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{tScm("k_bcb30f4eb9b0")}</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={form.comparativeStatementId} onChange={(e) => setForm((cur) => ({ ...cur, comparativeStatementId: e.target.value }))}>
                  <option value="">{tScm("k_0c6c4102d4df")}</option>
                  {filteredComparativeStatements.map((cs) => (
                    <option key={cs.id} value={cs.id}>{cs.csNumber}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_9a8e082f04b0")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>{tScm("k_e070de224434")}</Label>
                <Input value={form.currency} onChange={(e) => setForm((cur) => ({ ...cur, currency: e.target.value }))} />
              </div>
              <div>
                <Label>{tScm("k_74195db59dc9")}</Label>
                <Input value={form.referenceNumber} onChange={(e) => setForm((cur) => ({ ...cur, referenceNumber: e.target.value }))} placeholder={tScm("k_de9d31d6f336")} />
              </div>
              <div className="md:col-span-2">
                <Label>{tScm("k_2c924e308820")}</Label>
                <Textarea value={form.note} onChange={(e) => setForm((cur) => ({ ...cur, note: e.target.value }))} placeholder={tScm("k_9f0bcd1c2d09")} rows={4} />
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
              <div className={form.supplierId ? "text-foreground" : "text-muted-foreground"}>{tScm("k_177a2e385661")}</div>
              <div className={form.amount ? "text-foreground" : "text-muted-foreground"}>{tScm("k_c466725ffc7a")}</div>
              <div className={form.purchaseOrderId || form.supplierInvoiceId || form.comparativeStatementId ? "text-foreground" : "text-muted-foreground"}>{tScm("k_2c76ddfb50bc")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_4e141c6d3967")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_55edd462872a")}</div>
                <div className="mt-1 font-medium">{selectedSupplier ? `${selectedSupplier.name} (${selectedSupplier.code})` : "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_eea0c00c5051")}</div>
                <div className="mt-1 font-medium">{selectedPo?.poNumber || "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_f9f38818c406")}</div>
                <div className="mt-1 font-medium">{selectedInvoice?.invoiceNumber || "-"}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
