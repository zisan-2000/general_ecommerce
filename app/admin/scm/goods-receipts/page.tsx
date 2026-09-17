
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import { uploadFile } from "@/lib/upload-file";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { ScmStatusChip } from "@/components/admin/scm/ScmStatusChip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type PurchaseOrder = {
  id: number;
  poNumber: string;
  status: string;
  warehouse: { id: number; name: string; code: string };
  supplier: { id: number; name: string; code: string };
  items: Array<{
    id: number;
    quantityOrdered: number;
    quantityReceived: number;
    productVariant: {
      id: number;
      sku: string;
      product: { id: number; name: string };
    };
  }>;
};

type ReceiptRole = "REQUESTER" | "PROCUREMENT" | "ADMINISTRATION";
type AttachmentType = "CHALLAN" | "BILL" | "OTHER";

type GoodsReceipt = {
  id: number;
  receiptNumber: string;
  status: string;
  receivedAt: string;
  note: string | null;
  requesterConfirmedAt: string | null;
  requesterConfirmationNote: string | null;
  requesterConfirmedBy: { id: string; name: string | null; email: string | null } | null;
  warehouse: { id: number; name: string; code: string };
  purchaseOrder: {
    id: number;
    poNumber: string;
    supplier: { id: number; name: string };
    purchaseRequisition: {
      id: number;
      requisitionNumber: string;
      createdBy: { id: string; name: string | null; email: string | null } | null;
    } | null;
  };
  items: Array<{
    id: number;
    quantityReceived: number;
    productVariant: { sku: string; product: { name: string } };
  }>;
  attachments: Array<{
    id: number;
    type: AttachmentType;
    fileUrl: string;
    fileName: string | null;
    mimeType: string | null;
    fileSize: number | null;
    note: string | null;
    createdAt: string;
    uploadedBy: { id: string; name: string | null; email: string | null } | null;
  }>;
  vendorEvaluations: Array<{
    id: number;
    evaluatorRole: ReceiptRole;
    overallRating: number;
    serviceQualityRating: number | null;
    deliveryRating: number | null;
    complianceRating: number | null;
    comment: string | null;
    createdAt: string;
    updatedAt: string;
    createdBy: { id: string; name: string | null; email: string | null } | null;
  }>;
  workflow: {
    requesterUserId: string | null;
    requesterConfirmed: boolean;
    canRequesterConfirm: boolean;
    canManageAttachments: boolean;
    allowedEvaluationRoles: ReceiptRole[];
    submittedEvaluationRoles: ReceiptRole[];
    missingEvaluationRoles: ReceiptRole[];
    evaluationCompleted: boolean;
  };
  matchSummary: {
    orderedQuantity: number;
    receivedQuantity: number;
    invoicedQuantity: number;
    invoiceCount: number;
    status: "PENDING" | "MATCHED" | "VARIANCE";
  };
};

type AttachmentDraft = { type: AttachmentType; note: string; file: File | null };
type EvaluationDraft = {
  evaluatorRole: ReceiptRole;
  overallRating: string;
  serviceQualityRating: string;
  deliveryRating: string;
  complianceRating: string;
  comment: string;
};

const REQUIRED_ROLES: ReceiptRole[] = ["REQUESTER", "PROCUREMENT", "ADMINISTRATION"];

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

function fmtDate(value: string | null | undefined, locale: string, unavailable: string) {
  if (!value) return unavailable;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return unavailable;
  return parsed.toLocaleString(locale);
}

function getInitialEvaluationDraft(allowedRoles: ReceiptRole[]): EvaluationDraft {
  return {
    evaluatorRole: allowedRoles[0] || "REQUESTER",
    overallRating: "5",
    serviceQualityRating: "5",
    deliveryRating: "5",
    complianceRating: "5",
    comment: "",
  };
}

export default function GoodsReceiptsPage() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const t = useTranslations("AdminGoodsReceipts");
  const locale = useLocale();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];
  const canManagePosting = permissions.includes("goods_receipts.manage");

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [focus, setFocus] = useState((searchParams.get("focus") || "ALL").toUpperCase());

  const [confirmationNotes, setConfirmationNotes] = useState<Record<number, string>>({});
  const [attachmentDrafts, setAttachmentDrafts] = useState<Record<number, AttachmentDraft>>({});
  const [evaluationDrafts, setEvaluationDrafts] = useState<Record<number, EvaluationDraft>>({});

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setFocus((searchParams.get("focus") || "ALL").toUpperCase());
  }, [searchParams]);

  const loadPageData = async () => {
    try {
      setLoading(true);
      const [receiptData, purchaseOrderData] = await Promise.all([
        getJson<GoodsReceipt[]>("/api/scm/goods-receipts", t("errors.load")),
        canManagePosting
          ? getJson<PurchaseOrder[]>("/api/scm/purchase-orders", t("errors.loadPurchaseOrders"))
          : Promise.resolve([] as PurchaseOrder[]),
      ]);
      setReceipts(Array.isArray(receiptData) ? receiptData : []);
      setPurchaseOrders(Array.isArray(purchaseOrderData) ? purchaseOrderData : []);
    } catch (error: any) {
      toast.error(error?.message || t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData();
  }, [canManagePosting]);

  const eligiblePurchaseOrders = useMemo(
    () =>
      purchaseOrders.filter((purchaseOrder) =>
        ["APPROVED", "PARTIALLY_RECEIVED"].includes(purchaseOrder.status),
      ),
    [purchaseOrders],
  );

  const visibleReceipts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return receipts.filter((receipt) => {
      if (focus === "PENDING-CONFIRMATION" && receipt.requesterConfirmedAt) return false;
      if (focus === "VARIANCE" && receipt.matchSummary.status !== "VARIANCE") return false;
      if (focus === "INCOMPLETE-EVALUATION" && receipt.workflow.evaluationCompleted) return false;
      if (!query) return true;
      return (
        receipt.receiptNumber.toLowerCase().includes(query) ||
        receipt.purchaseOrder.poNumber.toLowerCase().includes(query) ||
        receipt.purchaseOrder.supplier.name.toLowerCase().includes(query.toLowerCase()) ||
        receipt.warehouse.name.toLowerCase().includes(query) ||
        receipt.purchaseOrder.purchaseRequisition?.requisitionNumber
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [focus, receipts, search]);

  const summary = useMemo(
    () => ({
      total: receipts.length,
      pendingConfirmation: receipts.filter((receipt) => !receipt.requesterConfirmedAt).length,
      variance: receipts.filter((receipt) => receipt.matchSummary.status === "VARIANCE").length,
      incompleteEvaluation: receipts.filter((receipt) => !receipt.workflow.evaluationCompleted).length,
      readyToReceive: eligiblePurchaseOrders.length,
    }),
    [eligiblePurchaseOrders.length, receipts],
  );

  const patchReceipt = async (
    receiptId: number,
    payload: Record<string, unknown>,
    successMessage: string,
    key: string,
  ) => {
    try {
      setBusyKey(key);
      const response = await fetch(`/api/scm/goods-receipts/${receiptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readJson(response, t("errors.update"));
      toast.success(successMessage);
      await loadPageData();
    } catch (error: any) {
      toast.error(error?.message || t("errors.update"));
    } finally {
      setBusyKey(null);
    }
  };

  const getAttachmentDraft = (receiptId: number): AttachmentDraft =>
    attachmentDrafts[receiptId] || { type: "CHALLAN", note: "", file: null };

  const setAttachmentDraft = (receiptId: number, patch: Partial<AttachmentDraft>) => {
    setAttachmentDrafts((prev) => ({
      ...prev,
      [receiptId]: { ...getAttachmentDraft(receiptId), ...patch },
    }));
  };

  const uploadAttachment = async (receipt: GoodsReceipt) => {
    const draft = getAttachmentDraft(receipt.id);
    if (!draft.file) {
      toast.error(t("errors.selectFile"));
      return;
    }
    const busy = `${receipt.id}:upload_attachment`;
    try {
      setBusyKey(busy);
      const fileUrl = await uploadFile(draft.file, "/api/upload/scm-grn");
      const response = await fetch(`/api/scm/goods-receipts/${receipt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_attachment",
          type: draft.type,
          note: draft.note,
          fileUrl,
          fileName: draft.file.name,
          mimeType: draft.file.type || null,
          fileSize: draft.file.size,
        }),
      });
      await readJson(response, t("errors.uploadAttachment"));
      toast.success(t("toasts.attachmentUploaded"));
      setAttachmentDrafts((prev) => ({
        ...prev,
        [receipt.id]: { type: draft.type, note: "", file: null },
      }));
      await loadPageData();
    } catch (error: any) {
      toast.error(error?.message || t("errors.uploadAttachment"));
    } finally {
      setBusyKey(null);
    }
  };

  const getEvaluationDraft = (receipt: GoodsReceipt): EvaluationDraft => {
    const existing = evaluationDrafts[receipt.id];
    if (!existing) return getInitialEvaluationDraft(receipt.workflow.allowedEvaluationRoles);
    if (!receipt.workflow.allowedEvaluationRoles.includes(existing.evaluatorRole)) {
      return {
        ...existing,
        evaluatorRole: receipt.workflow.allowedEvaluationRoles[0] || "REQUESTER",
      };
    }
    return existing;
  };

  const setEvaluationDraft = (
    receipt: GoodsReceipt,
    patch: Partial<EvaluationDraft>,
  ) => {
    setEvaluationDrafts((prev) => ({
      ...prev,
      [receipt.id]: { ...getEvaluationDraft(receipt), ...patch },
    }));
  };

  const submitEvaluation = async (receipt: GoodsReceipt) => {
    const draft = getEvaluationDraft(receipt);
    if (!receipt.workflow.allowedEvaluationRoles.includes(draft.evaluatorRole)) {
      toast.error(t("errors.evaluatorRole"));
      return;
    }
    await patchReceipt(
      receipt.id,
      {
        action: "submit_evaluation",
        evaluatorRole: draft.evaluatorRole,
        overallRating: Number(draft.overallRating),
        serviceQualityRating: draft.serviceQualityRating
          ? Number(draft.serviceQualityRating)
          : null,
        deliveryRating: draft.deliveryRating ? Number(draft.deliveryRating) : null,
        complianceRating: draft.complianceRating
          ? Number(draft.complianceRating)
          : null,
        comment: draft.comment,
      },
      t("toasts.evaluationSubmitted", { role: t(`roles.${draft.evaluatorRole}` as any) }),
      `${receipt.id}:submit_evaluation`,
    );
  };

  const formatDate = (value?: string | null) =>
    fmtDate(value, locale, t("common.notAvailable"));

  const roleLabel = (role: ReceiptRole) => t(`roles.${role}` as any);
  const matchStatusLabel = (status: GoodsReceipt["matchSummary"]["status"]) =>
    t(`match.statuses.${status}` as any);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("header.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("header.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManagePosting ? (
            <Button asChild>
              <Link href="/admin/scm/goods-receipts/new">
                <Plus className="mr-2 h-4 w-4" />
                {t("actions.newGrn")}
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => void loadPageData()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("actions.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-5">
        <ScmStatCard className="col-span-2 md:col-span-1" label={t("stats.total.label")} value={String(summary.total)} hint={t("stats.total.hint")} />
        <ScmStatCard label={t("stats.pendingConfirmation.label")} value={String(summary.pendingConfirmation)} hint={t("stats.pendingConfirmation.hint")} />
        <ScmStatCard label={t("stats.variance.label")} value={String(summary.variance)} hint={t("stats.variance.hint")} />
        <ScmStatCard label={t("stats.evaluationPending.label")} value={String(summary.incompleteEvaluation)} hint={t("stats.evaluationPending.hint")} />
        <ScmStatCard label={t("stats.readyToReceive.label")} value={String(summary.readyToReceive)} hint={t("stats.readyToReceive.hint")} />
      </div>

      {focus !== "ALL" || search.trim() ? (
        <Card className="border-amber-200 bg-amber-50/60 shadow-none">
          <CardContent className="flex flex-col gap-2 p-4 text-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-foreground">{t("focus.activeTitle")}</p>
              <p className="text-muted-foreground">
                {focus === "PENDING-CONFIRMATION"
                  ? t("focus.pendingConfirmation")
                  : focus === "VARIANCE"
                    ? t("focus.variance")
                    : focus === "INCOMPLETE-EVALUATION"
                      ? t("focus.incompleteEvaluation")
                      : focus === "POST"
                        ? t("focus.post")
                        : t("focus.filtered")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManagePosting && focus === "POST" ? (
                <Button asChild>
                  <Link href="/admin/scm/goods-receipts/new">{t("actions.openGrnCreator")}</Link>
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => {
                  setFocus("ALL");
                  setSearch("");
                }}
              >
                {t("actions.clearFocus")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("register.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
            >
              <option value="ALL">{t("filters.allQueues")}</option>
              <option value="PENDING-CONFIRMATION">{t("filters.pendingConfirmation")}</option>
              <option value="VARIANCE">{t("filters.variance")}</option>
              <option value="INCOMPLETE-EVALUATION">{t("filters.evaluationPending")}</option>
              {canManagePosting ? <option value="POST">{t("filters.readyToPost")}</option> : null}
            </select>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {t("register.visibleReceipts", { count: visibleReceipts.length })}
            </div>
            <Button variant="outline" onClick={() => void loadPageData()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("actions.refresh")}
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : visibleReceipts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="space-y-4">
              {visibleReceipts.map((receipt) => {
                const attachmentDraft = getAttachmentDraft(receipt.id);
                const evaluationDraft = getEvaluationDraft(receipt);
                const evaluationsByRole = new Map(
                  receipt.vendorEvaluations.map((item) => [item.evaluatorRole, item]),
                );

                return (
                  <div key={receipt.id} className="space-y-4 rounded-lg border p-4">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-lg font-semibold">{receipt.receiptNumber}</div>
                        <div className="text-sm text-muted-foreground">{receipt.purchaseOrder.poNumber} • {receipt.purchaseOrder.supplier.name}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/scm/goods-receipts/${receipt.id}`}>{t("actions.openDetail")}</Link>
                        </Button>
                        <ScmStatusChip status={receipt.matchSummary.status} />
                        <span>{t("labels.dateAndWarehouse", { date: formatDate(receipt.receivedAt), warehouse: receipt.warehouse.code })}</span>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-md border p-3 text-sm md:grid-cols-3">
                      <div>
                        <p className="font-medium">{t("match.title")}</p>
                        <p className="text-muted-foreground">{t("match.quantities", { ordered: receipt.matchSummary.orderedQuantity, delivered: receipt.matchSummary.receivedQuantity, invoiced: receipt.matchSummary.invoicedQuantity })}</p>
                        <p className="text-muted-foreground">{t("match.invoices", { count: receipt.matchSummary.invoiceCount, status: matchStatusLabel(receipt.matchSummary.status) })}</p>
                      </div>
                      <div>
                        <p className="font-medium">{t("confirmation.title")}</p>
                        <p className="text-muted-foreground">{receipt.requesterConfirmedAt ? t("confirmation.confirmedAt", { date: formatDate(receipt.requesterConfirmedAt) }) : t("confirmation.pending")}</p>
                        {receipt.requesterConfirmedBy ? <p className="text-muted-foreground">{t("labels.by", { name: receipt.requesterConfirmedBy.name || receipt.requesterConfirmedBy.email || t("common.notAvailable") })}</p> : null}
                      </div>
                      <div>
                        <p className="font-medium">{t("evaluation.completionTitle")}</p>
                        <p className="text-muted-foreground">{receipt.workflow.evaluationCompleted ? t("evaluation.completed") : t("evaluation.pendingRoles", { roles: receipt.workflow.missingEvaluationRoles.map(roleLabel).join(", ") || t("common.notAvailable") })}</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("table.item")}</TableHead>
                            <TableHead>{t("table.qtyReceived")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {receipt.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="font-medium">{item.productVariant.product.name}</div>
                                <div className="text-xs text-muted-foreground">{item.productVariant.sku}</div>
                              </TableCell>
                              <TableCell>{item.quantityReceived}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 rounded-md border p-3">
                        <p className="font-medium">{t("confirmation.reviewTitle")}</p>
                        {receipt.requesterConfirmationNote ? <p className="text-sm text-muted-foreground">{t("labels.note", { note: receipt.requesterConfirmationNote })}</p> : null}
                        {receipt.workflow.canRequesterConfirm ? (
                          <>
                            <Textarea
                              rows={3}
                              placeholder={t("confirmation.notePlaceholder")}
                              value={confirmationNotes[receipt.id] || ""}
                              onChange={(event) =>
                                setConfirmationNotes((prev) => ({ ...prev, [receipt.id]: event.target.value }))
                              }
                            />
                            <Button
                              onClick={() =>
                                void patchReceipt(
                                  receipt.id,
                                  { action: "requester_confirm", note: confirmationNotes[receipt.id] || "" },
                                  t("toasts.requesterConfirmed"),
                                  `${receipt.id}:requester_confirm`,
                                )
                              }
                              disabled={busyKey === `${receipt.id}:requester_confirm`}
                            >
                              {t("actions.confirmGrn")}
                            </Button>
                          </>
                        ) : null}
                      </div>

                      <div className="space-y-2 rounded-md border p-3">
                        <p className="font-medium">{t("attachments.title")}</p>
                        {receipt.attachments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("attachments.empty")}</p>
                        ) : (
                          <div className="space-y-2">
                            {receipt.attachments.map((attachment) => (
                              <div key={attachment.id} className="rounded border p-2 text-sm">
                                <p className="font-medium">{t("attachments.fileTitle", { type: t(`attachmentTypes.${attachment.type}` as any), fileName: attachment.fileName || t("attachments.attachmentFallback") })}</p>
                                <p className="text-muted-foreground">{t("attachments.uploadedBy", { date: formatDate(attachment.createdAt), name: attachment.uploadedBy?.name || attachment.uploadedBy?.email || t("common.notAvailable") })}</p>
                                {attachment.note ? <p className="text-muted-foreground">{t("labels.note", { note: attachment.note })}</p> : null}
                                <a href={attachment.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline">{t("actions.viewFile")}</a>
                              </div>
                            ))}
                          </div>
                        )}

                        {receipt.workflow.canManageAttachments ? (
                          <div className="space-y-2 rounded border p-2">
                            <div className="grid gap-2 md:grid-cols-2">
                              <select
                                className="h-10 rounded-md border bg-background px-3 text-sm"
                                value={attachmentDraft.type}
                                onChange={(event) => setAttachmentDraft(receipt.id, { type: event.target.value as AttachmentType })}
                              >
                                <option value="CHALLAN">{t("attachmentTypes.CHALLAN")}</option>
                                <option value="BILL">{t("attachmentTypes.BILL")}</option>
                                <option value="OTHER">{t("attachmentTypes.OTHER")}</option>
                              </select>
                              <Input
                                type="file"
                                onChange={(event) => setAttachmentDraft(receipt.id, { file: event.target.files?.[0] || null })}
                              />
                            </div>
                            <Textarea
                              rows={2}
                              placeholder={t("attachments.notePlaceholder")}
                              value={attachmentDraft.note}
                              onChange={(event) => setAttachmentDraft(receipt.id, { note: event.target.value })}
                            />
                            <Button onClick={() => void uploadAttachment(receipt)} disabled={busyKey === `${receipt.id}:upload_attachment`}>
                              {busyKey === `${receipt.id}:upload_attachment` ? t("actions.uploading") : t("actions.uploadAttachment")}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-md border p-3">
                      <p className="font-medium">{t("evaluation.title")}</p>
                      <div className="grid gap-2 md:grid-cols-3">
                        {REQUIRED_ROLES.map((role) => {
                          const row = evaluationsByRole.get(role);
                          return (
                            <div key={role} className="rounded border p-2 text-sm">
                              <p className="font-medium">{roleLabel(role)}</p>
                              {row ? (
                                <>
                                  <p className="text-muted-foreground">{t("evaluation.overall", { rating: row.overallRating })}</p>
                                  <p className="text-muted-foreground">{t("evaluation.breakdown", { service: row.serviceQualityRating ?? t("common.notAvailable"), delivery: row.deliveryRating ?? t("common.notAvailable"), compliance: row.complianceRating ?? t("common.notAvailable") })}</p>
                                  <p className="text-muted-foreground">{t("evaluation.byAt", { name: row.createdBy?.name || row.createdBy?.email || t("common.notAvailable"), date: formatDate(row.updatedAt) })}</p>
                                </>
                              ) : (
                                <p className="text-muted-foreground">{t("evaluation.pending")}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {receipt.workflow.allowedEvaluationRoles.length > 0 ? (
                        <div className="space-y-2 rounded border p-3">
                          <div className="grid gap-2 md:grid-cols-5">
                            <select
                              className="h-10 rounded-md border bg-background px-3 text-sm"
                              value={evaluationDraft.evaluatorRole}
                              onChange={(event) => setEvaluationDraft(receipt, { evaluatorRole: event.target.value as ReceiptRole })}
                            >
                              {receipt.workflow.allowedEvaluationRoles.map((role) => (
                                <option key={role} value={role}>{roleLabel(role)}</option>
                              ))}
                            </select>
                            <Input type="number" min={1} max={5} placeholder={t("evaluation.fields.overall")} value={evaluationDraft.overallRating} onChange={(event) => setEvaluationDraft(receipt, { overallRating: event.target.value })} />
                            <Input type="number" min={1} max={5} placeholder={t("evaluation.fields.service")} value={evaluationDraft.serviceQualityRating} onChange={(event) => setEvaluationDraft(receipt, { serviceQualityRating: event.target.value })} />
                            <Input type="number" min={1} max={5} placeholder={t("evaluation.fields.delivery")} value={evaluationDraft.deliveryRating} onChange={(event) => setEvaluationDraft(receipt, { deliveryRating: event.target.value })} />
                            <Input type="number" min={1} max={5} placeholder={t("evaluation.fields.compliance")} value={evaluationDraft.complianceRating} onChange={(event) => setEvaluationDraft(receipt, { complianceRating: event.target.value })} />
                          </div>
                          <Textarea
                            rows={2}
                            placeholder={t("evaluation.notePlaceholder")}
                            value={evaluationDraft.comment}
                            onChange={(event) => setEvaluationDraft(receipt, { comment: event.target.value })}
                          />
                          <Button onClick={() => void submitEvaluation(receipt)} disabled={busyKey === `${receipt.id}:submit_evaluation`}>
                            {busyKey === `${receipt.id}:submit_evaluation` ? t("actions.submitting") : t("actions.submitEvaluation")}
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("evaluation.noRole")}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
