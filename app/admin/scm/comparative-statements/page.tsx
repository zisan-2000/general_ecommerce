"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Rfq = {
  id: number;
  rfqNumber: string;
  status: string;
  warehouse: { id: number; name: string; code: string };
  submissionDeadline: string | null;
  quotationSubmissionCount?: number;
  supplierInvites: Array<{ id: number }>;
};

type ComparativeStatement = {
  id: number;
  csNumber: string;
  rfqId: number;
  versionNo: number;
  status: string;
  approvalStage: string;
  note: string | null;
  rejectionNote: string | null;
  generatedAt: string;
  submittedAt: string | null;
  managerApprovedAt: string | null;
  committeeApprovedAt: string | null;
  finalApprovedAt: string | null;
  warehouse: { id: number; name: string; code: string };
  rfq: { id: number; rfqNumber: string; status: string };
  generatedPurchaseOrder: {
    id: number;
    poNumber: string;
    status: string;
    approvalStage: string;
    submittedAt: string | null;
    approvedAt: string | null;
  } | null;
  technicalWeight: string;
  financialWeight: string;
  lines: Array<{
    id: number;
    supplierId: number;
    rank: number | null;
    isResponsive: boolean;
    technicalScore: string;
    financialScore: string;
    combinedScore: string;
    financialSubtotal: string;
    financialTaxTotal: string;
    financialGrandTotal: string;
    currency: string;
    technicalNote: string | null;
    financialNote: string | null;
    supplier: {
      id: number;
      name: string;
      code: string;
    };
  }>;
  approvalEvents: Array<{
    id: number;
    stage: string;
    decision: string;
    note: string | null;
    actedAt: string;
    actedBy: { id: string; name: string | null; email: string } | null;
  }>;
};

type ScorecardDraft = {
  technicalScore: string;
  isResponsive: boolean;
  technicalNote: string;
  financialNote: string;
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || fallback);
  }
  return payload as T;
}

function formatDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString();
}

function formatMoney(value: string | number) {
  return Number(value || 0).toFixed(2);
}

export default function ComparativeStatementsPage() {
  const t = useTranslations("AdminComparativeStatements");
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];

  const canRead = permissions.some((permission) =>
    [
      "comparative_statements.read",
      "comparative_statements.manage",
      "comparative_statements.approve_manager",
      "comparative_statements.approve_committee",
      "comparative_statements.approve_final",
    ].includes(permission),
  );
  const canManage = permissions.includes("comparative_statements.manage");
  const canApproveManager = permissions.includes("comparative_statements.approve_manager");
  const canApproveCommittee = permissions.includes(
    "comparative_statements.approve_committee",
  );
  const canApproveFinal = permissions.includes("comparative_statements.approve_final");
  const canGeneratePo = permissions.includes("purchase_orders.manage");
  const canApproveAny = canApproveManager || canApproveCommittee || canApproveFinal;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [statements, setStatements] = useState<ComparativeStatement[]>([]);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [selectedId, setSelectedId] = useState(searchParams.get("selectedId") || "");

  const [rfqId, setRfqId] = useState("");
  const [technicalWeight, setTechnicalWeight] = useState("70");
  const [financialWeight, setFinancialWeight] = useState("30");
  const [createNote, setCreateNote] = useState("");
  const [workflowNote, setWorkflowNote] = useState("");
  const [scorecardDraft, setScorecardDraft] = useState<Record<number, ScorecardDraft>>({});

  const loadData = async (preferredId?: number) => {
    setLoading(true);
    try {
      const [statementData, rfqData] = await Promise.all([
        fetch("/api/scm/comparative-statements", { cache: "no-store" }).then((response) =>
          readJson<ComparativeStatement[]>(response, t("errors.loadStatements")),
        ),
        fetch("/api/scm/rfqs", { cache: "no-store" }).then((response) =>
          readJson<Rfq[]>(response, t("errors.loadRfqs")),
        ),
      ]);

      const sortedStatements = Array.isArray(statementData) ? statementData : [];
      setStatements(sortedStatements);
      setRfqs(Array.isArray(rfqData) ? rfqData : []);

      const nextSelectedId =
        preferredId && sortedStatements.some((item) => item.id === preferredId)
          ? String(preferredId)
          : selectedId && sortedStatements.some((item) => item.id === Number(selectedId))
            ? selectedId
            : sortedStatements[0]
              ? String(sortedStatements[0].id)
              : "";
      setSelectedId(nextSelectedId);
    } catch (error: any) {
      toast.error(error?.message || t("errors.loadWorkspace"));
      setStatements([]);
      setRfqs([]);
      setSelectedId("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setStatusFilter(searchParams.get("status") || "");
    setSelectedId(searchParams.get("selectedId") || "");
  }, [searchParams]);

  const visibleStatements = useMemo(() => {
    const query = search.trim().toLowerCase();
    return statements.filter((statement) => {
      if (statusFilter && statement.status !== statusFilter) return false;
      if (!query) return true;
      return (
        statement.csNumber.toLowerCase().includes(query) ||
        statement.rfq.rfqNumber.toLowerCase().includes(query) ||
        statement.warehouse.name.toLowerCase().includes(query)
      );
    });
  }, [search, statements, statusFilter]);

  const selectedStatement = useMemo(
    () => statements.find((statement) => statement.id === Number(selectedId)) ?? null,
    [selectedId, statements],
  );

  useEffect(() => {
    if (!selectedStatement) {
      setScorecardDraft({});
      setWorkflowNote("");
      return;
    }
    const nextDraft: Record<number, ScorecardDraft> = {};
    for (const line of selectedStatement.lines) {
      nextDraft[line.id] = {
        technicalScore: String(Number(line.technicalScore || 0)),
        isResponsive: line.isResponsive,
        technicalNote: line.technicalNote || "",
        financialNote: line.financialNote || "",
      };
    }
    setScorecardDraft(nextDraft);
    setTechnicalWeight(String(Number(selectedStatement.technicalWeight || 70)));
    setFinancialWeight(String(Number(selectedStatement.financialWeight || 30)));
    setWorkflowNote(selectedStatement.note || "");
  }, [selectedStatement]);

  const eligibleRfqs = useMemo(
    () => rfqs.filter((rfq) => ["SUBMITTED", "CLOSED", "AWARDED"].includes(rfq.status)),
    [rfqs],
  );

  const updateScoreLine = (lineId: number, patch: Partial<ScorecardDraft>) => {
    setScorecardDraft((current) => ({
      ...current,
      [lineId]: {
        technicalScore: current[lineId]?.technicalScore ?? "0",
        isResponsive: current[lineId]?.isResponsive ?? true,
        technicalNote: current[lineId]?.technicalNote ?? "",
        financialNote: current[lineId]?.financialNote ?? "",
        ...patch,
      },
    }));
  };

  const createStatement = async () => {
    if (!rfqId) {
      toast.error(t("errors.rfqRequired"));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/scm/comparative-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfqId: Number(rfqId),
          technicalWeight: technicalWeight || null,
          financialWeight: financialWeight || null,
          note: createNote,
        }),
      });
      const created = await readJson<ComparativeStatement>(
        response,
        t("errors.generateFailed"),
      );
      toast.success(t("toasts.generated", { number: created.csNumber }));
      setRfqId("");
      setCreateNote("");
      await loadData(created.id);
    } catch (error: any) {
      toast.error(error?.message || t("errors.generateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const saveScorecard = async () => {
    if (!selectedStatement) return;
    const payloadLines = selectedStatement.lines.map((line) => ({
      id: line.id,
      technicalScore: scorecardDraft[line.id]?.technicalScore ?? "0",
      isResponsive: scorecardDraft[line.id]?.isResponsive ?? true,
      technicalNote: scorecardDraft[line.id]?.technicalNote ?? "",
      financialNote: scorecardDraft[line.id]?.financialNote ?? "",
    }));

    setSaving(true);
    try {
      const response = await fetch(`/api/scm/comparative-statements/${selectedStatement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicalWeight,
          financialWeight,
          note: workflowNote,
          lines: payloadLines,
        }),
      });
      const updated = await readJson<ComparativeStatement>(
        response,
        t("errors.scorecardFailed"),
      );
      toast.success(t("toasts.scorecardUpdated", { number: updated.csNumber }));
      await loadData(updated.id);
    } catch (error: any) {
      toast.error(error?.message || t("errors.scorecardFailed"));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: string) => {
    if (!selectedStatement) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/scm/comparative-statements/${selectedStatement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: workflowNote,
          rejectionNote: workflowNote,
        }),
      });
      const updated = await readJson<ComparativeStatement>(response, t("errors.actionFailed", { action }));
      toast.success(t("toasts.actionDone", { number: updated.csNumber, action }));
      await loadData(updated.id);
    } catch (error: any) {
      toast.error(error?.message || t("errors.actionFailed", { action }));
    } finally {
      setSaving(false);
    }
  };

  if (!canRead) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("forbidden.title")}</CardTitle>
            <CardDescription>{t("forbidden.description")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const statusOptions = [
    "DRAFT",
    "SUBMITTED",
    "MANAGER_APPROVED",
    "COMMITTEE_APPROVED",
    "FINAL_APPROVED",
    "REJECTED",
    "CANCELLED",
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t("header.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("header.description")}</p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("generate.title")}</CardTitle>
            <CardDescription>{t("generate.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>{t("generate.rfqLabel")}</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={rfqId}
                  onChange={(event) => setRfqId(event.target.value)}
                >
                  <option value="">{t("generate.selectRfq")}</option>
                  {eligibleRfqs.map((rfq) => (
                    <option key={rfq.id} value={rfq.id}>
                      {rfq.rfqNumber} • {rfq.warehouse.code} • {rfq.status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("generate.technicalWeight")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={technicalWeight}
                  onChange={(event) => setTechnicalWeight(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("generate.financialWeight")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={financialWeight}
                  onChange={(event) => setFinancialWeight(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("generate.noteLabel")}</Label>
              <Textarea
                rows={2}
                value={createNote}
                onChange={(event) => setCreateNote(event.target.value)}
                placeholder={t("generate.notePlaceholder")}
              />
            </div>
            <Button onClick={() => void createStatement()} disabled={saving}>
              {saving ? t("generate.generating") : t("generate.generateButton")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("register.title")}</CardTitle>
          <CardDescription>{t("register.description")}</CardDescription>
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
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">{t("filters.allStatuses")}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {t(`statuses.${status}` as any)}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="">{t("filters.selectCs")}</option>
              {visibleStatements.map((statement) => (
                <option key={statement.id} value={statement.id}>
                  {statement.csNumber} • {statement.status}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
              {t("actions.refresh")}
            </Button>
          </div>

          {loading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}

          {!selectedStatement && !loading ? (
            <p className="text-sm text-muted-foreground">{t("noSelection")}</p>
          ) : null}

          {selectedStatement ? (
            <div className="space-y-4">
              <div className="rounded-md border p-4">
                <div className="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground">{t("detail.cs")}:</span>{" "}
                    {selectedStatement.csNumber}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("detail.rfq")}:</span>{" "}
                    {selectedStatement.rfq.rfqNumber}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("detail.warehouse")}:</span>{" "}
                    {selectedStatement.warehouse.name}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("detail.status")}:</span>{" "}
                    {t(`statuses.${selectedStatement.status}` as any)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("detail.generatedPo")}:</span>{" "}
                    {selectedStatement.generatedPurchaseOrder?.poNumber ?? t("labels.na")}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("detail.generated")}:</span>{" "}
                    {formatDate(selectedStatement.generatedAt, t("labels.na"))}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("detail.submitted")}:</span>{" "}
                    {formatDate(selectedStatement.submittedAt, t("labels.na"))}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("detail.managerApproved")}:</span>{" "}
                    {formatDate(selectedStatement.managerApprovedAt, t("labels.na"))}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("detail.finalApproved")}:</span>{" "}
                    {formatDate(selectedStatement.finalApprovedAt, t("labels.na"))}
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{t("scorecard.title")}</CardTitle>
                  <CardDescription>{t("scorecard.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label>{t("generate.technicalWeight")}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={technicalWeight}
                        onChange={(event) => setTechnicalWeight(event.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("generate.financialWeight")}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={financialWeight}
                        onChange={(event) => setFinancialWeight(event.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("scorecard.workflowNote")}</Label>
                      <Input
                        value={workflowNote}
                        onChange={(event) => setWorkflowNote(event.target.value)}
                        disabled={!canManage && !canApproveAny}
                        placeholder={t("scorecard.workflowNotePlaceholder")}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {selectedStatement.lines.map((line) => (
                      <div key={line.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="break-words font-medium">{line.supplier.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {line.supplier.code}
                            </div>
                          </div>
                          <div className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium">
                            {t("scorecard.rank")} {line.rank ?? "-"}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-md bg-muted/30 p-3 text-sm">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                              {t("scorecard.financial")}
                            </div>
                            <div className="mt-1 font-medium">
                              {Number(line.financialScore || 0).toFixed(2)}
                            </div>
                          </div>
                          <div className="rounded-md bg-muted/30 p-3 text-sm">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                              {t("scorecard.combined")}
                            </div>
                            <div className="mt-1 font-medium">
                              {Number(line.combinedScore || 0).toFixed(4)}
                            </div>
                          </div>
                          <div className="rounded-md bg-muted/30 p-3 text-sm sm:col-span-2">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                              {t("scorecard.grandTotal")}
                            </div>
                            <div className="mt-1 break-words font-medium">
                              {formatMoney(line.financialGrandTotal)} {line.currency}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              checked={scorecardDraft[line.id]?.isResponsive ?? line.isResponsive}
                              disabled={!canManage}
                              onChange={(event) =>
                                updateScoreLine(line.id, {
                                  isResponsive: event.target.checked,
                                })
                              }
                            />
                            {t("scorecard.responsive")}
                          </label>

                          <div className="space-y-2">
                            <Label htmlFor={`technical-score-${line.id}`}>
                              {t("scorecard.technicalScore")}
                            </Label>
                            <Input
                              id={`technical-score-${line.id}`}
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={
                                scorecardDraft[line.id]?.technicalScore ??
                                line.technicalScore
                              }
                              disabled={!canManage}
                              onChange={(event) =>
                                updateScoreLine(line.id, {
                                  technicalScore: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`technical-note-${line.id}`}>
                              {t("scorecard.technicalNote")}
                            </Label>
                            <Input
                              id={`technical-note-${line.id}`}
                              value={scorecardDraft[line.id]?.technicalNote ?? ""}
                              disabled={!canManage}
                              onChange={(event) =>
                                updateScoreLine(line.id, {
                                  technicalNote: event.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <Table className="min-w-[920px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("table.rank")}</TableHead>
                          <TableHead>{t("table.supplier")}</TableHead>
                          <TableHead>{t("table.responsive")}</TableHead>
                          <TableHead>{t("table.technical")}</TableHead>
                          <TableHead>{t("table.financial")}</TableHead>
                          <TableHead>{t("table.combined")}</TableHead>
                          <TableHead>{t("table.grandTotal")}</TableHead>
                          <TableHead>{t("table.technicalNote")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedStatement.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>{line.rank ?? "-"}</TableCell>
                            <TableCell className="min-w-[180px]">
                              <div className="font-medium">{line.supplier.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {line.supplier.code}
                              </div>
                            </TableCell>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={scorecardDraft[line.id]?.isResponsive ?? line.isResponsive}
                                disabled={!canManage}
                                onChange={(event) =>
                                  updateScoreLine(line.id, {
                                    isResponsive: event.target.checked,
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell className="min-w-[140px]">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={
                                  scorecardDraft[line.id]?.technicalScore ??
                                  line.technicalScore
                                }
                                disabled={!canManage}
                                onChange={(event) =>
                                  updateScoreLine(line.id, {
                                    technicalScore: event.target.value,
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell>{Number(line.financialScore || 0).toFixed(2)}</TableCell>
                            <TableCell>{Number(line.combinedScore || 0).toFixed(4)}</TableCell>
                            <TableCell className="min-w-[150px]">
                              {formatMoney(line.financialGrandTotal)} {line.currency}
                            </TableCell>
                            <TableCell className="min-w-[220px]">
                              <Input
                                value={scorecardDraft[line.id]?.technicalNote ?? ""}
                                disabled={!canManage}
                                onChange={(event) =>
                                  updateScoreLine(line.id, {
                                    technicalNote: event.target.value,
                                  })
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {canManage &&
                  !["FINAL_APPROVED", "CANCELLED"].includes(selectedStatement.status) ? (
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => void saveScorecard()}
                      disabled={saving}
                    >
                      {saving ? t("scorecard.saving") : t("scorecard.saveButton")}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("workflow.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {canManage && selectedStatement.status === "DRAFT" ? (
                      <Button onClick={() => void runAction("submit")} disabled={saving}>
                        {t("workflow.submit")}
                      </Button>
                    ) : null}
                    {canApproveManager && selectedStatement.status === "SUBMITTED" ? (
                      <Button onClick={() => void runAction("manager_approve")} disabled={saving}>
                        {t("workflow.managerApprove")}
                      </Button>
                    ) : null}
                    {canApproveCommittee &&
                    selectedStatement.status === "MANAGER_APPROVED" ? (
                      <Button
                        onClick={() => void runAction("committee_approve")}
                        disabled={saving}
                      >
                        {t("workflow.committeeApprove")}
                      </Button>
                    ) : null}
                    {canApproveFinal &&
                    selectedStatement.status === "COMMITTEE_APPROVED" ? (
                      <Button onClick={() => void runAction("final_approve")} disabled={saving}>
                        {t("workflow.finalApprove")}
                      </Button>
                    ) : null}
                    {canGeneratePo &&
                    selectedStatement.status === "FINAL_APPROVED" &&
                    !selectedStatement.generatedPurchaseOrder ? (
                      <Button onClick={() => void runAction("generate_po")} disabled={saving}>
                        {t("workflow.generatePo")}
                      </Button>
                    ) : null}
                    {(canManage || canApproveAny) &&
                    ["SUBMITTED", "MANAGER_APPROVED", "COMMITTEE_APPROVED"].includes(
                      selectedStatement.status,
                    ) ? (
                      <Button
                        variant="destructive"
                        onClick={() => void runAction("reject")}
                        disabled={saving}
                      >
                        {t("workflow.reject")}
                      </Button>
                    ) : null}
                    {canManage &&
                    ["DRAFT", "SUBMITTED"].includes(selectedStatement.status) ? (
                      <Button
                        variant="outline"
                        onClick={() => void runAction("cancel")}
                        disabled={saving}
                      >
                        {t("workflow.cancel")}
                      </Button>
                    ) : null}
                  </div>

                  <div className="space-y-2 rounded-md border p-3">
                    <div className="text-sm font-medium">{t("workflow.trailTitle")}</div>
                    {selectedStatement.approvalEvents.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        {t("workflow.noEvents")}
                      </div>
                    ) : (
                      selectedStatement.approvalEvents.map((event) => (
                        <div key={event.id} className="text-xs text-muted-foreground">
                          {formatDate(event.actedAt, t("labels.na"))} • {event.stage} •{" "}
                          {event.decision} •{" "}
                          {event.actedBy?.name || event.actedBy?.email || t("workflow.unknown")}{" "}
                          • {event.note || t("workflow.noNote")}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}