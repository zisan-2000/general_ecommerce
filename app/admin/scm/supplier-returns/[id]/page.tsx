"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScmDocumentLifecycle } from "@/components/admin/scm/ScmDocumentLifecycle";
import { ScmNextStepPanel } from "@/components/admin/scm/ScmNextStepPanel";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { ScmStatusChip } from "@/components/admin/scm/ScmStatusChip";

type SupplierReturn = {
  id: number;
  returnNumber: string;
  status: string;
  requestedAt: string;
  requiredBy: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  dispatchedAt: string | null;
  closedAt: string | null;
  ledgerPostedAt: string | null;
  reasonCode: string | null;
  note: string | null;
  supplier: { id: number; name: string; code: string; currency: string };
  warehouse: { id: number; name: string; code: string };
  purchaseOrder: { id: number; poNumber: string; status: string } | null;
  goodsReceipt: {
    id: number;
    receiptNumber: string;
    receivedAt: string;
    purchaseOrder: { id: number; poNumber: string; supplierId: number; warehouseId: number };
  };
  supplierInvoice: { id: number; invoiceNumber: string; status: string; total: string } | null;
  createdBy?: { id: string; name: string | null; email: string } | null;
  approvedBy?: { id: string; name: string | null; email: string } | null;
  dispatchedBy?: { id: string; name: string | null; email: string } | null;
  closedBy?: { id: string; name: string | null; email: string } | null;
  items: Array<{
    id: number;
    goodsReceiptItemId: number | null;
    purchaseOrderItemId: number | null;
    quantityRequested: number;
    quantityDispatched: number;
    unitCost: string;
    lineTotal: string;
    reason: string | null;
    goodsReceiptItem?: { id: number; quantityReceived: number } | null;
    purchaseOrderItem?: { id: number; quantityOrdered: number; quantityReceived: number } | null;
    productVariant: { id: number; sku: string; product: { id: number; name: string } };
  }>;
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || fallback);
  return payload as T;
}

function formatDate(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function formatMoney(value: string | number) {
  return Number(value || 0).toFixed(2);
}

function toStageLabel(value: string) {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default function SupplierReturnDetailPage() {
  const tScm = useTranslations("ScmAuto");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supplierReturnId = Number(params?.id);
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];
  const canManage = permissions.includes("supplier_returns.manage");
  const canApprove = permissions.includes("supplier_returns.approve");

  const [supplierReturn, setSupplierReturn] = useState<SupplierReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadReturn = async () => {
    if (!Number.isInteger(supplierReturnId) || supplierReturnId <= 0) {
      toast.error(tScm("k_05a8bdb849c0"));
      router.replace("/admin/scm/supplier-returns");
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`/api/scm/supplier-returns/${supplierReturnId}`, { cache: "no-store" });
      const data = await readJson<SupplierReturn>(response, "Failed to load supplier return");
      setSupplierReturn(data);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load supplier return");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadReturn(); }, [supplierReturnId]);

  const actionButtons = useMemo(() => {
    if (!supplierReturn) return [] as Array<{ action: string; label: string }>;
    const buttons: Array<{ action: string; label: string }> = [];
    if (canManage && supplierReturn.status === "DRAFT") buttons.push({ action: "submit", label: tScm("k_2dacf6595984") });
    if (canApprove && supplierReturn.status === "SUBMITTED") buttons.push({ action: "approve", label: tScm("k_7b2c7f146aba") });
    if (canManage && ["APPROVED", "PARTIALLY_DISPATCHED"].includes(supplierReturn.status)) buttons.push({ action: "dispatch", label: tScm("k_840e1b364a32") });
    if (canApprove && supplierReturn.status === "DISPATCHED") buttons.push({ action: "close", label: tScm("k_cf4df8f96b17") });
    if ((canManage || canApprove) && ["DRAFT", "SUBMITTED", "APPROVED"].includes(supplierReturn.status)) buttons.push({ action: "cancel", label: tScm("k_77dfd2135f4d") });
    return buttons;
  }, [supplierReturn, canManage, canApprove]);

  const lifecycleStages = useMemo(() => {
    if (!supplierReturn) return [];
    return [
      { key: "po", label: tScm("k_3c45b957fdc8"), value: supplierReturn.purchaseOrder?.poNumber || "Not linked", helperText: supplierReturn.purchaseOrder ? toStageLabel(supplierReturn.purchaseOrder.status) : "No PO linked", href: supplierReturn.purchaseOrder ? `/admin/scm/purchase-orders/${supplierReturn.purchaseOrder.id}` : null, state: supplierReturn.purchaseOrder ? ("linked" as const) : ("pending" as const) },
      { key: "grn", label: tScm("k_c60a3196b88f"), value: supplierReturn.goodsReceipt.receiptNumber, helperText: `Received ${formatDate(supplierReturn.goodsReceipt.receivedAt)}`, href: `/admin/scm/goods-receipts/${supplierReturn.goodsReceipt.id}`, state: "linked" as const },
      { key: "invoice", label: tScm("k_f9f38818c406"), value: supplierReturn.supplierInvoice?.invoiceNumber || "Not linked", helperText: supplierReturn.supplierInvoice ? toStageLabel(supplierReturn.supplierInvoice.status) : "No AP invoice linked", href: null, state: supplierReturn.supplierInvoice ? ("linked" as const) : ("pending" as const) },
      { key: "return", label: tScm("k_8bd7aee1d470"), value: supplierReturn.returnNumber, helperText: toStageLabel(supplierReturn.status), href: `/admin/scm/supplier-returns/${supplierReturn.id}`, state: "current" as const },
      { key: "credit", label: tScm("k_f7cee4330938"), value: supplierReturn.ledgerPostedAt ? formatDate(supplierReturn.ledgerPostedAt) : "Pending", helperText: supplierReturn.ledgerPostedAt ? "Credit posted" : "Awaiting closure", href: null, state: supplierReturn.ledgerPostedAt ? ("linked" as const) : ("pending" as const) },
    ];
  }, [supplierReturn]);

  const runAction = async (action: string) => {
    if (!supplierReturn) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/scm/supplier-returns/${supplierReturn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await readJson(response, `Failed to ${action} supplier return`);
      toast.success(`Supplier return ${toStageLabel(action)} completed`);
      await loadReturn();
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${action} supplier return`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-6 p-6"><p className="text-sm text-muted-foreground">{tScm("k_934d7fa86c35")}</p></div>;
  if (!supplierReturn) return <div className="space-y-6 p-6"><Button asChild variant="outline"><Link href="/admin/scm/supplier-returns"><ArrowLeft className="mr-2 h-4 w-4" />{tScm("k_1763e9ae8697")}</Link></Button><Card><CardContent className="py-10 text-sm text-muted-foreground">{tScm("k_6705bd020155")}</CardContent></Card></div>;

  const totalRequested = supplierReturn.items.reduce((sum, item) => sum + item.quantityRequested, 0);
  const totalDispatched = supplierReturn.items.reduce((sum, item) => sum + item.quantityDispatched, 0);
  const creditValue = supplierReturn.items.reduce((sum, item) => sum + Number(item.unitCost || 0) * item.quantityDispatched, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm"><Link href="/admin/scm/supplier-returns"><ArrowLeft className="mr-2 h-4 w-4" />{tScm("k_b52b36b7269f")}</Link></Button>
            <ScmStatusChip status={supplierReturn.status} />
          </div>
          <div><h1 className="text-2xl font-bold">{supplierReturn.returnNumber}</h1><p className="text-sm text-muted-foreground">{supplierReturn.supplier.name} • {supplierReturn.warehouse.name}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadReturn()} disabled={loading || saving}><RefreshCw className="mr-2 h-4 w-4" />{tScm("k_56e3badc4e6c")}</Button>
          {actionButtons.map((button) => <Button key={button.action} variant={button.action === "cancel" ? "outline" : "default"} onClick={() => void runAction(button.action)} disabled={saving}>{button.label}</Button>)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ScmStatCard label={tScm("k_294f180aa374")} value={String(totalRequested)} hint={`${totalDispatched} dispatched`} />
        <ScmStatCard label={tScm("k_0c3fa53077e2")} value={formatMoney(creditValue)} hint={supplierReturn.supplier.currency} />
        <ScmStatCard label={tScm("k_e0951fc243c4")} value={supplierReturn.requiredBy ? new Date(supplierReturn.requiredBy).toLocaleDateString() : "-"} hint={`Raised ${new Date(supplierReturn.requestedAt).toLocaleDateString()}`} />
        <ScmStatCard label={tScm("k_f219cc0614ae")} value={supplierReturn.reasonCode || "-"} hint={supplierReturn.supplierInvoice?.invoiceNumber || "No linked invoice"} />
      </div>

      <ScmDocumentLifecycle stages={lifecycleStages} />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">{tScm("k_0efc2e6be4c2")}</TabsTrigger>
              <TabsTrigger value="items">{tScm("k_44d25b5d1b6d")}</TabsTrigger>
              <TabsTrigger value="timeline">{tScm("k_018514a3d58a")}</TabsTrigger>
            </TabsList>
            <TabsContent value="overview"><Card><CardHeader><CardTitle>{tScm("k_312458d49321")}</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_c60a3196b88f")}</div><p className="mt-2 text-sm"><Link href={`/admin/scm/goods-receipts/${supplierReturn.goodsReceipt.id}`} className="underline-offset-4 hover:underline">{supplierReturn.goodsReceipt.receiptNumber}</Link></p></div><div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_3c45b957fdc8")}</div><p className="mt-2 text-sm">{supplierReturn.purchaseOrder ? <Link href={`/admin/scm/purchase-orders/${supplierReturn.purchaseOrder.id}`} className="underline-offset-4 hover:underline">{supplierReturn.purchaseOrder.poNumber}</Link> : "-"}</p></div><div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_f9f38818c406")}</div><p className="mt-2 text-sm">{supplierReturn.supplierInvoice?.invoiceNumber || "-"}</p></div><div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_2c924e308820")}</div><p className="mt-2 text-sm whitespace-pre-wrap">{supplierReturn.note || "-"}</p></div></CardContent></Card></TabsContent>
            <TabsContent value="items"><Card><CardHeader><CardTitle>{tScm("k_863f1ddd7229")}</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>{tScm("k_ecdda59aea5e")}</TableHead><TableHead>{tScm("k_c26bf60fed37")}</TableHead><TableHead>{tScm("k_ff07201ae2e7")}</TableHead><TableHead>{tScm("k_0105252023c5")}</TableHead><TableHead>{tScm("k_f219cc0614ae")}</TableHead></TableRow></TableHeader><TableBody>{supplierReturn.items.map((item) => <TableRow key={item.id}><TableCell><div className="font-medium">{item.productVariant.product.name}</div><div className="text-xs text-muted-foreground">{item.productVariant.sku}</div></TableCell><TableCell>{item.quantityRequested}</TableCell><TableCell>{item.quantityDispatched}</TableCell><TableCell>{formatMoney(item.unitCost)}</TableCell><TableCell>{item.reason || "N/A"}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></TabsContent>
            <TabsContent value="timeline"><Card><CardHeader><CardTitle>{tScm("k_a997f30b5e69")}</CardTitle></CardHeader><CardContent className="space-y-3">{[{label:tScm("k_2e00359b9802"),value:formatDate(supplierReturn.submittedAt)},{label:tScm("k_41b81eb8db1b"),value:formatDate(supplierReturn.approvedAt)},{label:tScm("k_ff07201ae2e7"),value:formatDate(supplierReturn.dispatchedAt)},{label:tScm("k_88d86b7721d5"),value:formatDate(supplierReturn.closedAt)},{label:tScm("k_a5f253f53da7"),value:formatDate(supplierReturn.ledgerPostedAt)}].map((step) => <div key={step.label} className="rounded-lg border p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">{step.label}</div><div className="mt-2 text-sm font-medium">{step.value}</div></div>)}</CardContent></Card></TabsContent>
          </Tabs>
        </div>
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>{tScm("k_b37554f695b1")}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_43de2bcd6337")}</div><div className="mt-1">{supplierReturn.createdBy?.name || supplierReturn.createdBy?.email || "-"}</div></div><div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_2b62a43b5586")}</div><div className="mt-1">{supplierReturn.approvedBy?.name || supplierReturn.approvedBy?.email || "-"}</div></div><div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_434385ecbffd")}</div><div className="mt-1">{supplierReturn.dispatchedBy?.name || supplierReturn.dispatchedBy?.email || "-"}</div></div><div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_e79e2a66660a")}</div><div className="mt-1">{supplierReturn.closedBy?.name || supplierReturn.closedBy?.email || "-"}</div></div></CardContent></Card>
          <ScmNextStepPanel
            title={supplierReturn.status}
            subtitle={tScm("k_c46819b9267d")}
            actions={actionButtons.map((button) => ({
              key: button.action,
              label: button.label,
              onClick: () => void runAction(button.action),
              disabled: saving,
              variant: button.action === "cancel" ? "outline" : "default",
            }))}
            emptyMessage={tScm("k_ad90a4161999")}
          />
        </div>
      </div>
    </div>
  );
}
