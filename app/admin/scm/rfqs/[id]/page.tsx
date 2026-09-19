"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScmDocumentLifecycle } from "@/components/admin/scm/ScmDocumentLifecycle";
import { ScmNextStepPanel } from "@/components/admin/scm/ScmNextStepPanel";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { ScmStatusChip } from "@/components/admin/scm/ScmStatusChip";

type Warehouse = { id: number; name: string; code: string };
type Supplier = {
  id: number;
  name: string;
  code: string;
  categories?: Array<{ id: number; code: string; name: string; isActive?: boolean }>;
};
type SupplierCategory = { id: number; name: string; code: string };

type Rfq = {
  id: number;
  rfqNumber: string;
  status: string;
  requestedAt: string;
  submittedAt?: string | null;
  closedAt?: string | null;
  cancelledAt?: string | null;
  submissionDeadline: string | null;
  isBlindReviewActive?: boolean;
  quotationSubmissionCount?: number;
  quotationsVisibleAt?: string | null;
  note: string | null;
  scopeOfWork?: string | null;
  termsAndConditions?: string | null;
  boqDetails?: string | null;
  technicalSpecifications?: string | null;
  evaluationCriteria?: string | null;
  resubmissionAllowed?: boolean;
  resubmissionRound?: number;
  warehouse: Warehouse;
  purchaseRequisition?: {
    id: number;
    requisitionNumber: string;
    status: string;
    title?: string | null;
  } | null;
  categoryTargets?: Array<{
    id: number;
    supplierCategoryId: number;
    supplierCategory: SupplierCategory;
  }>;
  attachments?: Array<{
    id: number;
    label: string | null;
    fileUrl: string;
    fileName: string | null;
  }>;
  items: Array<{
    id: number;
    quantityRequested: number;
    description: string | null;
    targetUnitCost: string | null;
    productVariant: { sku: string; product: { name: string } };
  }>;
  supplierInvites: Array<{
    id?: number;
    supplierId: number;
    supplier: Supplier;
    status: string;
  }>;
  quotations: Array<{
    id: number;
    supplierId: number;
    supplier: Supplier;
    total: string;
    currency: string;
    revisionNo?: number;
    quotedAt?: string;
    technicalProposal?: string | null;
    financialProposal?: string | null;
    note?: string | null;
    attachments?: Array<{
      id: number;
      proposalType: "TECHNICAL" | "FINANCIAL" | "SUPPORTING";
      label: string | null;
      fileUrl: string;
      fileName: string | null;
    }>;
  }>;
  award: {
    purchaseOrderId: number | null;
    supplier: Supplier;
    supplierQuotationId: number;
  } | null;
  comparativeStatements?: Array<{
    id: number;
    csNumber: string;
    status: string;
    generatedPurchaseOrder?: {
      id: number;
      poNumber: string;
      status: string;
      goodsReceipts?: Array<{
        id: number;
        receiptNumber: string;
        status: string;
      }>;
      supplierInvoices?: Array<{
        id: number;
        invoiceNumber: string;
        status: string;
      }>;
      paymentRequests?: Array<{
        id: number;
        prfNumber: string;
        status: string;
        supplierPayment?: {
          id: number;
          paymentNumber: string;
          amount: string | number;
        } | null;
      }>;
    } | null;
  }>;
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { error?: string }).error || fallback);
  return payload as T;
}

function fmtDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function toStageLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function RfqDetailPage() {
  const tScm = useTranslations("ScmAuto");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rfqId = Number(params?.id);
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];

  const canManage = permissions.includes("rfq.manage");
  const canApprove = permissions.includes("rfq.approve");
  const canConvertPo = permissions.includes("purchase_orders.manage");

  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierCategories, setSupplierCategories] = useState<SupplierCategory[]>([]);
  const [inviteSupplier, setInviteSupplier] = useState("");
  const [inviteCategory, setInviteCategory] = useState("");
  const [quoteSupplier, setQuoteSupplier] = useState("");
  const [quoteUnitCost, setQuoteUnitCost] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [awardQuoteId, setAwardQuoteId] = useState("");
  const [resubmissionReason, setResubmissionReason] = useState("");

  const loadData = async () => {
    if (!Number.isInteger(rfqId) || rfqId <= 0) {
      toast.error(tScm("k_0d202f720195"));
      router.replace("/admin/scm/rfqs");
      return;
    }
    try {
      setLoading(true);
      const [rfqRes, supplierRes, categoryRes] = await Promise.all([
        fetch(`/api/scm/rfqs/${rfqId}`, { cache: "no-store" }),
        canManage
          ? fetch("/api/scm/suppliers", { cache: "no-store" })
          : Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
        canManage
          ? fetch("/api/scm/supplier-categories?active=true", { cache: "no-store" })
          : Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
      ]);

      const rfqData = await readJson<Rfq>(rfqRes, "Failed to load RFQ");
      const supplierData = supplierRes.ok
        ? await readJson<Supplier[]>(supplierRes, "Failed to load suppliers")
        : [];
      const categoryData = categoryRes.ok
        ? await readJson<SupplierCategory[]>(categoryRes, "Failed to load categories")
        : [];

      setRfq(rfqData);
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setSupplierCategories(Array.isArray(categoryData) ? categoryData : []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load RFQ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [rfqId, canManage]);

  const patchAction = async (action: string, extra?: Record<string, unknown>) => {
    if (!rfq) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/scm/rfqs/${rfq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(extra || {}) }),
      });
      await readJson(response, `Failed to ${action}`);
      toast.success(`RFQ ${toStageLabel(action)} completed`);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${action}`);
    } finally {
      setSaving(false);
    }
  };

  const suggestedSuppliers = useMemo(() => {
    if (!rfq) return [] as Supplier[];
    const targetCategoryIds = new Set(
      (rfq.categoryTargets || []).map((target) => target.supplierCategoryId),
    );
    if (targetCategoryIds.size === 0) return suppliers;
    return suppliers.filter((supplier) =>
      (supplier.categories || []).some((category) => targetCategoryIds.has(category.id)),
    );
  }, [rfq, suppliers]);

  const inviteOptions = useMemo(() => {
    if (!rfq) return [];
    const invitedIds = new Set(rfq.supplierInvites.map((item) => item.supplierId));
    return suggestedSuppliers.filter((supplier) => !invitedIds.has(supplier.id));
  }, [rfq, suggestedSuppliers]);

  const quotationSupplierOptions = useMemo(() => {
    if (!rfq) return [] as Supplier[];
    return rfq.supplierInvites.map((item) => item.supplier);
  }, [rfq]);

  const lifecycleStages = useMemo(() => {
    if (!rfq) return [];
    const latestCs = rfq.comparativeStatements?.[0] ?? null;
    const latestPo =
      latestCs?.generatedPurchaseOrder ??
      (rfq.award?.purchaseOrderId
        ? {
            id: rfq.award.purchaseOrderId,
            poNumber: `PO #${rfq.award.purchaseOrderId}`,
            status: "CREATED",
          }
        : null);
    const latestReceipt = latestCs?.generatedPurchaseOrder?.goodsReceipts?.[0] ?? null;
    const latestInvoice = latestCs?.generatedPurchaseOrder?.supplierInvoices?.[0] ?? null;
    const latestPrf = latestCs?.generatedPurchaseOrder?.paymentRequests?.[0] ?? null;
    const latestPayment = latestPrf?.supplierPayment ?? null;

    return [
      {
        key: "requisition",
        label: tScm("k_7dc430086b99"),
        value: rfq.purchaseRequisition?.requisitionNumber || "Direct RFQ",
        helperText: rfq.purchaseRequisition ? toStageLabel(rfq.purchaseRequisition.status) : "No upstream requisition",
        href: rfq.purchaseRequisition ? `/admin/scm/purchase-requisitions/${rfq.purchaseRequisition.id}` : null,
        state: rfq.purchaseRequisition ? ("linked" as const) : ("pending" as const),
      },
      {
        key: "rfq",
        label: tScm("k_97619681ade9"),
        value: rfq.rfqNumber,
        helperText: toStageLabel(rfq.status),
        href: `/admin/scm/rfqs/${rfq.id}`,
        state: "current" as const,
      },
      {
        key: "cs",
        label: tScm("k_f374dc7483c7"),
        value: latestCs?.csNumber || "Not generated",
        helperText: latestCs ? toStageLabel(latestCs.status) : "Awaiting evaluation",
        href: null,
        state: latestCs ? ("linked" as const) : ("pending" as const),
      },
      {
        key: "po",
        label: tScm("k_3c45b957fdc8"),
        value: latestPo?.poNumber || "Not created",
        helperText: latestPo ? toStageLabel(latestPo.status) : "Awaiting award conversion",
        href: latestPo ? `/admin/scm/purchase-orders/${latestPo.id}` : null,
        state: latestPo ? ("linked" as const) : ("pending" as const),
      },
      {
        key: "grn",
        label: tScm("k_c60a3196b88f"),
        value: latestReceipt?.receiptNumber || "Not posted",
        helperText: latestReceipt ? toStageLabel(latestReceipt.status) : "Awaiting delivery",
        href: null,
        state: latestReceipt ? ("linked" as const) : ("pending" as const),
      },
      {
        key: "invoice",
        label: tScm("k_f9f38818c406"),
        value: latestInvoice?.invoiceNumber || "Not posted",
        helperText: latestInvoice ? toStageLabel(latestInvoice.status) : "Awaiting AP posting",
        href: null,
        state: latestInvoice ? ("linked" as const) : ("pending" as const),
      },
      {
        key: "prf",
        label: tScm("k_47b96c66a290"),
        value: latestPrf?.prfNumber || "Not created",
        helperText: latestPrf ? toStageLabel(latestPrf.status) : "Awaiting payment request",
        href: latestPrf ? `/admin/scm/payment-requests/${latestPrf.id}` : null,
        state: latestPrf ? ("linked" as const) : ("pending" as const),
      },
      {
        key: "payment",
        label: tScm("k_b41a92bed032"),
        value: latestPayment?.paymentNumber || "Not settled",
        helperText: latestPayment ? "Supplier payment posted" : "Awaiting treasury settlement",
        href: null,
        state: latestPayment ? ("linked" as const) : ("pending" as const),
      },
    ];
  }, [rfq]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <p className="text-sm text-muted-foreground">{tScm("k_35a6914b3ea9")}</p>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="space-y-6 p-6">
        <Button asChild variant="outline">
          <Link href="/admin/scm/rfqs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tScm("k_1763e9ae8697")}
          </Link>
        </Button>
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">{tScm("k_ac036119590b")}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/scm/rfqs">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tScm("k_b52b36b7269f")}
              </Link>
            </Button>
            <ScmStatusChip status={rfq.status} />
            {rfq.isBlindReviewActive ? <Badge variant="secondary">{tScm("k_324804bd2288")}</Badge> : null}
            {rfq.award?.purchaseOrderId ? <Badge variant="secondary">{tScm("k_41a29585becb")}</Badge> : null}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{rfq.rfqNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {rfq.purchaseRequisition?.requisitionNumber
                ? `Linked to ${rfq.purchaseRequisition.requisitionNumber}`
                : "RFQ detail workspace"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadData()} disabled={loading || saving}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {tScm("k_56e3badc4e6c")}
          </Button>
          {canManage && rfq.status === "DRAFT" ? (
            <Button variant="outline" onClick={() => void patchAction("submit")} disabled={saving}>
              {tScm("k_2dacf6595984")}
            </Button>
          ) : null}
          {canManage && ["SUBMITTED", "AWARDED"].includes(rfq.status) ? (
            <Button variant="outline" onClick={() => void patchAction("close")} disabled={saving}>
              {tScm("k_bbfa773e5a63")}
            </Button>
          ) : null}
          {canManage && ["DRAFT", "SUBMITTED", "CLOSED"].includes(rfq.status) ? (
            <Button variant="outline" onClick={() => void patchAction("cancel")} disabled={saving}>
              {tScm("k_77dfd2135f4d")}
            </Button>
          ) : null}
          {canConvertPo && rfq.status === "AWARDED" && rfq.award && !rfq.award.purchaseOrderId ? (
            <Button onClick={() => void patchAction("convert_to_po")} disabled={saving}>
              {tScm("k_28a415574019")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ScmStatCard
          label={tScm("k_298dff72dae2")}
          value={rfq.warehouse.name}
          hint={rfq.warehouse.code}
        />
        <ScmStatCard
          label={tScm("k_da81902f60ba")}
          value={rfq.submissionDeadline ? new Date(rfq.submissionDeadline).toLocaleDateString() : "-"}
          hint={`Requested ${new Date(rfq.requestedAt).toLocaleDateString()}`}
        />
        <ScmStatCard
          label={tScm("k_e7e4188f9d55")}
          value={`${rfq.supplierInvites.length} / ${rfq.quotationSubmissionCount ?? rfq.quotations.length}`}
          hint={`Round ${rfq.resubmissionRound ?? 0}`}
        />
        <ScmStatCard
          label={tScm("k_9f094fedb591")}
          value={rfq.award?.supplier.name || "Pending"}
          hint={rfq.award?.purchaseOrderId ? "PO already created" : "No PO linked"}
        />
      </div>

      <ScmDocumentLifecycle stages={lifecycleStages} />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: tScm("k_133fc4132ccb"), value: fmtDate(rfq.requestedAt) },
                  { label: tScm("k_2e00359b9802"), value: fmtDate(rfq.submittedAt) },
                  { label: tScm("k_559a8f46e9d1"), value: fmtDate(rfq.quotationsVisibleAt || rfq.submissionDeadline) },
                  { label: tScm("k_88d86b7721d5"), value: fmtDate(rfq.closedAt) },
                ].map((step) => (
                  <div key={step.label} className="rounded-lg border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{step.label}</div>
                    <div className="mt-2 text-sm font-medium">{step.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">{tScm("k_0efc2e6be4c2")}</TabsTrigger>
              <TabsTrigger value="suppliers">{tScm("k_6f76bb2b1215")}</TabsTrigger>
              <TabsTrigger value="proposals">{tScm("k_ef44f4b732a2")}</TabsTrigger>
              <TabsTrigger value="documents">{tScm("k_687c82861c95")}</TabsTrigger>
              <TabsTrigger value="award">{tScm("k_9f094fedb591")}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{tScm("k_52b5dc154507")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_0c444f6c7691")}</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{rfq.scopeOfWork || "-"}</p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_d35f2b98edf8")}</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{rfq.termsAndConditions || "-"}</p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_5aa07c3076cd")}</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{rfq.boqDetails || "-"}</p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_9719a1d80d88")}</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{rfq.technicalSpecifications || "-"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_19fbd3efcc80")}</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{rfq.evaluationCriteria || "-"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_ee2a43f64d7b")}</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{rfq.note || "-"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{tScm("k_27245af06003")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tScm("k_cc91b1ea2c16")}</TableHead>
                        <TableHead>{tScm("k_c26bf60fed37")}</TableHead>
                        <TableHead>{tScm("k_edad8124563c")}</TableHead>
                        <TableHead>{tScm("k_55f8ebc805e6")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rfq.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.productVariant.product.name}</div>
                            <div className="text-xs text-muted-foreground">{item.productVariant.sku}</div>
                          </TableCell>
                          <TableCell>{item.quantityRequested}</TableCell>
                          <TableCell>{item.targetUnitCost || "-"}</TableCell>
                          <TableCell>{item.description || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="suppliers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{tScm("k_8617b3e442a1")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(rfq.categoryTargets?.length || 0) > 0 ? (
                    <div className="rounded-lg border p-3 text-sm">
                      {tScm("k_5749e2497aa1")}{" "}
                      {(rfq.categoryTargets || [])
                        .map((target) => `${target.supplierCategory.name} (${target.supplierCategory.code})`)
                        .join(", ")}
                    </div>
                  ) : null}
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{tScm("k_25ec40f8283b")}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tScm("k_b9dd55bf53f4")}
                    </p>
                    <div className="mt-3 space-y-2">
                      {suggestedSuppliers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{tScm("k_42fb4ca05d97")}</p>
                      ) : (
                        suggestedSuppliers.map((supplier) => {
                          const invited = rfq.supplierInvites.some((invite) => invite.supplierId === supplier.id);
                          return (
                            <div key={supplier.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                              <div className="font-medium">
                                {supplier.name} ({supplier.code})
                              </div>
                              <Badge variant={invited ? "secondary" : "outline"}>
                                {invited ? "Already Invited" : "Suggested"}
                              </Badge>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{tScm("k_02cec5c63520")}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tScm("k_330feb3174d0")}
                    </p>
                    <div className="mt-3 space-y-2">
                  {rfq.supplierInvites.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tScm("k_9228605444d0")}</p>
                  ) : (
                    rfq.supplierInvites.map((invite) => (
                      <div key={`${invite.supplierId}-${invite.status}`} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">
                            {invite.supplier.name} ({invite.supplier.code})
                          </div>
                          <ScmStatusChip status={invite.status} />
                        </div>
                      </div>
                    ))
                  )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {canManage && ["DRAFT", "SUBMITTED"].includes(rfq.status) ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{tScm("k_8544def587b9")}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    <select
                      className="rounded-md border bg-background px-3 py-2 text-sm"
                      value={inviteSupplier}
                      onChange={(event) => setInviteSupplier(event.target.value)}
                    >
                      <option value="">{tScm("k_6a0d93ea2e57")}</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name} ({supplier.code})
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-md border bg-background px-3 py-2 text-sm"
                      value={inviteCategory}
                      onChange={(event) => setInviteCategory(event.target.value)}
                    >
                      <option value="">{tScm("k_c5291b0514a4")}</option>
                      {supplierCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name} ({category.code})
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      onClick={() =>
                        void patchAction("invite_suppliers", {
                          supplierIds: inviteSupplier ? [Number(inviteSupplier)] : [],
                          categoryIds: inviteCategory ? [Number(inviteCategory)] : undefined,
                        })
                      }
                      disabled={saving}
                    >
                      {tScm("k_b136609f0684")}
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="proposals" className="space-y-4">
              {rfq.isBlindReviewActive ? (
                <Card>
                  <CardContent className="pt-6 text-sm text-amber-700 dark:text-amber-300">
                    {tScm("k_7bdf0877a9ee")}{" "}
                    {fmtDate(rfq.quotationsVisibleAt || rfq.submissionDeadline)}.
                  </CardContent>
                </Card>
              ) : null}

              {!rfq.isBlindReviewActive && canManage && ["SUBMITTED", "CLOSED", "AWARDED"].includes(rfq.status) ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{tScm("k_a86a5502e464")}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-4">
                    <select
                      className="rounded-md border bg-background px-3 py-2 text-sm"
                      value={quoteSupplier}
                      onChange={(event) => setQuoteSupplier(event.target.value)}
                    >
                      <option value="">{tScm("k_94b4d9c7c631")}</option>
                      {quotationSupplierOptions.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name} ({supplier.code})
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={tScm("k_6cd3e47633c5")}
                      value={quoteUnitCost}
                      onChange={(event) => setQuoteUnitCost(event.target.value)}
                    />
                    <Input
                      placeholder={tScm("k_65f5911659e9")}
                      value={quoteNote}
                      onChange={(event) => setQuoteNote(event.target.value)}
                    />
                    <Button
                      onClick={() =>
                        void patchAction("submit_quotation", {
                          supplierId: Number(quoteSupplier || 0),
                          quotationNote: quoteNote || "",
                          taxTotal: 0,
                          items: rfq.items.map((item) => ({
                            rfqItemId: item.id,
                            quantityQuoted: item.quantityRequested,
                            unitCost: Number(quoteUnitCost || item.targetUnitCost || 0),
                            description: item.description || "",
                          })),
                        })
                      }
                      disabled={saving}
                    >
                      {tScm("k_8b96cd320dbb")}
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {!rfq.isBlindReviewActive && rfq.quotations.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{tScm("k_ed48ed9f341e")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {rfq.quotations.map((quotation) => (
                      <div key={quotation.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">
                            {quotation.supplier.name} ({quotation.supplier.code}) • {quotation.total} {quotation.currency}
                            {quotation.revisionNo ? ` • Rev ${quotation.revisionNo}` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground">{fmtDate(quotation.quotedAt)}</div>
                        </div>
                        {quotation.technicalProposal ? (
                          <div className="mt-2 text-sm text-muted-foreground">
                            {tScm("k_3a800d9a652d")} {quotation.technicalProposal}
                          </div>
                        ) : null}
                        {quotation.financialProposal ? (
                          <div className="mt-2 text-sm text-muted-foreground">
                            {tScm("k_bc04e065718a")} {quotation.financialProposal}
                          </div>
                        ) : null}
                        {quotation.note ? <div className="mt-2 text-sm">{tScm("k_83423c198b60")} {quotation.note}</div> : null}
                        {(quotation.attachments?.length || 0) > 0 ? (
                          <div className="mt-3 space-y-1">
                            {quotation.attachments?.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={attachment.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-sm underline-offset-4 hover:underline"
                              >
                                [{attachment.proposalType}] {attachment.label || attachment.fileName || "Attachment"}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{tScm("k_accd58e9d4a3")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(rfq.attachments?.length || 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">{tScm("k_935d7e1c16a3")}</p>
                  ) : (
                    rfq.attachments?.map((attachment) => (
                      <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                        <div>
                          <div className="font-medium">{attachment.label || attachment.fileName || "Attachment"}</div>
                          <div className="text-xs text-muted-foreground">{attachment.fileName || attachment.fileUrl}</div>
                        </div>
                        <Button asChild variant="outline" size="sm">
                          <a href={attachment.fileUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            {tScm("k_cf9b77061f7b")}
                          </a>
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="award" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{tScm("k_5ca189df534e")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rfq.award ? (
                    <div className="rounded-lg border p-3 text-sm">
                      {tScm("k_a437bf912ab0")} {rfq.award.supplier.name} ({rfq.award.supplier.code})
                      {rfq.award.purchaseOrderId ? " • Purchase order already linked." : " • Purchase order not created yet."}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{tScm("k_4c9b63066dc9")}</p>
                  )}

                  {canApprove && !rfq.isBlindReviewActive && rfq.quotations.length > 0 ? (
                    <div className="flex gap-2">
                      <select
                        className="rounded-md border bg-background px-3 py-2 text-sm"
                        value={awardQuoteId}
                        onChange={(event) => setAwardQuoteId(event.target.value)}
                      >
                        <option value="">{tScm("k_5a05a1cf7abb")}</option>
                        {rfq.quotations.map((quotation) => (
                          <option key={quotation.id} value={quotation.id}>
                            {quotation.supplier.name} • {quotation.total} {quotation.currency}
                            {quotation.revisionNo ? ` • Rev ${quotation.revisionNo}` : ""}
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={() =>
                          void patchAction("award", { quotationId: Number(awardQuoteId || 0) })
                        }
                        disabled={saving}
                      >
                        {tScm("k_9f094fedb591")}
                      </Button>
                    </div>
                  ) : null}

                  {canManage && ["SUBMITTED", "CLOSED", "AWARDED"].includes(rfq.status) && (rfq.resubmissionAllowed ?? true) ? (
                    <div className="grid gap-2 md:grid-cols-[3fr_auto]">
                      <Input
                        placeholder={tScm("k_74a386a3c03a")}
                        value={resubmissionReason}
                        onChange={(event) => setResubmissionReason(event.target.value)}
                      />
                      <Button
                        variant="outline"
                        onClick={() =>
                          void patchAction("request_resubmission", {
                            resubmissionReason: resubmissionReason || "",
                          })
                        }
                        disabled={saving}
                      >
                        {tScm("k_0ad06229dec8")}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_cc11b3a28fa3")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_d4377b049a04")}</div>
                <div className="mt-1">
                  {rfq.purchaseRequisition ? (
                    <Link
                      href={`/admin/scm/purchase-requisitions/${rfq.purchaseRequisition.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {rfq.purchaseRequisition.requisitionNumber}
                    </Link>
                  ) : (
                    "-"
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_5d7b53d0a275")}</div>
                <div className="mt-1">{rfq.resubmissionAllowed ? "Allowed" : "Locked"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_38189bba8f47")}</div>
                <div className="mt-1">{rfq.isBlindReviewActive ? "Active until deadline" : "Unlocked"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_bffcf43b50dc")}</div>
                <div className="mt-1">{rfq.award ? `Awarded to ${rfq.award.supplier.code}` : "Pending"}</div>
              </div>
            </CardContent>
          </Card>

          <ScmNextStepPanel
            title={rfq.status}
            subtitle={tScm("k_4483372ecedb")}
            emptyMessage={tScm("k_ad90a4161999")}
            actions={[
              ...(canManage && rfq.status === "DRAFT"
                ? [{ key: "submit", label: tScm("k_9d00db7c6490"), variant: "outline" as const, disabled: saving, onClick: () => void patchAction("submit") }]
                : []),
              ...(canManage && ["SUBMITTED", "AWARDED"].includes(rfq.status)
                ? [{ key: "close", label: tScm("k_73a6637f2cff"), variant: "outline" as const, disabled: saving, onClick: () => void patchAction("close") }]
                : []),
              ...(canManage && ["DRAFT", "SUBMITTED", "CLOSED"].includes(rfq.status)
                ? [{ key: "cancel", label: tScm("k_ec0c5be788f5"), variant: "outline" as const, disabled: saving, onClick: () => void patchAction("cancel") }]
                : []),
              ...(canConvertPo && rfq.status === "AWARDED" && rfq.award && !rfq.award.purchaseOrderId
                ? [{ key: "convert_to_po", label: tScm("k_30f1cf435150"), disabled: saving, onClick: () => void patchAction("convert_to_po") }]
                : []),
            ]}
          />
        </div>
      </div>
    </div>
  );
}
