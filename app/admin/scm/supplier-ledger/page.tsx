"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Filter,
  Building2,
  DollarSign,
  FileText,
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Plus,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type SupplierSummary = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  currency: string;
  totalDebit: string;
  totalCredit: string;
  balance: string;
};

type SupplierOption = {
  id: number;
  code: string;
  name: string;
  currency: string;
};

type PurchaseOrderOption = {
  id: number;
  poNumber: string;
  supplier: {
    id: number;
    name: string;
  };
  warehouse?: {
    id: number;
    name: string;
    code: string;
  };
  status: string;
  grandTotal: number | string;
  items: Array<{
    id: number;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number | string;
    productVariant: {
      id: number;
      sku: string;
      product: {
        id: number;
        name: string;
      };
    };
  }>;
};

type InvoiceDraftLine = {
  purchaseOrderItemId: string;
  productVariantId: string;
  sku: string;
  productName: string;
  quantityInvoiced: string;
  unitCost: string;
  description: string;
};

type SupplierLedgerDetail = {
  supplier: SupplierOption & { isActive: boolean };
  summary: {
    totalDebit: string;
    totalCredit: string;
    balance: string;
  };
  entries: Array<{
    id: number;
    entryDate: string;
    entryType: string;
    direction: "DEBIT" | "CREDIT";
    amount: number | string;
    currency: string;
    note: string | null;
    referenceNumber: string | null;
    supplierInvoice?: { invoiceNumber: string; status: string } | null;
    supplierPayment?: { paymentNumber: string; method: string } | null;
    purchaseOrder?: { poNumber: string } | null;
  }>;
  invoices: Array<{
    id: number;
    invoiceNumber: string;
    status: string;
    matchStatus?: string;
    issueDate: string;
    dueDate: string | null;
    total: number | string;
    paymentHoldStatus?: "CLEAR" | "HELD" | "OVERRIDDEN";
    paymentHoldReason?: string | null;
    paymentHoldOverrideNote?: string | null;
    slaRecommendedCredit?: number | string;
    slaCreditStatus?: "NONE" | "RECOMMENDED" | "APPLIED" | "WAIVED";
    slaCreditReason?: string | null;
    purchaseOrder?: { poNumber: string } | null;
    threeWayMatch?: {
      status: string;
      summary: {
        varianceCount: number;
      };
    };
    payments: Array<{ id: number; paymentNumber: string; amount: number | string; paymentDate: string }>;
  }>;
  payments: Array<{
    id: number;
    paymentNumber: string;
    paymentDate: string;
    amount: number | string;
    method: string;
    reference: string | null;
    supplierInvoice?: { invoiceNumber: string; status: string } | null;
  }>;
};

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || fallbackMessage);
  }
  return data as T;
}

async function getJson<T>(url: string, fallbackMessage: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  return readJson<T>(response, fallbackMessage);
}

function formatMoney(value: number | string) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toFixed(2);
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(locale);
}

function humanizeEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getBalanceColor(balance: string | number) {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance;
  if (num > 0) return "text-destructive";
  if (num < 0) return "text-success";
  return "text-foreground";
}

function getPaymentHoldBadge(status: string | undefined) {
  if (!status || status === "CLEAR") {
    return { status: "CLEAR", className: "border-success/20 text-success" };
  }
  if (status === "HELD") {
    return { status: "HELD", className: "bg-destructive/10 text-destructive" };
  }
  return { status: "OVERRIDDEN", className: "bg-warning/10 text-warning" };
}

// Pagination Component
function Pagination({ currentPage, totalPages, onPageChange }: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("AdminSupplierLedger");

  const getVisiblePages = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + maxVisible - 1);
      
      if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-8 w-8 p-0"
        aria-label={t("pagination.previous")}
        title={t("pagination.previous")}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {getVisiblePages().map((page) => (
        <Button
          key={page}
          variant={currentPage === page ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChange(page)}
          className="h-8 w-8 p-0"
          aria-label={t("pagination.page", { page })}
          aria-current={currentPage === page ? "page" : undefined}
        >
          {page}
        </Button>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-8 w-8 p-0"
        aria-label={t("pagination.next")}
        title={t("pagination.next")}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Ledger Detail Modal Component
function LedgerDetailModal({ 
  open, 
  onOpenChange, 
  detail,
  canManageInvoices,
  canManagePayments,
  canOverridePaymentHold,
  supplierPurchaseOrders,
  onInvoiceAction,
  invoiceActionId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: SupplierLedgerDetail | null;
  canManageInvoices: boolean;
  canManagePayments: boolean;
  canOverridePaymentHold: boolean;
  supplierPurchaseOrders: PurchaseOrderOption[];
  onInvoiceAction: (invoiceId: number, action: "reevaluate" | "override_hold" | "clear_override" | "apply_credit" | "waive_credit", note?: string) => Promise<void>;
  invoiceActionId: number | null;
}) {
  const locale = useLocale();
  const t = useTranslations("AdminSupplierLedger");
  const [activeTab, setActiveTab] = useState<"entries" | "invoices" | "payments">("entries");
  
  if (!detail) return null;

  const balanceColor = getBalanceColor(detail.summary.balance);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl flex items-center gap-2 flex-wrap">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            {detail.supplier.name} ({detail.supplier.code})
            <Badge variant="outline" className={detail.supplier.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
              {detail.supplier.isActive
                ? t("supplierStatuses.ACTIVE")
                : t("supplierStatuses.INACTIVE")}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {t("detail.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary Cards */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <Card className="border-border shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <p className="text-xs text-muted-foreground">{t("summary.totalDebit")}</p>
                <p className="text-lg sm:text-xl font-semibold text-destructive">
                  {formatMoney(detail.summary.totalDebit)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <p className="text-xs text-muted-foreground">{t("summary.totalCredit")}</p>
                <p className="text-lg sm:text-xl font-semibold text-success">
                  {formatMoney(detail.summary.totalCredit)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <p className="text-xs text-muted-foreground">{t("summary.outstandingBalance")}</p>
                <p className={cn("text-lg sm:text-xl font-semibold", balanceColor)}>
                  {formatMoney(detail.summary.balance)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 border-b border-border">
            <Button
              variant={activeTab === "entries" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("entries")}
            >
              <FileText className="h-4 w-4 mr-2" />
              {t("tabs.entries")}
            </Button>
            <Button
              variant={activeTab === "invoices" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("invoices")}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              {t("tabs.invoices", { count: detail.invoices.length })}
            </Button>
            <Button
              variant={activeTab === "payments" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("payments")}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {t("tabs.payments", { count: detail.payments.length })}
            </Button>
          </div>

          {/* Ledger Entries Tab */}
          {activeTab === "entries" && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs font-medium text-muted-foreground">{t("columns.date")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{t("columns.reference")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{t("columns.type")}</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">{t("columns.debit")}</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">{t("columns.credit")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{t("columns.note")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.entries.map((entry) => (
                    <TableRow key={entry.id} className="border-border">
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {formatDate(entry.entryDate, locale)}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-foreground">
                        {entry.referenceNumber || "-"}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-foreground">
                        {t.has(`entryTypes.${entry.entryType}`)
                          ? t(`entryTypes.${entry.entryType}`)
                          : humanizeEnum(entry.entryType)}
                      </TableCell>
                      <TableCell className="text-right py-3 text-sm text-destructive">
                        {entry.direction === "DEBIT" ? formatMoney(entry.amount) : "-"}
                      </TableCell>
                      <TableCell className="text-right py-3 text-sm text-success">
                        {entry.direction === "CREDIT" ? formatMoney(entry.amount) : "-"}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground max-w-xs truncate">
                        {entry.note || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === "invoices" && (
            <div className="space-y-3">
              {detail.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("empty.invoices")}</p>
              ) : (
                detail.invoices.map((invoice) => {
                  const holdBadge = getPaymentHoldBadge(invoice.paymentHoldStatus);
                  return (
                    <Card key={invoice.id} className="border-border shadow-sm">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p>
                              <Badge variant="outline" className="text-xs">
                                {t.has(`invoiceStatuses.${invoice.status}`)
                                  ? t(`invoiceStatuses.${invoice.status}`)
                                  : humanizeEnum(invoice.status)}
                              </Badge>
                              <Badge variant="outline" className={cn("text-xs", holdBadge.className)}>
                                {t(`paymentHoldStatuses.${holdBadge.status}`)}
                              </Badge>
                              {invoice.slaCreditStatus && invoice.slaCreditStatus !== "NONE" && (
                                <Badge variant="outline" className="text-xs bg-info/10 text-info">
                                  {t("detail.creditStatus", {
                                    status: t(`creditStatuses.${invoice.slaCreditStatus}`),
                                  })}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {t("detail.issueDate")}: {formatDate(invoice.issueDate, locale)} |{" "}
                              {t("detail.dueDate")}: {formatDate(invoice.dueDate, locale)}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-foreground">
                              {formatMoney(invoice.total)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("detail.match")}: {t.has(`matchStatuses.${invoice.threeWayMatch?.status || invoice.matchStatus || "PENDING"}`)
                                ? t(`matchStatuses.${invoice.threeWayMatch?.status || invoice.matchStatus || "PENDING"}`)
                                : humanizeEnum(invoice.threeWayMatch?.status || invoice.matchStatus || "PENDING")}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-2 text-xs sm:grid-cols-2">
                          <div>
                            <span className="text-muted-foreground">{t("detail.purchaseOrder")}:</span>{" "}
                            <span className="text-foreground">{invoice.purchaseOrder?.poNumber || t("detail.directInvoice")}</span>
                          </div>
                          {invoice.threeWayMatch?.summary?.varianceCount !== undefined && (
                            <div>
                              <span className="text-muted-foreground">{t("detail.variances")}:</span>{" "}
                              <span className={invoice.threeWayMatch.summary.varianceCount > 0 ? "text-warning" : "text-success"}>
                                {invoice.threeWayMatch.summary.varianceCount}
                              </span>
                            </div>
                          )}
                        </div>

                        {invoice.paymentHoldReason && (
                          <div className="rounded-md bg-warning/10 p-2 text-xs text-warning">
                            {t("detail.holdReason")}: {invoice.paymentHoldReason}
                          </div>
                        )}

                        {invoice.slaCreditStatus === "RECOMMENDED" && invoice.slaRecommendedCredit && (
                          <div className="rounded-md bg-info/10 p-2 text-xs text-info">
                            {t("detail.suggestedCredit")}: {formatMoney(invoice.slaRecommendedCredit)}
                            {invoice.slaCreditReason && ` • ${invoice.slaCreditReason}`}
                          </div>
                        )}

                        {/* Actions */}
                        {canManageInvoices && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={invoiceActionId === invoice.id}
                              onClick={() => onInvoiceAction(invoice.id, "reevaluate")}
                            >
                              {t("actions.reevaluate")}
                            </Button>
                            {canOverridePaymentHold && invoice.paymentHoldStatus === "HELD" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={invoiceActionId === invoice.id}
                                onClick={() => onInvoiceAction(invoice.id, "override_hold", t("actionNotes.emergencyRelease"))}
                              >
                                {t("actions.overrideHold")}
                              </Button>
                            )}
                            {canOverridePaymentHold && invoice.paymentHoldStatus === "OVERRIDDEN" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={invoiceActionId === invoice.id}
                                onClick={() => onInvoiceAction(invoice.id, "clear_override")}
                              >
                                {t("actions.clearOverride")}
                              </Button>
                            )}
                            {invoice.slaCreditStatus === "RECOMMENDED" && (
                              <>
                                <Button
                                  size="sm"
                                  disabled={invoiceActionId === invoice.id}
                                  onClick={() => onInvoiceAction(invoice.id, "apply_credit")}
                                >
                                  {t("actions.applyCredit")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={invoiceActionId === invoice.id}
                                  onClick={() => onInvoiceAction(invoice.id, "waive_credit", t("actionNotes.waivedByManager"))}
                                >
                                  {t("actions.waiveCredit")}
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === "payments" && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs font-medium text-muted-foreground">{t("columns.paymentNumber")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{t("columns.date")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{t("columns.method")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{t("columns.invoice")}</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">{t("columns.amount")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{t("columns.reference")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                        {t("empty.payments")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    detail.payments.map((payment) => (
                      <TableRow key={payment.id} className="border-border">
                        <TableCell className="py-3 text-sm font-medium text-foreground">
                          {payment.paymentNumber}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground">
                          {formatDate(payment.paymentDate, locale)}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-foreground">
                          {t.has(`paymentMethods.${payment.method}`)
                            ? t(`paymentMethods.${payment.method}`)
                            : humanizeEnum(payment.method)}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-foreground">
                          {payment.supplierInvoice?.invoiceNumber || "-"}
                        </TableCell>
                        <TableCell className="text-right py-3 text-sm font-semibold text-success">
                          {formatMoney(payment.amount)}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground">
                          {payment.reference || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("actions.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SupplierLedgerPage() {
  const t = useTranslations("AdminSupplierLedger");
  const { data: session } = useSession();
  const globalPermissions = Array.isArray((session?.user as any)?.globalPermissions)
    ? ((session?.user as any).globalPermissions as string[])
    : [];

  const canManageInvoices = globalPermissions.includes("supplier_invoices.manage");
  const canManagePayments = globalPermissions.includes("supplier_payments.manage");
  const canOverridePaymentHold = globalPermissions.includes("supplier_payments.override_hold");
  const canReadPurchaseOrders = globalPermissions.some((permission) =>
    [
      "purchase_orders.read",
      "purchase_orders.manage",
      "purchase_orders.approve",
      "goods_receipts.manage",
    ].includes(permission),
  );

  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [detail, setDetail] = useState<SupplierLedgerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [invoiceActionId, setInvoiceActionId] = useState<number | null>(null);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);

  const [invoicePurchaseOrderId, setInvoicePurchaseOrderId] = useState("");
  const [invoiceIssueDate, setInvoiceIssueDate] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceSubtotal, setInvoiceSubtotal] = useState("");
  const [invoiceTaxTotal, setInvoiceTaxTotal] = useState("0");
  const [invoiceOtherCharges, setInvoiceOtherCharges] = useState("0");
  const [invoiceNote, setInvoiceNote] = useState("");
  const [invoiceItems, setInvoiceItems] = useState<InvoiceDraftLine[]>([]);

  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentHoldOverride, setPaymentHoldOverride] = useState(false);
  const [paymentHoldOverrideNote, setPaymentHoldOverrideNote] = useState("");

  // Pagination for suppliers table
  const [supplierPage, setSupplierPage] = useState(1);
  const suppliersPerPage = 10;

  const paginatedSuppliers = useMemo(() => {
    const start = (supplierPage - 1) * suppliersPerPage;
    const end = start + suppliersPerPage;
    return suppliers.slice(start, end);
  }, [suppliers, supplierPage]);

  const supplierTotalPages = Math.ceil(suppliers.length / suppliersPerPage);

  const loadBaseData = async () => {
    try {
      setLoading(true);
      const summary = await getJson<SupplierSummary[]>(
        "/api/scm/supplier-ledger",
        t("errors.loadLedger"),
      );
      const normalizedSummary = Array.isArray(summary) ? summary : [];
      setSuppliers(normalizedSummary);

      let supplierData: SupplierOption[] = [];
      try {
        supplierData = await getJson<SupplierOption[]>(
          "/api/scm/suppliers",
          t("errors.loadSuppliers"),
        );
      } catch (error: any) {
        const message = String(error?.message || "").toLowerCase();
        if (!message.includes("forbidden")) {
          throw error;
        }
      }

      if (Array.isArray(supplierData) && supplierData.length > 0) {
        setSupplierOptions(supplierData);
      } else {
        setSupplierOptions(
          normalizedSummary.map((supplier) => ({
            id: supplier.id,
            code: supplier.code,
            name: supplier.name,
            currency: supplier.currency,
          })),
        );
      }

      if (canReadPurchaseOrders) {
        try {
          const purchaseOrderData = await getJson<PurchaseOrderOption[]>(
            "/api/scm/purchase-orders",
            t("errors.loadPurchaseOrders"),
          );
          setPurchaseOrders(Array.isArray(purchaseOrderData) ? purchaseOrderData : []);
        } catch (error: any) {
          const message = String(error?.message || "").toLowerCase();
          if (!message.includes("forbidden")) {
            throw error;
          }
          setPurchaseOrders([]);
        }
      } else {
        setPurchaseOrders([]);
      }
    } catch (error: any) {
      toast.error(error?.message || t("errors.loadLedger"));
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (supplierId: string) => {
    if (!supplierId) {
      setDetail(null);
      return;
    }
    try {
      const data = await getJson<SupplierLedgerDetail>(
        `/api/scm/supplier-ledger?supplierId=${supplierId}`,
        t("errors.loadDetails"),
      );
      setDetail(data);
    } catch (error: any) {
      toast.error(error?.message || t("errors.loadDetails"));
      setDetail(null);
    }
  };

  useEffect(() => {
    void loadBaseData();
  }, [canReadPurchaseOrders]);

  const openLedgerModal = async (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    await loadDetail(supplierId);
    setLedgerModalOpen(true);
  };

  const supplierPurchaseOrders = useMemo(() => {
    const supplierId = Number(selectedSupplierId);
    if (!Number.isInteger(supplierId) || supplierId <= 0) return [];
    return purchaseOrders.filter((purchaseOrder) => purchaseOrder.supplier.id === supplierId);
  }, [purchaseOrders, selectedSupplierId]);

  const selectedPurchaseOrder = useMemo(() => {
    const purchaseOrderId = Number(invoicePurchaseOrderId);
    if (!Number.isInteger(purchaseOrderId) || purchaseOrderId <= 0) return null;
    return supplierPurchaseOrders.find((purchaseOrder) => purchaseOrder.id === purchaseOrderId) || null;
  }, [invoicePurchaseOrderId, supplierPurchaseOrders]);

  useEffect(() => {
    if (!selectedPurchaseOrder) {
      setInvoiceItems([]);
      return;
    }

    const lines = selectedPurchaseOrder.items
      .filter((item) => item.quantityReceived > 0)
      .map((item) => ({
        purchaseOrderItemId: String(item.id),
        productVariantId: String(item.productVariant.id),
        sku: item.productVariant.sku,
        productName: item.productVariant.product.name,
        quantityInvoiced: String(item.quantityReceived),
        unitCost: String(Number(item.unitCost || 0)),
        description: `${item.productVariant.product.name} (${item.productVariant.sku})`,
      }));
    setInvoiceItems(lines);
  }, [selectedPurchaseOrder]);

  useEffect(() => {
    if (invoiceItems.length === 0) {
      if (!selectedPurchaseOrder) {
        setInvoiceSubtotal("");
      }
      return;
    }

    const subtotal = invoiceItems.reduce((sum, item) => {
      const quantity = Number(item.quantityInvoiced);
      const unitCost = Number(item.unitCost);
      if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) return sum;
      return sum + quantity * unitCost;
    }, 0);
    setInvoiceSubtotal(subtotal.toFixed(2));
  }, [invoiceItems, selectedPurchaseOrder]);

  const createInvoice = async () => {
    if (!selectedSupplierId) {
      toast.error(t("errors.selectSupplier"));
      return;
    }
    try {
      setSavingInvoice(true);
      const response = await fetch("/api/scm/supplier-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: Number(selectedSupplierId),
          purchaseOrderId: invoicePurchaseOrderId ? Number(invoicePurchaseOrderId) : null,
          issueDate: invoiceIssueDate || null,
          dueDate: invoiceDueDate || null,
          subtotal: invoiceSubtotal || 0,
          taxTotal: invoiceTaxTotal || 0,
          otherCharges: invoiceOtherCharges || 0,
          note: invoiceNote,
          items: invoiceItems
            .filter((item) => Number(item.quantityInvoiced) > 0)
            .map((item) => ({
              purchaseOrderItemId: item.purchaseOrderItemId ? Number(item.purchaseOrderItemId) : null,
              productVariantId: item.productVariantId ? Number(item.productVariantId) : null,
              quantityInvoiced: Number(item.quantityInvoiced),
              unitCost: Number(item.unitCost),
              description: item.description,
            })),
        }),
      });
      await readJson(response, t("errors.createInvoice"));
      toast.success(t("success.invoiceCreated"));
      setInvoicePurchaseOrderId("");
      setInvoiceIssueDate("");
      setInvoiceDueDate("");
      setInvoiceSubtotal("");
      setInvoiceTaxTotal("0");
      setInvoiceOtherCharges("0");
      setInvoiceNote("");
      setInvoiceItems([]);
      await Promise.all([loadBaseData(), loadDetail(selectedSupplierId)]);
    } catch (error: any) {
      toast.error(error?.message || t("errors.createInvoice"));
    } finally {
      setSavingInvoice(false);
    }
  };

  const createPayment = async () => {
    if (!selectedSupplierId) {
      toast.error(t("errors.selectSupplier"));
      return;
    }
    try {
      setSavingPayment(true);
      const response = await fetch("/api/scm/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: Number(selectedSupplierId),
          supplierInvoiceId: paymentInvoiceId ? Number(paymentInvoiceId) : null,
          paymentDate: paymentDate || null,
          amount: paymentAmount,
          method: paymentMethod,
          reference: paymentReference,
          note: paymentNote,
          holdOverride: paymentHoldOverride,
          holdOverrideNote: paymentHoldOverrideNote,
        }),
      });
      await readJson(response, t("errors.createPayment"));
      toast.success(t("success.paymentCreated"));
      setPaymentInvoiceId("");
      setPaymentDate("");
      setPaymentAmount("");
      setPaymentMethod("BANK_TRANSFER");
      setPaymentReference("");
      setPaymentNote("");
      setPaymentHoldOverride(false);
      setPaymentHoldOverrideNote("");
      await Promise.all([loadBaseData(), loadDetail(selectedSupplierId)]);
    } catch (error: any) {
      toast.error(error?.message || t("errors.createPayment"));
    } finally {
      setSavingPayment(false);
    }
  };

  const runInvoiceAction = async (
    invoiceId: number,
    action: "reevaluate" | "override_hold" | "clear_override" | "apply_credit" | "waive_credit",
    note?: string,
  ) => {
    if (!selectedSupplierId) return;
    try {
      setInvoiceActionId(invoiceId);
      const response = await fetch(`/api/scm/supplier-invoices/${invoiceId}/hold`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: note || null,
        }),
      });
      await readJson(response, t("errors.updateApControl"));
      toast.success(t("success.apControlUpdated"));
      await Promise.all([loadBaseData(), loadDetail(selectedSupplierId)]);
    } catch (error: any) {
      toast.error(error?.message || t("errors.updateApControl"));
    } finally {
      setInvoiceActionId(null);
    }
  };

  const updateInvoiceItem = (
    index: number,
    key: keyof InvoiceDraftLine,
    value: string,
  ) => {
    setInvoiceItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  };

  return (
    <div className="min-h-screen space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            {t("header.title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            {t("header.description")}
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadBaseData()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          {t("actions.refresh")}
        </Button>
      </div>

      {/* Supplier Balances Card */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{t("balances.title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground">{t("columns.supplier")}</TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">{t("summary.totalDebit")}</TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">{t("summary.totalCredit")}</TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">{t("columns.balance")}</TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">{t("columns.action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSuppliers.map((supplier) => {
                      const balance = parseFloat(supplier.balance);
                      return (
                        <TableRow key={supplier.id} className="border-border hover:bg-muted/40">
                          <TableCell className="py-3">
                            <div className="font-medium text-sm text-foreground">{supplier.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{supplier.code}</div>
                          </TableCell>
                          <TableCell className="text-right py-3 text-sm text-destructive">
                            {formatMoney(supplier.totalDebit)}
                          </TableCell>
                          <TableCell className="text-right py-3 text-sm text-success">
                            {formatMoney(supplier.totalCredit)}
                          </TableCell>
                          <TableCell className={cn("text-right py-3 text-sm font-semibold", getBalanceColor(supplier.balance))}>
                            {formatMoney(supplier.balance)}
                          </TableCell>
                          <TableCell className="text-right py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openLedgerModal(String(supplier.id))}
                              className="h-8 px-3 text-xs"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              {t("actions.openLedger")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination for suppliers */}
              {supplierTotalPages > 1 && (
                <Pagination
                  currentPage={supplierPage}
                  totalPages={supplierTotalPages}
                  onPageChange={setSupplierPage}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Ledger Detail Modal */}
      <LedgerDetailModal
        open={ledgerModalOpen}
        onOpenChange={setLedgerModalOpen}
        detail={detail}
        canManageInvoices={canManageInvoices}
        canManagePayments={canManagePayments}
        canOverridePaymentHold={canOverridePaymentHold}
        supplierPurchaseOrders={supplierPurchaseOrders}
        onInvoiceAction={runInvoiceAction}
        invoiceActionId={invoiceActionId}
      />
    </div>
  );
}
