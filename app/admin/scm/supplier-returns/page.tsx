"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Plus, 
  RefreshCw,
  Building2,
  Package,
  FileText,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Truck,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

type Warehouse = {
  id: number;
  name: string;
  code: string;
};

type GoodsReceipt = {
  id: number;
  receiptNumber: string;
  receivedAt: string;
  warehouseId: number;
  warehouse: Warehouse;
  purchaseOrderId: number;
  purchaseOrder: {
    id: number;
    poNumber: string;
    supplier: {
      id: number;
      name: string;
      code: string;
    };
  };
  items: Array<{
    id: number;
    purchaseOrderItemId: number;
    quantityReceived: number;
    unitCost: string;
    productVariant: {
      id: number;
      sku: string;
      product: {
        name: string;
      };
    };
  }>;
};

type SupplierInvoice = {
  id: number;
  invoiceNumber: string;
  supplierId: number;
  purchaseOrderId: number | null;
  total: string;
  status: string;
};

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
  supplierId: number;
  warehouseId: number;
  purchaseOrderId: number | null;
  supplierInvoiceId: number | null;
  supplier: {
    id: number;
    name: string;
    code: string;
  };
  warehouse: Warehouse;
  purchaseOrder: {
    id: number;
    poNumber: string;
    status: string;
  } | null;
  goodsReceipt: {
    id: number;
    receiptNumber: string;
    receivedAt: string;
  };
  supplierInvoice: {
    id: number;
    invoiceNumber: string;
    status: string;
    total: string;
  } | null;
  items: Array<{
    id: number;
    goodsReceiptItemId: number | null;
    purchaseOrderItemId: number | null;
    quantityRequested: number;
    quantityDispatched: number;
    unitCost: string;
    lineTotal: string;
    reason: string | null;
    productVariant: {
      id: number;
      sku: string;
      product: {
        name: string;
      };
    };
  }>;
};

type DraftItem = {
  goodsReceiptItemId: number;
  productName: string;
  sku: string;
  receivedQty: number;
  availableQty: number;
  unitCost: string;
  quantityRequested: string;
  reason: string;
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || fallback);
  }
  return payload as T;
}

async function readJsonOrEmpty<T>(response: Response, fallback: string, emptyValue: T) {
  if (response.status === 403) {
    return emptyValue;
  }
  return readJson<T>(response, fallback);
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

function getStatusColor(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-muted/50 text-muted-foreground border-border";
    case "SUBMITTED":
      return "bg-warning/10 text-warning border-warning/20";
    case "APPROVED":
      return "bg-info/10 text-info border-info/20";
    case "PARTIALLY_DISPATCHED":
      return "bg-primary/10 text-primary border-primary/20";
    case "DISPATCHED":
      return "bg-success/10 text-success border-success/20";
    case "CLOSED":
      return "bg-muted/30 text-muted-foreground border-border";
    case "CANCELLED":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted/50 text-muted-foreground border-border";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "DRAFT":
      return FileText;
    case "SUBMITTED":
      return Clock;
    case "APPROVED":
      return CheckCircle;
    case "PARTIALLY_DISPATCHED":
      return Truck;
    case "DISPATCHED":
      return Truck;
    case "CLOSED":
      return CheckCircle;
    case "CANCELLED":
      return XCircle;
    default:
      return AlertCircle;
  }
}

// Pagination Component
function Pagination({ currentPage, totalPages, onPageChange }: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
}) {
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
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Create Return Modal Component
function CreateReturnModal({ 
  open, 
  onOpenChange,
  goodsReceipts,
  supplierInvoices,
  selectedReceiptId,
  selectedInvoiceId,
  requiredBy,
  reasonCode,
  note,
  items,
  saving,
  onReceiptChange,
  onInvoiceChange,
  onRequiredByChange,
  onReasonCodeChange,
  onNoteChange,
  onItemUpdate,
  onCreate
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goodsReceipts: GoodsReceipt[];
  supplierInvoices: SupplierInvoice[];
  selectedReceiptId: string;
  selectedInvoiceId: string;
  requiredBy: string;
  reasonCode: string;
  note: string;
  items: DraftItem[];
  saving: boolean;
  onReceiptChange: (value: string) => void;
  onInvoiceChange: (value: string) => void;
  onRequiredByChange: (value: string) => void;
  onReasonCodeChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onItemUpdate: (index: number, key: keyof DraftItem, value: string) => void;
  onCreate: () => void;
}) {
  const tScm = useTranslations("ScmAuto");
  const selectedReceipt = goodsReceipts.find(r => r.id === Number(selectedReceiptId));
  const availableInvoices = supplierInvoices.filter(
    invoice => selectedReceipt && invoice.supplierId === selectedReceipt.purchaseOrder.supplier.id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">{tScm("k_4a6fba014ef1")}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {tScm("k_6efce360faf7")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Form Fields */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-sm">{tScm("k_4ae4f4c6d5a8")}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={selectedReceiptId}
                onChange={(e) => onReceiptChange(e.target.value)}
              >
                <option value="">{tScm("k_2005fcdeaf16")}</option>
                {goodsReceipts.map((receipt) => (
                  <option key={receipt.id} value={receipt.id}>
                    {receipt.receiptNumber} - {receipt.purchaseOrder.supplier.name} - {receipt.warehouse.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{tScm("k_a4c529c8ccfa")}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={selectedInvoiceId}
                onChange={(e) => onInvoiceChange(e.target.value)}
                disabled={!selectedReceiptId}
              >
                <option value="">{tScm("k_90a7073c7a6c")}</option>
                {availableInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoiceNumber} ({invoice.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{tScm("k_e0951fc243c4")}</Label>
              <Input
                type="datetime-local"
                value={requiredBy}
                onChange={(e) => onRequiredByChange(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{tScm("k_e830321953ac")}</Label>
              <Input
                placeholder={tScm("k_19726c21884a")}
                value={reasonCode}
                onChange={(e) => onReasonCodeChange(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">{tScm("k_2c924e308820")}</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder={tScm("k_d84f679be9b9")}
              className="text-sm"
            />
          </div>

          {/* Items Table */}
          {selectedReceipt && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="border-b border-border px-3 py-2 sm:px-4 sm:py-3 text-sm text-muted-foreground bg-muted/30">
                <div className="flex flex-wrap gap-2 justify-between">
                  <span>{tScm("k_1c8a21290f72")} {selectedReceipt.purchaseOrder.supplier.name} ({selectedReceipt.purchaseOrder.supplier.code})</span>
                  <span>{tScm("k_0e83a5786fc9")} {selectedReceipt.purchaseOrder.poNumber}</span>
                  <span>{tScm("k_edce1fb96bf3")} {selectedReceipt.warehouse.name}</span>
                </div>
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_ecdda59aea5e")}</TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">{tScm("k_27548c4fc95d")}</TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">{tScm("k_7c62a1424469")}</TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">{tScm("k_0105252023c5")}</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_76e1a0d562ed")}</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_f219cc0614ae")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={item.goodsReceiptItemId} className="border-border">
                        <TableCell className="py-3">
                          <div className="font-medium text-sm text-foreground">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">{item.sku}</div>
                        </TableCell>
                        <TableCell className="text-right py-3 text-sm text-foreground">{item.receivedQty}</TableCell>
                        <TableCell className="text-right py-3 text-sm text-foreground">{item.availableQty}</TableCell>
                        <TableCell className="text-right py-3 text-sm text-foreground">{formatMoney(item.unitCost)}</TableCell>
                        <TableCell className="py-3">
                          <Input
                            type="number"
                            min={0}
                            max={item.availableQty}
                            value={item.quantityRequested}
                            onChange={(e) => onItemUpdate(index, "quantityRequested", e.target.value)}
                            className="w-24 text-sm"
                          />
                        </TableCell>
                        <TableCell className="py-3">
                          <Input
                            value={item.reason}
                            onChange={(e) => onItemUpdate(index, "reason", e.target.value)}
                            placeholder={tScm("k_bea2927cc79d")}
                            className="text-sm"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View for Items */}
              <div className="space-y-3 p-3 md:hidden">
                {items.map((item, index) => (
                  <div key={item.goodsReceiptItemId} className="rounded-lg border border-border p-3 space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">{item.sku}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">{tScm("k_6475a0a34fe5")}</span>
                        <span className="ml-1 text-foreground">{item.receivedQty}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">{tScm("k_4a8c2fb2e589")}</span>
                        <span className="ml-1 text-foreground">{item.availableQty}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">{tScm("k_09dd42ca7ef4")}</span>
                        <span className="ml-1 text-foreground">{formatMoney(item.unitCost)}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{tScm("k_76e1a0d562ed")}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={item.availableQty}
                        value={item.quantityRequested}
                        onChange={(e) => onItemUpdate(index, "quantityRequested", e.target.value)}
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{tScm("k_f219cc0614ae")}</Label>
                      <Input
                        value={item.reason}
                        onChange={(e) => onItemUpdate(index, "reason", e.target.value)}
                        placeholder={tScm("k_bea2927cc79d")}
                        className="mt-1 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {tScm("k_77dfd2135f4d")}
          </Button>
          <Button onClick={onCreate} disabled={saving || !selectedReceiptId}>
            {saving ? "Creating..." : "Create Supplier Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SupplierReturnsPage() {
  const tScm = useTranslations("ScmAuto");
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];

  const canRead = permissions.some((permission) =>
    ["supplier_returns.read", "supplier_returns.manage", "supplier_returns.approve"].includes(permission),
  );
  const canManage = permissions.includes("supplier_returns.manage");
  const canApprove = permissions.includes("supplier_returns.approve");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedReceiptId, setSelectedReceiptId] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [requiredBy, setRequiredBy] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadData = async () => {
    setLoading(true);
    try {
      const [returnData, receiptData, invoiceData] = await Promise.all([
        fetch("/api/scm/supplier-returns", { cache: "no-store" }).then((response) =>
          readJson<SupplierReturn[]>(response, "Failed to load supplier returns"),
        ),
        fetch("/api/scm/goods-receipts", { cache: "no-store" }).then((response) =>
          readJson<GoodsReceipt[]>(response, "Failed to load goods receipts"),
        ),
        fetch("/api/scm/supplier-invoices", { cache: "no-store" }).then((response) =>
          readJsonOrEmpty<SupplierInvoice[]>(
            response,
            "Failed to load supplier invoices",
            [],
          ),
        ),
      ]);

      setSupplierReturns(Array.isArray(returnData) ? returnData : []);
      setGoodsReceipts(Array.isArray(receiptData) ? receiptData : []);
      setSupplierInvoices(Array.isArray(invoiceData) ? invoiceData : []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load supplier return data");
      setSupplierReturns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) {
      void loadData();
    }
  }, [canRead]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const selectedReceipt = useMemo(
    () =>
      goodsReceipts.find((receipt) => receipt.id === Number(selectedReceiptId)) ?? null,
    [goodsReceipts, selectedReceiptId],
  );

  const selectedReceiptRequestedByItem = useMemo(() => {
    return supplierReturns
      .filter((supplierReturn) => supplierReturn.status !== "CANCELLED")
      .flatMap((supplierReturn) => supplierReturn.items)
      .reduce<Map<number, number>>((acc, item) => {
        if (!item.goodsReceiptItemId) return acc;
        acc.set(
          item.goodsReceiptItemId,
          (acc.get(item.goodsReceiptItemId) ?? 0) + item.quantityRequested,
        );
        return acc;
      }, new Map());
  }, [supplierReturns]);

  useEffect(() => {
    if (!selectedReceipt) {
      setItems([]);
      setSelectedInvoiceId("");
      return;
    }

    const nextItems = selectedReceipt.items.map((item) => {
      const alreadyRequested = selectedReceiptRequestedByItem.get(item.id) ?? 0;
      const availableQty = Math.max(0, item.quantityReceived - alreadyRequested);

      return {
        goodsReceiptItemId: item.id,
        productName: item.productVariant.product.name,
        sku: item.productVariant.sku,
        receivedQty: item.quantityReceived,
        availableQty,
        unitCost: item.unitCost,
        quantityRequested: availableQty > 0 ? String(availableQty) : "",
        reason: "",
      };
    });

    setItems(nextItems);
    setSelectedInvoiceId("");
  }, [selectedReceipt, selectedReceiptRequestedByItem]);

  const visibleReturns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return supplierReturns.filter((supplierReturn) => {
      if (statusFilter && supplierReturn.status !== statusFilter) return false;
      if (!query) return true;
      return (
        supplierReturn.returnNumber.toLowerCase().includes(query) ||
        supplierReturn.supplier.name.toLowerCase().includes(query) ||
        supplierReturn.warehouse.name.toLowerCase().includes(query) ||
        supplierReturn.goodsReceipt.receiptNumber.toLowerCase().includes(query)
      );
    });
  }, [search, statusFilter, supplierReturns]);

  const paginatedReturns = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return visibleReturns.slice(start, end);
  }, [visibleReturns, currentPage]);

  const totalPages = Math.ceil(visibleReturns.length / itemsPerPage);

  const createSupplierReturn = async () => {
    if (!selectedReceipt) {
      toast.error(tScm("k_a658b7fbe0b3"));
      return;
    }

    const payloadItems = items
      .map((item) => ({
        goodsReceiptItemId: item.goodsReceiptItemId,
        quantityRequested: Number(item.quantityRequested),
        reason: item.reason.trim(),
      }))
      .filter((item) => Number.isInteger(item.quantityRequested) && item.quantityRequested > 0);

    if (payloadItems.length === 0) {
      toast.error(tScm("k_64464ca9791b"));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/scm/supplier-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goodsReceiptId: selectedReceipt.id,
          supplierInvoiceId: selectedInvoiceId ? Number(selectedInvoiceId) : null,
          requiredBy: requiredBy || null,
          reasonCode,
          note,
          items: payloadItems,
        }),
      });

      await readJson(response, "Failed to create supplier return");
      toast.success(tScm("k_b5ea7674de34"));
      setSelectedReceiptId("");
      setSelectedInvoiceId("");
      setRequiredBy("");
      setReasonCode("");
      setNote("");
      setItems([]);
      setCreateModalOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create supplier return");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (supplierReturnId: number, action: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/scm/supplier-returns/${supplierReturnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await readJson(response, `Failed to ${action} supplier return`);
      toast.success(`Supplier return ${action}ed`);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${action} supplier return`);
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (index: number, key: keyof DraftItem, value: string) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  };

  const statusOptions = [
    "DRAFT",
    "SUBMITTED",
    "APPROVED",
    "PARTIALLY_DISPATCHED",
    "DISPATCHED",
    "CLOSED",
    "CANCELLED",
  ];

  if (!canRead) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{tScm("k_3dab5f6012e3")}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {tScm("k_18359b021982")}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            {tScm("k_ded7e6ab3a5b")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            {tScm("k_128f236725e3")}
          </p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {tScm("k_b8b22e950f8f")}
            </Button>
          )}
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            {tScm("k_56e3badc4e6c")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Supplier Return Queue */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">{tScm("k_8e03140538e3")}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {tScm("k_5024eee96f94")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
          {/* Desktop Filters */}
          <div className="hidden sm:flex gap-3">
            <Input
              placeholder={tScm("k_4ff037f069a7")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-md text-sm"
            />
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">{tScm("k_6405179d241b")}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Mobile Filters */}
          {showFilters && (
            <div className="space-y-3 sm:hidden">
              <Input
                placeholder={tScm("k_6d7a30a931a3")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="text-sm"
              />
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">{tScm("k_6405179d241b")}</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={() => setShowFilters(false)} className="w-full">
                {tScm("k_6834a4e56490")}
              </Button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* Returns List */}
          {!loading && paginatedReturns.length > 0 && (
            <div className="space-y-4">
              {paginatedReturns.map((supplierReturn) => {
                const totalRequested = supplierReturn.items.reduce(
                  (sum, item) => sum + item.quantityRequested,
                  0,
                );
                const totalDispatched = supplierReturn.items.reduce(
                  (sum, item) => sum + item.quantityDispatched,
                  0,
                );
                const dispatchedValue = supplierReturn.items.reduce(
                  (sum, item) =>
                    sum + Number(item.unitCost || 0) * item.quantityDispatched,
                  0,
                );
                const StatusIcon = getStatusIcon(supplierReturn.status);

                return (
                  <Card key={supplierReturn.id} className="border-border shadow-sm overflow-hidden">
                    <CardHeader className="p-4 sm:p-5 border-b border-border/50">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base sm:text-lg font-semibold">
                              {supplierReturn.returnNumber}
                            </CardTitle>
                            <div className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                              getStatusColor(supplierReturn.status)
                            )}>
                              <StatusIcon className="h-3 w-3" />
                              {supplierReturn.status}
                            </div>
                          </div>
                          <CardDescription className="text-xs sm:text-sm mt-1">
                            {supplierReturn.supplier.name} | {supplierReturn.warehouse.name} {tScm("k_6f574afdc8eb")} {supplierReturn.goodsReceipt.receiptNumber}
                          </CardDescription>
                        </div>
                        <Button size="sm" variant="outline" asChild className="self-start">
                          <Link href={`/admin/scm/supplier-returns/${supplierReturn.id}`}>
                            {tScm("k_5444ca5a25cf")}
                          </Link>
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 space-y-4">
                      {/* Metadata Grid */}
                      <div className="grid gap-2 text-xs sm:text-sm text-muted-foreground grid-cols-2 sm:grid-cols-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{tScm("k_0bb6adcc63eb")} {formatDate(supplierReturn.requestedAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{tScm("k_d57939886670")} {formatDate(supplierReturn.requiredBy)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5" />
                          <span>{tScm("k_9c93af4a2e41")} {totalDispatched}/{totalRequested}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>{tScm("k_7b57fda673d9")} {formatMoney(dispatchedValue)}</span>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid gap-2 text-xs sm:text-sm grid-cols-2 sm:grid-cols-4 border-t border-border/50 pt-3">
                        <div>
                          <span className="text-muted-foreground">{tScm("k_0e83a5786fc9")}</span>{" "}
                          <span className="text-foreground">{supplierReturn.purchaseOrder?.poNumber ?? "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{tScm("k_2706e3eac5c7")}</span>{" "}
                          <span className="text-foreground">{supplierReturn.supplierInvoice?.invoiceNumber ?? "Not linked"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{tScm("k_b2621ccc59eb")}</span>{" "}
                          <span className="text-foreground">{supplierReturn.reasonCode || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{tScm("k_d040b84c5ac0")}</span>{" "}
                          <span className="text-foreground">{formatDate(supplierReturn.closedAt)}</span>
                        </div>
                      </div>

                      {/* Note */}
                      {supplierReturn.note && (
                        <div className="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
                          {tScm("k_83423c198b60")} {supplierReturn.note}
                        </div>
                      )}

                      {/* Items Table - Desktop */}
                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border">
                              <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_ecdda59aea5e")}</TableHead>
                              <TableHead className="text-right text-xs font-medium text-muted-foreground">{tScm("k_c26bf60fed37")}</TableHead>
                              <TableHead className="text-right text-xs font-medium text-muted-foreground">{tScm("k_ff07201ae2e7")}</TableHead>
                              <TableHead className="text-right text-xs font-medium text-muted-foreground">{tScm("k_0105252023c5")}</TableHead>
                              <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_f219cc0614ae")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {supplierReturn.items.map((item) => (
                              <TableRow key={item.id} className="border-border">
                                <TableCell className="py-3">
                                  <div className="font-medium text-sm text-foreground">
                                    {item.productVariant.product.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{item.productVariant.sku}</div>
                                </TableCell>
                                <TableCell className="text-right py-3 text-sm text-foreground">{item.quantityRequested}</TableCell>
                                <TableCell className="text-right py-3 text-sm text-foreground">{item.quantityDispatched}</TableCell>
                                <TableCell className="text-right py-3 text-sm text-foreground">{formatMoney(item.unitCost)}</TableCell>
                                <TableCell className="py-3 text-sm text-muted-foreground">{item.reason || "N/A"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Items - Mobile */}
                      <div className="space-y-2 md:hidden">
                        {supplierReturn.items.map((item) => (
                          <div key={item.id} className="rounded-lg border border-border p-3 space-y-1.5">
                            <div>
                              <p className="text-sm font-medium text-foreground">{item.productVariant.product.name}</p>
                              <p className="text-xs text-muted-foreground">{item.productVariant.sku}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <span className="text-xs text-muted-foreground">{tScm("k_0bb6adcc63eb")}</span>
                                <span className="ml-1 text-foreground">{item.quantityRequested}</span>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">{tScm("k_9c93af4a2e41")}</span>
                                <span className="ml-1 text-foreground">{item.quantityDispatched}</span>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">{tScm("k_09dd42ca7ef4")}</span>
                                <span className="ml-1 text-foreground">{formatMoney(item.unitCost)}</span>
                              </div>
                            </div>
                            {item.reason && (
                              <p className="text-xs text-muted-foreground">{tScm("k_2c25e64f53a5")} {item.reason}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-border/50">
                        {canManage && supplierReturn.status === "DRAFT" && (
                          <Button
                            size="sm"
                            onClick={() => void runAction(supplierReturn.id, "submit")}
                            disabled={saving}
                          >
                            {tScm("k_2dacf6595984")}
                          </Button>
                        )}

                        {canApprove && supplierReturn.status === "SUBMITTED" && (
                          <Button
                            size="sm"
                            onClick={() => void runAction(supplierReturn.id, "approve")}
                            disabled={saving}
                          >
                            {tScm("k_7b2c7f146aba")}
                          </Button>
                        )}

                        {canManage && ["APPROVED", "PARTIALLY_DISPATCHED"].includes(supplierReturn.status) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void runAction(supplierReturn.id, "dispatch")}
                            disabled={saving}
                          >
                            <Truck className="h-3.5 w-3.5 mr-1" />
                            {tScm("k_840e1b364a32")}
                          </Button>
                        )}

                        {canApprove && supplierReturn.status === "DISPATCHED" && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void runAction(supplierReturn.id, "close")}
                              disabled={saving || dispatchedValue <= 0}
                            >
                              {tScm("k_cf4df8f96b17")}
                            </Button>
                            {dispatchedValue <= 0 && (
                              <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {tScm("k_de6fa27a5c5a")}
                              </p>
                            )}
                          </>
                        )}

                        {(canManage || canApprove) && ["DRAFT", "SUBMITTED", "APPROVED"].includes(supplierReturn.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void runAction(supplierReturn.id, "cancel")}
                            disabled={saving}
                          >
                            {tScm("k_77dfd2135f4d")}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && paginatedReturns.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">{tScm("k_d79ce28a8929")}</p>
              {canManage && (
                <Button onClick={() => setCreateModalOpen(true)} variant="outline" className="mt-3">
                  <Plus className="h-4 w-4 mr-2" />
                  {tScm("k_5bcedb8ddee7")}
                </Button>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Create Return Modal */}
      <CreateReturnModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        goodsReceipts={goodsReceipts}
        supplierInvoices={supplierInvoices}
        selectedReceiptId={selectedReceiptId}
        selectedInvoiceId={selectedInvoiceId}
        requiredBy={requiredBy}
        reasonCode={reasonCode}
        note={note}
        items={items}
        saving={saving}
        onReceiptChange={setSelectedReceiptId}
        onInvoiceChange={setSelectedInvoiceId}
        onRequiredByChange={setRequiredBy}
        onReasonCodeChange={setReasonCode}
        onNoteChange={setNote}
        onItemUpdate={updateItem}
        onCreate={createSupplierReturn}
      />
    </div>
  );
}
