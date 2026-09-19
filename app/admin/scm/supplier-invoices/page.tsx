"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Ban, CreditCard, ExternalLink, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { ScmStatusChip } from "@/components/admin/scm/ScmStatusChip";

type SupplierOption = {
  id: number;
  code: string;
  name: string;
  currency?: string | null;
};

type PurchaseOrderOption = {
  id: number;
  poNumber: string;
  status: string;
  currency: string;
  grandTotal: number | string;
  supplier: SupplierOption;
  warehouse?: { id: number; name: string; code: string };
  goodsReceipts?: Array<{ id: number; receiptNumber: string; status: string; receivedAt: string }>;
  landedCosts?: Array<{
    id: number;
    component: string;
    amount: number | string;
    currency?: string | null;
    incurredAt: string;
    note?: string | null;
  }>;
  supplierInvoices?: Array<{ id: number; invoiceNumber: string; status: string; total: number | string }>;
  items: Array<{
    id: number;
    description: string | null;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number | string;
    productVariant: {
      id: number;
      sku: string;
      product: { id: number; name: string };
    };
  }>;
};

type SupplierInvoice = {
  id: number;
  invoiceNumber: string;
  status: string;
  matchStatus?: string | null;
  issueDate: string;
  dueDate: string | null;
  subtotal: number | string;
  taxTotal: number | string;
  otherCharges: number | string;
  total: number | string;
  currency: string;
  supplier: SupplierOption;
  purchaseOrder?: { id: number; poNumber: string } | null;
  paymentHoldStatus?: "CLEAR" | "HELD" | "OVERRIDDEN";
  paymentHoldReason?: string | null;
  items: Array<{
    id: number;
    quantityInvoiced: number;
    unitCost: number | string;
    lineTotal: number | string;
  }>;
  payments: Array<{ id: number; paymentNumber: string; amount: number | string; paymentDate: string }>;
  ledgerEntries?: Array<{ amount: number | string }>;
};

type InvoiceDraftLine = {
  purchaseOrderItemId: string;
  productVariantId: string;
  sku: string;
  productName: string;
  quantityInvoiced: string;
  quantityReceived: number;
  quantityOrdered: number;
  landedPerUnit: number;
  effectiveUnitCost: number;
  unitCost: string;
  description: string;
};

type PaymentMode = "FULL" | "PARTIAL";

type PaymentDraft = {
  invoiceId: number | null;
  mode: PaymentMode;
  amount: string;
  paymentDate: string;
  method: string;
  reference: string;
  note: string;
  holdOverride: boolean;
  holdOverrideNote: string;
};

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || fallbackMessage);
  }
  return data as T;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysInputValue(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: number | string, currency = "") {
  const amount = Number(value || 0);
  return `${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}${currency ? ` ${currency}` : ""}`;
}

function fmtDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(locale);
}

function toStageLabel(value?: string | null) {
  if (!value) return "N/A";
  if (value === "CANCELLED") return "Voided";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getInvoiceOutstanding(invoice: SupplierInvoice) {
  const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const credits = (invoice.ledgerEntries ?? []).reduce(
    (sum, entry) => sum + Number(entry.amount || 0),
    0,
  );
  const outstanding = Number(invoice.total || 0) - paid - credits;
  return Math.max(Number.isFinite(outstanding) ? outstanding : 0, 0);
}

function getLandedTotal(purchaseOrder: PurchaseOrderOption | null) {
  return (purchaseOrder?.landedCosts ?? []).reduce(
    (sum, cost) => sum + Number(cost.amount || 0),
    0,
  );
}

function computeLandedAllocation(purchaseOrder: PurchaseOrderOption) {
  const landedTotal = getLandedTotal(purchaseOrder);
  const baseSubtotal = purchaseOrder.items.reduce(
    (sum, item) => sum + Number(item.unitCost || 0) * item.quantityOrdered,
    0,
  );
  const totalOrderedQuantity = purchaseOrder.items.reduce(
    (sum, item) => sum + item.quantityOrdered,
    0,
  );
  let allocatedSoFar = 0;

  return new Map(
    purchaseOrder.items.map((item, index) => {
      const baseLineTotal = Number(item.unitCost || 0) * item.quantityOrdered;
      const isLast = index === purchaseOrder.items.length - 1;
      const weight =
        baseSubtotal > 0
          ? baseLineTotal
          : totalOrderedQuantity > 0
            ? item.quantityOrdered
            : 1;
      const denominator =
        baseSubtotal > 0
          ? baseSubtotal
          : totalOrderedQuantity > 0
            ? totalOrderedQuantity
            : purchaseOrder.items.length;
      const allocation = isLast
        ? landedTotal - allocatedSoFar
        : Number(((landedTotal * weight) / denominator).toFixed(6));
      if (!isLast) {
        allocatedSoFar += allocation;
      }
      const landedPerUnit =
        item.quantityOrdered > 0 ? Number((allocation / item.quantityOrdered).toFixed(6)) : 0;
      const unitCost = Number(item.unitCost || 0);
      return [
        item.id,
        {
          landedAllocationTotal: allocation,
          landedPerUnit,
          effectiveUnitCost: Number((unitCost + landedPerUnit).toFixed(6)),
        },
      ];
    }),
  );
}

export default function SupplierInvoicesAdminPage() {
  const locale = useLocale();
  const t = useTranslations("AdminSupplierInvoices");
  const searchParams = useSearchParams();
  const requestedPurchaseOrderId = searchParams.get("purchaseOrderId") || "";
  const requestedGoodsReceiptId = searchParams.get("goodsReceiptId") || "";
  const { data: session } = useSession();
  const globalPermissions = Array.isArray((session?.user as any)?.globalPermissions)
    ? ((session?.user as any).globalPermissions as string[])
    : [];
  const canManageInvoices = globalPermissions.includes("supplier_invoices.manage");
  const canManagePayments = globalPermissions.includes("supplier_payments.manage");
  const canOverridePaymentHold = globalPermissions.includes("supplier_payments.override_hold");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [voidingInvoiceId, setVoidingInvoiceId] = useState<number | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderOption[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState(requestedPurchaseOrderId);
  const [issueDate, setIssueDate] = useState(todayInputValue());
  const [dueDate, setDueDate] = useState(addDaysInputValue(30));
  const [taxTotal, setTaxTotal] = useState("0");
  const [otherCharges, setOtherCharges] = useState("0");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<InvoiceDraftLine[]>([]);
  const [search, setSearch] = useState("");
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>({
    invoiceId: null,
    mode: "FULL",
    amount: "",
    paymentDate: todayInputValue(),
    method: "BANK_TRANSFER",
    reference: "",
    note: "",
    holdOverride: false,
    holdOverrideNote: "",
  });
  const [voidInvoiceId, setVoidInvoiceId] = useState<number | null>(null);
  const [voidNote, setVoidNote] = useState("");

  const selectedPurchaseOrder = useMemo(() => {
    const id = Number(purchaseOrderId);
    if (!Number.isInteger(id) || id <= 0) return null;
    return purchaseOrders.find((po) => po.id === id) ?? null;
  }, [purchaseOrderId, purchaseOrders]);

  const supplierOptions = useMemo(() => {
    const options = new Map<number, SupplierOption>();
    for (const po of purchaseOrders) options.set(po.supplier.id, po.supplier);
    for (const invoice of invoices) options.set(invoice.supplier.id, invoice.supplier);
    return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [purchaseOrders, invoices]);

  const supplierPurchaseOrders = useMemo(() => {
    const selectedSupplierId = Number(supplierId);
    return purchaseOrders.filter((po) => {
      if (!Number.isInteger(selectedSupplierId) || selectedSupplierId <= 0) return true;
      return po.supplier.id === selectedSupplierId;
    });
  }, [purchaseOrders, supplierId]);

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.quantityInvoiced);
        const cost = Number(line.unitCost);
        if (!Number.isFinite(qty) || !Number.isFinite(cost)) return sum;
        return sum + qty * cost;
      }, 0),
    [lines],
  );
  const total = subtotal + Number(taxTotal || 0) + Number(otherCharges || 0);
  const landedTotal = getLandedTotal(selectedPurchaseOrder);

  const visibleInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (supplierId && invoice.supplier.id !== Number(supplierId)) return false;
      if (!query) return true;
      return (
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        invoice.supplier.name.toLowerCase().includes(query) ||
        (invoice.purchaseOrder?.poNumber || "").toLowerCase().includes(query)
      );
    });
  }, [invoices, search, supplierId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [poResponse, invoiceResponse] = await Promise.all([
        fetch("/api/scm/purchase-orders", { cache: "no-store" }),
        fetch("/api/scm/supplier-invoices", { cache: "no-store" }),
      ]);
      const [poData, invoiceData] = await Promise.all([
        readJson<PurchaseOrderOption[]>(poResponse, t("errors.loadPurchaseOrders")),
        readJson<SupplierInvoice[]>(invoiceResponse, t("errors.loadInvoices")),
      ]);
      setPurchaseOrders(Array.isArray(poData) ? poData : []);
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
    } catch (error: any) {
      toast.error(error?.message || t("errors.loadWorkspace"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!selectedPurchaseOrder) {
      setLines([]);
      setOtherCharges("0");
      return;
    }
    const landedAllocation = computeLandedAllocation(selectedPurchaseOrder);
    const nextLandedTotal = getLandedTotal(selectedPurchaseOrder);
    setSupplierId(String(selectedPurchaseOrder.supplier.id));
    setOtherCharges(nextLandedTotal > 0 ? nextLandedTotal.toFixed(2) : "0");
    setLines(
      selectedPurchaseOrder.items
        .filter((item) => item.quantityReceived > 0)
        .map((item) => {
          const allocation = landedAllocation.get(item.id) ?? {
            landedPerUnit: 0,
            effectiveUnitCost: Number(item.unitCost || 0),
          };
          return {
            purchaseOrderItemId: String(item.id),
            productVariantId: String(item.productVariant.id),
            sku: item.productVariant.sku,
            productName: item.productVariant.product.name,
            quantityInvoiced: String(item.quantityReceived),
            quantityReceived: item.quantityReceived,
            quantityOrdered: item.quantityOrdered,
            landedPerUnit: allocation.landedPerUnit,
            effectiveUnitCost: allocation.effectiveUnitCost,
            unitCost: String(Number(item.unitCost || 0)),
            description: item.description || `${item.productVariant.product.name} (${item.productVariant.sku})`,
          };
        }),
    );
  }, [selectedPurchaseOrder]);

  useEffect(() => {
    if (requestedPurchaseOrderId) setPurchaseOrderId(requestedPurchaseOrderId);
  }, [requestedPurchaseOrderId]);

  const updateLine = (index: number, key: keyof InvoiceDraftLine, value: string) => {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [key]: value } : line,
      ),
    );
  };

  const createInvoice = async () => {
    if (!canManageInvoices) {
      toast.error(t("errors.noCreatePermission"));
      return;
    }
    if (!supplierId || !purchaseOrderId) {
      toast.error(t("errors.selectSupplierAndPo"));
      return;
    }
    const invoiceLines = lines
      .filter((line) => Number(line.quantityInvoiced) > 0)
      .map((line) => ({
        purchaseOrderItemId: Number(line.purchaseOrderItemId),
        productVariantId: Number(line.productVariantId),
        quantityInvoiced: Number(line.quantityInvoiced),
        unitCost: Number(line.unitCost),
        description: line.description,
      }));
    if (invoiceLines.length === 0) {
      toast.error(t("errors.receivedLineRequired"));
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/scm/supplier-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: Number(supplierId),
          purchaseOrderId: Number(purchaseOrderId),
          issueDate,
          dueDate: dueDate || null,
          subtotal: subtotal.toFixed(2),
          taxTotal: taxTotal || 0,
          otherCharges: otherCharges || 0,
          note,
          items: invoiceLines,
        }),
      });
      const created = await readJson<SupplierInvoice>(response, t("errors.createInvoice"));
      toast.success(t("success.invoiceCreated", { invoice: created.invoiceNumber }));
      setNote("");
      setTaxTotal("0");
      setOtherCharges("0");
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || t("errors.createInvoice"));
    } finally {
      setSaving(false);
    }
  };

  const startPayment = (invoice: SupplierInvoice, mode: PaymentMode) => {
    const outstanding = getInvoiceOutstanding(invoice);
    setPaymentDraft({
      invoiceId: invoice.id,
      mode,
      amount: mode === "FULL" ? outstanding.toFixed(2) : "",
      paymentDate: todayInputValue(),
      method: "BANK_TRANSFER",
      reference: "",
      note: "",
      holdOverride: false,
      holdOverrideNote: "",
    });
  };

  const createPayment = async () => {
    const invoice = invoices.find((row) => row.id === paymentDraft.invoiceId) ?? null;
    if (!invoice) {
      toast.error(t("errors.selectInvoiceForPayment"));
      return;
    }
    const outstanding = getInvoiceOutstanding(invoice);
    const amount = Number(paymentDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t("errors.paymentAmountPositive"));
      return;
    }
    if (amount > outstanding) {
      toast.error(t("errors.paymentExceedsOutstanding"));
      return;
    }
    if (invoice.paymentHoldStatus === "HELD" && !paymentDraft.holdOverride) {
      toast.error(invoice.paymentHoldReason || t("errors.paymentHeld"));
      return;
    }

    try {
      setSavingPayment(true);
      const response = await fetch("/api/scm/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: invoice.supplier.id,
          supplierInvoiceId: invoice.id,
          paymentDate: paymentDraft.paymentDate || null,
          amount: paymentDraft.amount,
          currency: invoice.currency,
          method: paymentDraft.method,
          reference: paymentDraft.reference,
          note: paymentDraft.note,
          holdOverride: paymentDraft.holdOverride,
          holdOverrideNote: paymentDraft.holdOverrideNote,
        }),
      });
      await readJson(response, t("errors.createPayment"));
      toast.success(
        paymentDraft.mode === "FULL"
          ? t("success.fullPaymentPosted")
          : t("success.partialPaymentPosted"),
      );
      setPaymentDraft((current) => ({
        ...current,
        invoiceId: null,
        amount: "",
        reference: "",
        note: "",
        holdOverride: false,
        holdOverrideNote: "",
      }));
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || t("errors.createPayment"));
    } finally {
      setSavingPayment(false);
    }
  };

  const voidInvoice = async (invoice: SupplierInvoice) => {
    if (voidNote.trim().length < 3) {
      toast.error(t("errors.voidNoteRequired"));
      return;
    }
    try {
      setVoidingInvoiceId(invoice.id);
      const response = await fetch(`/api/scm/supplier-invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "void",
          note: voidNote,
        }),
      });
      await readJson(response, t("errors.voidInvoice"));
      toast.success(t("success.invoiceVoided"));
      setVoidInvoiceId(null);
      setVoidNote("");
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || t("errors.voidInvoice"));
    } finally {
      setVoidingInvoiceId(null);
    }
  };

  const receivedPurchaseOrderCount = purchaseOrders.filter((po) =>
    po.items.some((item) => item.quantityReceived > 0),
  ).length;
  const selectedInvoiceCount = selectedPurchaseOrder?.supplierInvoices?.length ?? 0;
  const currency = selectedPurchaseOrder?.currency || supplierOptions.find((supplier) => String(supplier.id) === supplierId)?.currency || "BDT";

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <Button asChild variant="outline" size="sm">
            <Link href={requestedGoodsReceiptId ? `/admin/scm/goods-receipts/${requestedGoodsReceiptId}` : "/admin/scm"}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("actions.back")}
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t("header.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("header.description")}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={loading || saving}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("actions.refresh")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ScmStatCard label={t("stats.invoices.label")} value={String(invoices.length)} hint={t("stats.invoices.hint")} icon={FileText} />
        <ScmStatCard label={t("stats.receivedPos.label")} value={String(receivedPurchaseOrderCount)} hint={t("stats.receivedPos.hint")} />
        <ScmStatCard label={t("stats.selectedPoInvoices.label")} value={String(selectedInvoiceCount)} hint={selectedPurchaseOrder?.poNumber || t("stats.selectedPoInvoices.emptyHint")} />
        <ScmStatCard label={t("stats.landedCost.label")} value={formatMoney(landedTotal, currency)} hint={landedTotal > 0 ? t("stats.landedCost.includedHint") : t("stats.landedCost.emptyHint")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("create.title")}</CardTitle>
            <CardDescription>
              {t("create.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("fields.supplier")}</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={supplierId}
                  onChange={(event) => {
                    setSupplierId(event.target.value);
                    setPurchaseOrderId("");
                  }}
                  disabled={!canManageInvoices}
                >
                  <option value="">{t("options.selectSupplier")}</option>
                  {supplierOptions.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("fields.purchaseOrder")}</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={purchaseOrderId}
                  onChange={(event) => setPurchaseOrderId(event.target.value)}
                  disabled={!canManageInvoices}
                >
                  <option value="">{t("options.selectReceivedPo")}</option>
                  {supplierPurchaseOrders
                    .filter((po) => po.items.some((item) => item.quantityReceived > 0))
                    .map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.poNumber} - {po.supplier.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("fields.invoiceDate")}</Label>
                <Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} disabled={!canManageInvoices} />
              </div>
              <div className="space-y-2">
                <Label>{t("fields.dueDate")}</Label>
                <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={!canManageInvoices} />
              </div>
            </div>

            {selectedPurchaseOrder ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-3 text-sm">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("fields.supplier")}</div>
                  <div className="mt-1 font-medium">{selectedPurchaseOrder.supplier.name}</div>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("fields.purchaseOrder")}</div>
                  <div className="mt-1 font-medium">{selectedPurchaseOrder.poNumber}</div>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("fields.receivedQuantity")}</div>
                  <div className="mt-1 font-medium">
                    {selectedPurchaseOrder.items.reduce((sum, item) => sum + item.quantityReceived, 0)}
                  </div>
                </div>
              </div>
            ) : null}

            {selectedPurchaseOrder && (selectedPurchaseOrder.landedCosts?.length || 0) > 0 ? (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{t("landedCost.title")}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("landedCost.description")}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">{formatMoney(landedTotal, currency)}</div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {selectedPurchaseOrder.landedCosts?.map((cost) => (
                    <div key={cost.id} className="rounded-md border bg-muted/20 p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span>{toStageLabel(cost.component)}</span>
                        <span className="font-medium">{formatMoney(cost.amount, cost.currency || currency)}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {fmtDate(cost.incurredAt, locale)}
                        {cost.note ? ` - ${cost.note}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedPurchaseOrder ? (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                {t("landedCost.empty")}
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.item")}</TableHead>
                    <TableHead>{t("columns.received")}</TableHead>
                    <TableHead>{t("columns.invoiceQuantity")}</TableHead>
                    <TableHead>{t("columns.unitCost")}</TableHead>
                    <TableHead>{t("columns.landedPerUnit")}</TableHead>
                    <TableHead>{t("columns.stockUnitCost")}</TableHead>
                    <TableHead className="text-right">{t("columns.lineTotal")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        {t("create.selectPoHint")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line, index) => {
                      const lineTotal = Number(line.quantityInvoiced || 0) * Number(line.unitCost || 0);
                      return (
                        <TableRow key={line.purchaseOrderItemId}>
                          <TableCell className="min-w-64">
                            <div className="font-medium">{line.productName}</div>
                            <div className="text-xs text-muted-foreground">{line.sku}</div>
                          </TableCell>
                          <TableCell>
                            {line.quantityReceived}
                            <div className="text-xs text-muted-foreground">
                              {t("common.orderedValue", { count: line.quantityOrdered })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={line.quantityInvoiced}
                              onChange={(event) => updateLine(index, "quantityInvoiced", event.target.value)}
                              className="w-28"
                              disabled={!canManageInvoices}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={line.unitCost}
                              onChange={(event) => updateLine(index, "unitCost", event.target.value)}
                              className="w-32"
                              disabled={!canManageInvoices}
                            />
                          </TableCell>
                          <TableCell>{formatMoney(line.landedPerUnit)}</TableCell>
                          <TableCell>{formatMoney(line.effectiveUnitCost)}</TableCell>
                          <TableCell className="text-right">{formatMoney(lineTotal)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{t("fields.tax")}</Label>
                <Input type="number" min={0} step="0.01" value={taxTotal} onChange={(event) => setTaxTotal(event.target.value)} disabled={!canManageInvoices} />
              </div>
              <div className="space-y-2">
                <Label>
                  {landedTotal > 0
                    ? t("fields.otherChargesWithLandedCost")
                    : t("fields.otherCharges")}
                </Label>
                <Input type="number" min={0} step="0.01" value={otherCharges} onChange={(event) => setOtherCharges(event.target.value)} disabled={!canManageInvoices} />
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("fields.invoiceTotal")}</div>
                <div className="mt-1 text-lg font-semibold">{formatMoney(total, currency)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("fields.note")}</Label>
              <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("placeholders.invoiceNote")} disabled={!canManageInvoices} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void createInvoice()} disabled={saving || loading || !canManageInvoices || lines.length === 0}>
                {saving ? t("actions.creating") : t("actions.createInvoice")}
              </Button>
              {selectedPurchaseOrder ? (
                <Button asChild variant="outline">
                  <Link href={`/admin/scm/three-way-match?search=${encodeURIComponent(selectedPurchaseOrder.poNumber)}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("actions.threeWayMatch")}
                  </Link>
                </Button>
              ) : null}
              {supplierId ? (
                <Button asChild variant="outline">
                  <Link href={`/admin/scm/supplier-ledger?supplierId=${supplierId}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("actions.supplierLedger")}
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("register.title")}</CardTitle>
            <CardDescription>{t("register.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("placeholders.search")} />
            {loading ? (
              <p className="text-sm text-muted-foreground">{t("register.loading")}</p>
            ) : visibleInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("register.empty")}</p>
            ) : (
              <div className="space-y-3">
                {visibleInvoices.map((invoice) => (
                  <div key={invoice.id} className="space-y-3 rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{invoice.invoiceNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.supplier.name} {invoice.purchaseOrder ? `- ${invoice.purchaseOrder.poNumber}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {invoice.status === "CANCELLED" ? (
                          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                            {t("invoiceStatuses.CANCELLED")}
                          </Badge>
                        ) : (
                          <ScmStatusChip status={invoice.status} />
                        )}
                        <Badge variant="outline">
                          {t.has(`matchStatuses.${invoice.matchStatus || "PENDING"}`)
                            ? t(`matchStatuses.${invoice.matchStatus || "PENDING"}`)
                            : toStageLabel(invoice.matchStatus || "PENDING")}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">{t("register.invoice")}:</span>{" "}
                        {formatMoney(invoice.total, invoice.currency)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("register.outstanding")}:</span>{" "}
                        {formatMoney(getInvoiceOutstanding(invoice), invoice.currency)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("register.lines")}:</span> {invoice.items.length}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("register.date")}:</span> {fmtDate(invoice.issueDate, locale)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("register.due")}:</span> {fmtDate(invoice.dueDate, locale)}
                      </div>
                    </div>
                    {invoice.paymentHoldStatus === "HELD" ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                        {invoice.paymentHoldReason || t("register.paymentHeld")}
                      </div>
                    ) : null}
                    {canManagePayments && invoice.status !== "CANCELLED" && getInvoiceOutstanding(invoice) > 0 ? (
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        <Button size="sm" onClick={() => startPayment(invoice, "FULL")} disabled={savingPayment}>
                          <CreditCard className="mr-2 h-4 w-4" />
                          {t("actions.fullPay")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startPayment(invoice, "PARTIAL")} disabled={savingPayment}>
                          {t("actions.partialPay")}
                        </Button>
                      </div>
                    ) : null}
                    {canManageInvoices && invoice.status !== "CANCELLED" && invoice.payments.length === 0 ? (
                      <div className="border-t pt-3">
                        {voidInvoiceId === invoice.id ? (
                          <div className="space-y-2">
                            <Label>{t("fields.voidNote")}</Label>
                            <Textarea
                              rows={2}
                              value={voidNote}
                              onChange={(event) => setVoidNote(event.target.value)}
                              placeholder={t("placeholders.voidReason")}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => void voidInvoice(invoice)}
                                disabled={voidingInvoiceId === invoice.id}
                              >
                                {voidingInvoiceId === invoice.id
                                  ? t("actions.voiding")
                                  : t("actions.confirmVoid")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setVoidInvoiceId(null);
                                  setVoidNote("");
                                }}
                                disabled={voidingInvoiceId === invoice.id}
                              >
                                {t("actions.cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setVoidInvoiceId(invoice.id)}
                            disabled={voidingInvoiceId === invoice.id}
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            {t("actions.voidInvoice")}
                          </Button>
                        )}
                      </div>
                    ) : null}
                    {paymentDraft.invoiceId === invoice.id ? (
                      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium">
                            {paymentDraft.mode === "FULL"
                              ? t("payment.fullTitle")
                              : t("payment.partialTitle")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("payment.outstanding", {
                              amount: formatMoney(getInvoiceOutstanding(invoice), invoice.currency),
                            })}
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>{t("fields.paymentDate")}</Label>
                            <Input
                              type="date"
                              value={paymentDraft.paymentDate}
                              onChange={(event) =>
                                setPaymentDraft((current) => ({ ...current, paymentDate: event.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("fields.amount")}</Label>
                            <Input
                              type="number"
                              min={0}
                              max={getInvoiceOutstanding(invoice)}
                              step="0.01"
                              value={paymentDraft.amount}
                              onChange={(event) =>
                                setPaymentDraft((current) => ({ ...current, amount: event.target.value }))
                              }
                              disabled={paymentDraft.mode === "FULL"}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("fields.method")}</Label>
                            <select
                              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                              value={paymentDraft.method}
                              onChange={(event) =>
                                setPaymentDraft((current) => ({ ...current, method: event.target.value }))
                              }
                            >
                              <option value="BANK_TRANSFER">{t("paymentMethods.BANK_TRANSFER")}</option>
                              <option value="CASH">{t("paymentMethods.CASH")}</option>
                              <option value="CHEQUE">{t("paymentMethods.CHEQUE")}</option>
                              <option value="MOBILE_BANKING">{t("paymentMethods.MOBILE_BANKING")}</option>
                              <option value="ADJUSTMENT">{t("paymentMethods.ADJUSTMENT")}</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("fields.reference")}</Label>
                            <Input
                              value={paymentDraft.reference}
                              onChange={(event) =>
                                setPaymentDraft((current) => ({ ...current, reference: event.target.value }))
                              }
                              placeholder={t("placeholders.paymentReference")}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("fields.paymentNote")}</Label>
                          <Textarea
                            rows={2}
                            value={paymentDraft.note}
                            onChange={(event) =>
                              setPaymentDraft((current) => ({ ...current, note: event.target.value }))
                            }
                            placeholder={t("placeholders.paymentNote")}
                          />
                        </div>
                        {invoice.paymentHoldStatus === "HELD" && canOverridePaymentHold ? (
                          <div className="space-y-2 rounded-md border p-3">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={paymentDraft.holdOverride}
                                onChange={(event) =>
                                  setPaymentDraft((current) => ({
                                    ...current,
                                    holdOverride: event.target.checked,
                                  }))
                                }
                              />
                              {t("payment.overrideHold")}
                            </label>
                            <Textarea
                              rows={2}
                              value={paymentDraft.holdOverrideNote}
                              onChange={(event) =>
                                setPaymentDraft((current) => ({
                                  ...current,
                                  holdOverrideNote: event.target.value,
                                }))
                              }
                              placeholder={t("placeholders.overrideNote")}
                            />
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => void createPayment()} disabled={savingPayment}>
                            {savingPayment
                              ? t("actions.posting")
                              : t("actions.postPayment")}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setPaymentDraft((current) => ({ ...current, invoiceId: null }))}
                            disabled={savingPayment}
                          >
                            {t("actions.cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
