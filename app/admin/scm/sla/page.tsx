"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  TrendingUp,
  TrendingDown,
  Eye,
  Edit,
  Save,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type Supplier = {
  id: number;
  name: string;
  code: string;
};

type SlaPolicy = {
  id: number;
  supplierId: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  evaluationWindowDays: number;
  minTrackedPoCount: number;
  targetLeadTimeDays: number;
  minimumOnTimeRate: number | string;
  minimumFillRate: number | string;
  maxOpenLatePoCount: number;
  autoEvaluationEnabled: boolean;
  warningActionDueDays: number;
  breachActionDueDays: number;
  terminationClauseEnabled: boolean;
  terminationLookbackDays: number;
  terminationMinBreachCount: number;
  terminationMinCriticalCount: number;
  terminationRecommendedAction:
    | "WATCHLIST"
    | "SUSPEND_NEW_PO"
    | "REVIEW_CONTRACT"
    | "TERMINATE_RELATIONSHIP";
  terminationNote: string | null;
  note: string | null;
  financialRule: {
    id: number;
    isActive: boolean;
    holdPaymentsOnThreeWayVariance: boolean;
    holdPaymentsOnOpenSlaAction: boolean;
    allowPaymentHoldOverride: boolean;
    autoCreditRecommendationEnabled: boolean;
    autoApplyRecommendedCredit: boolean;
    autoApplyRequireMatchedInvoice: boolean;
    autoApplyBlockOnOpenDispute: boolean;
    warningPenaltyRatePercent: number | string;
    breachPenaltyRatePercent: number | string;
    criticalPenaltyRatePercent: number | string;
    minBreachCountForCredit: number;
    autoApplyMaxAmount: number | string | null;
    maxCreditCapAmount: number | string | null;
    note: string | null;
  } | null;
  supplier: {
    id: number;
    name: string;
    code: string;
    isActive: boolean;
    leadTimeDays: number | null;
    paymentTermsDays: number | null;
  };
};

type SlaBreach = {
  id: number;
  supplierSlaPolicyId: number;
  supplierId: number;
  evaluationDate: string;
  periodStart: string;
  periodEnd: string;
  trackedPoCount: number;
  completedPoCount: number;
  openLatePoCount: number;
  breachCount: number;
  status: "OK" | "WARNING" | "BREACH";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  observedLeadTimeDays: number | string | null;
  onTimeRatePercent: number | string | null;
  fillRatePercent: number | string | null;
  actionStatus:
    | "NOT_REQUIRED"
    | "OPEN"
    | "IN_PROGRESS"
    | "RESOLVED"
    | "DISMISSED";
  ownerUserId: string | null;
  dueDate: string | null;
  startedAt: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  resolutionNote: string | null;
  alertTriggeredAt: string | null;
  alertMessage: string | null;
  alertAcknowledgedAt: string | null;
  disputeStatus: "NONE" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  disputeReason: string | null;
  disputeRaisedAt: string | null;
  disputeRaisedById: string | null;
  disputeResolutionNote: string | null;
  disputeResolvedAt: string | null;
  disputeResolvedById: string | null;
  terminationCaseId: number | null;
  terminationSuggestedAt: string | null;
  terminationSuggestionNote: string | null;
  issues: unknown;
  supplier: {
    id: number;
    name: string;
    code: string;
  };
  policy: {
    id: number;
    targetLeadTimeDays: number;
    minimumOnTimeRate: number | string;
    minimumFillRate: number | string;
    maxOpenLatePoCount: number;
    minTrackedPoCount: number;
    evaluationWindowDays: number;
    isActive: boolean;
  };
  evaluatedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  owner: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  resolvedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  disputeRaisedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  disputeResolvedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  terminationCase: {
    id: number;
    status: "OPEN" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "EXECUTED";
    recommendedAction:
      | "WATCHLIST"
      | "SUSPEND_NEW_PO"
      | "REVIEW_CONTRACT"
      | "TERMINATE_RELATIONSHIP";
    openBreachCount: number;
    criticalBreachCount: number;
    lookbackDays: number;
    reason: string;
    ownerUserId: string | null;
    reviewedAt: string | null;
    resolvedAt: string | null;
    resolvedById: string | null;
    resolutionNote: string | null;
    owner: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  } | null;
};

type TerminationCase = {
  id: number;
  supplierId: number;
  supplierSlaPolicyId: number;
  triggerBreachId: number | null;
  status: "OPEN" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "EXECUTED";
  recommendedAction:
    | "WATCHLIST"
    | "SUSPEND_NEW_PO"
    | "REVIEW_CONTRACT"
    | "TERMINATE_RELATIONSHIP";
  openBreachCount: number;
  criticalBreachCount: number;
  lookbackDays: number;
  reason: string;
  ownerUserId: string | null;
  reviewedAt: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  resolutionNote: string | null;
  createdAt: string;
  supplier: {
    id: number;
    name: string;
    code: string;
  };
  owner: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type SlaAnalytics = {
  range: {
    from: string;
    to: string;
    days: number;
    supplierId: number | null;
  };
  summary: {
    totalEvaluations: number;
    warningCount: number;
    breachCount: number;
    criticalBreachCount: number;
    openActionCount: number;
    overdueActionCount: number;
    openDisputeCount: number;
    openTerminationCaseCount: number;
    heldInvoiceCount: number;
    overriddenInvoiceCount: number;
    recommendedCreditAmount: string;
    appliedCreditAmount: string;
    autoAppliedCreditAmount: string;
    manualAppliedCreditAmount: string;
    waivedCreditCount: number;
    notificationEventCount: number;
  };
  trends: Array<{
    date: string;
    OK: number;
    WARNING: number;
    BREACH: number;
  }>;
  topSuppliers: Array<{
    supplierId: number;
    supplierName: string;
    supplierCode: string;
    evaluations: number;
    warningCount: number;
    breachCount: number;
    criticalCount: number;
    openActions: number;
    openDisputes: number;
    lastEvaluationAt: string | null;
  }>;
  recentNotificationEvents: Array<{
    id: string;
    action: string;
    entity: string;
    createdAt: string;
  }>;
};

type SlaOwner = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  userRoles: Array<{
    scopeType: string;
    warehouseId: number | null;
    role: {
      id: string;
      name: string;
      label: string;
    };
  }>;
};

type SlaFormState = {
  supplierId: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  evaluationWindowDays: string;
  minTrackedPoCount: string;
  targetLeadTimeDays: string;
  minimumOnTimeRate: string;
  minimumFillRate: string;
  maxOpenLatePoCount: string;
  autoEvaluationEnabled: boolean;
  warningActionDueDays: string;
  breachActionDueDays: string;
  terminationClauseEnabled: boolean;
  terminationLookbackDays: string;
  terminationMinBreachCount: string;
  terminationMinCriticalCount: string;
  terminationRecommendedAction:
    | "WATCHLIST"
    | "SUSPEND_NEW_PO"
    | "REVIEW_CONTRACT"
    | "TERMINATE_RELATIONSHIP";
  terminationNote: string;
  financialRuleActive: boolean;
  holdPaymentsOnThreeWayVariance: boolean;
  holdPaymentsOnOpenSlaAction: boolean;
  allowPaymentHoldOverride: boolean;
  autoCreditRecommendationEnabled: boolean;
  autoApplyRecommendedCredit: boolean;
  autoApplyRequireMatchedInvoice: boolean;
  autoApplyBlockOnOpenDispute: boolean;
  warningPenaltyRatePercent: string;
  breachPenaltyRatePercent: string;
  criticalPenaltyRatePercent: string;
  minBreachCountForCredit: string;
  autoApplyMaxAmount: string;
  maxCreditCapAmount: string;
  financialRuleNote: string;
  note: string;
};

type BreachActionDraft = {
  ownerUserId: string;
  dueDate: string;
  actionStatus: SlaBreach["actionStatus"];
  resolutionNote: string;
  acknowledgeAlert: boolean;
  disputeStatus: SlaBreach["disputeStatus"];
  disputeReason: string;
  disputeResolutionNote: string;
};

type TerminationDraft = {
  ownerUserId: string;
  status: TerminationCase["status"];
  recommendedAction: TerminationCase["recommendedAction"];
  resolutionNote: string;
  markReviewed: boolean;
};

const DEFAULT_FORM: SlaFormState = {
  supplierId: "",
  isActive: true,
  effectiveFrom: "",
  effectiveTo: "",
  evaluationWindowDays: "90",
  minTrackedPoCount: "3",
  targetLeadTimeDays: "7",
  minimumOnTimeRate: "90",
  minimumFillRate: "95",
  maxOpenLatePoCount: "0",
  autoEvaluationEnabled: true,
  warningActionDueDays: "7",
  breachActionDueDays: "3",
  terminationClauseEnabled: false,
  terminationLookbackDays: "180",
  terminationMinBreachCount: "3",
  terminationMinCriticalCount: "1",
  terminationRecommendedAction: "REVIEW_CONTRACT",
  terminationNote: "",
  financialRuleActive: true,
  holdPaymentsOnThreeWayVariance: true,
  holdPaymentsOnOpenSlaAction: true,
  allowPaymentHoldOverride: true,
  autoCreditRecommendationEnabled: true,
  autoApplyRecommendedCredit: false,
  autoApplyRequireMatchedInvoice: true,
  autoApplyBlockOnOpenDispute: true,
  warningPenaltyRatePercent: "0",
  breachPenaltyRatePercent: "2",
  criticalPenaltyRatePercent: "5",
  minBreachCountForCredit: "1",
  autoApplyMaxAmount: "",
  maxCreditCapAmount: "",
  financialRuleNote: "",
  note: "",
};

async function readJson<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || fallbackMessage);
  }
  return data as T;
}

function fmtDate(value: string | null, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale);
}

function fmtValue(value: number | string | null, suffix = "") {
  if (value === null || value === "") return "-";
  return `${value}${suffix}`;
}

function getStatusVariant(status: SlaBreach["status"]) {
  if (status === "OK") return "bg-success/10 text-success border-success/20";
  if (status === "WARNING")
    return "bg-warning/10 text-warning border-warning/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

function getSeverityVariant(severity: SlaBreach["severity"]) {
  if (severity === "LOW") return "bg-info/10 text-info border-info/20";
  if (severity === "MEDIUM")
    return "bg-warning/10 text-warning border-warning/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

function getActionVariant(status: SlaBreach["actionStatus"]) {
  if (status === "NOT_REQUIRED") return "bg-muted text-muted-foreground";
  if (status === "OPEN") return "bg-warning/10 text-warning";
  if (status === "IN_PROGRESS") return "bg-info/10 text-info";
  return "bg-success/10 text-success";
}

// Pagination Component
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("AdminSla");

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

// SLA Policy Modal Component
function SlaPolicyModal({
  open,
  onOpenChange,
  editingId,
  form,
  suppliers,
  onFormChange,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: number | null;
  form: SlaFormState;
  suppliers: Supplier[];
  onFormChange: (updates: Partial<SlaFormState>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const t = useTranslations("AdminSla");

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {editingId ? t("modal.editTitle") : t("modal.createTitle")}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {t("modal.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Basic Info Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fields.supplierRequired")}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.supplierId}
                onChange={(event) =>
                  onFormChange({ supplierId: event.target.value })
                }
              >
                <option value="">{t("options.selectSupplier")}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} ({supplier.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fields.evaluationWindowDays")}</Label>
              <Input
                type="number"
                min={7}
                max={730}
                value={form.evaluationWindowDays}
                onChange={(event) =>
                  onFormChange({ evaluationWindowDays: event.target.value })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fields.minTrackedPos")}</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.minTrackedPoCount}
                onChange={(event) =>
                  onFormChange({ minTrackedPoCount: event.target.value })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fields.targetLeadTimeDays")}</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={form.targetLeadTimeDays}
                onChange={(event) =>
                  onFormChange({ targetLeadTimeDays: event.target.value })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fields.minOnTimeRate")}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.minimumOnTimeRate}
                onChange={(event) =>
                  onFormChange({ minimumOnTimeRate: event.target.value })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fields.minFillRate")}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.minimumFillRate}
                onChange={(event) =>
                  onFormChange({ minimumFillRate: event.target.value })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fields.maxOpenLatePos")}</Label>
              <Input
                type="number"
                min={0}
                max={999}
                value={form.maxOpenLatePoCount}
                onChange={(event) =>
                  onFormChange({ maxOpenLatePoCount: event.target.value })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fields.warningDueDays")}</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={form.warningActionDueDays}
                onChange={(event) =>
                  onFormChange({ warningActionDueDays: event.target.value })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fields.breachDueDays")}</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={form.breachActionDueDays}
                onChange={(event) =>
                  onFormChange({ breachActionDueDays: event.target.value })
                }
                className="text-sm"
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fields.effectiveFrom")}</Label>
              <Input
                type="date"
                value={form.effectiveFrom}
                onChange={(event) =>
                  onFormChange({ effectiveFrom: event.target.value })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fields.effectiveTo")}</Label>
              <Input
                type="date"
                value={form.effectiveTo}
                onChange={(event) =>
                  onFormChange({ effectiveTo: event.target.value })
                }
                className="text-sm"
              />
            </div>
          </div>

          {/* Policy Controls */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <Label className="text-sm font-medium">{t("policyControls.title")}</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    onFormChange({ isActive: event.target.checked })
                  }
                  className="rounded border-border"
                />
                {t("policyControls.active")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.autoEvaluationEnabled}
                  onChange={(event) =>
                    onFormChange({
                      autoEvaluationEnabled: event.target.checked,
                    })
                  }
                  className="rounded border-border"
                />
                {t("policyControls.autoDailyEvaluation")}
              </label>
            </div>
          </div>

          {/* Termination Clause */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.terminationClauseEnabled}
                onChange={(event) =>
                  onFormChange({
                    terminationClauseEnabled: event.target.checked,
                  })
                }
                className="rounded border-border"
              />
              {t("terminationClause.enable")}
            </label>

            {form.terminationClauseEnabled && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("fields.lookbackDays")}</Label>
                  <Input
                    type="number"
                    min={30}
                    max={730}
                    value={form.terminationLookbackDays}
                    onChange={(event) =>
                      onFormChange({
                        terminationLookbackDays: event.target.value,
                      })
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("fields.minBreachCount")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={form.terminationMinBreachCount}
                    onChange={(event) =>
                      onFormChange({
                        terminationMinBreachCount: event.target.value,
                      })
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("fields.minCriticalCount")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={form.terminationMinCriticalCount}
                    onChange={(event) =>
                      onFormChange({
                        terminationMinCriticalCount: event.target.value,
                      })
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("fields.recommendedAction")}</Label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={form.terminationRecommendedAction}
                    onChange={(event) =>
                      onFormChange({
                        terminationRecommendedAction: event.target.value as any,
                      })
                    }
                  >
                    <option value="WATCHLIST">{t("terminationActions.WATCHLIST")}</option>
                    <option value="SUSPEND_NEW_PO">{t("terminationActions.SUSPEND_NEW_PO")}</option>
                    <option value="REVIEW_CONTRACT">{t("terminationActions.REVIEW_CONTRACT")}</option>
                    <option value="TERMINATE_RELATIONSHIP">
                      {t("terminationActions.TERMINATE_RELATIONSHIP")}
                    </option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* AP Financial Controls */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div>
              <Label className="text-sm font-medium">
                {t("financialControls.title")}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("financialControls.description")}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.financialRuleActive}
                  onChange={(event) =>
                    onFormChange({ financialRuleActive: event.target.checked })
                  }
                />
                {t("financialControls.active")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.holdPaymentsOnThreeWayVariance}
                  onChange={(event) =>
                    onFormChange({
                      holdPaymentsOnThreeWayVariance: event.target.checked,
                    })
                  }
                />
                {t("financialControls.holdOnThreeWayVariance")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.holdPaymentsOnOpenSlaAction}
                  onChange={(event) =>
                    onFormChange({
                      holdPaymentsOnOpenSlaAction: event.target.checked,
                    })
                  }
                />
                {t("financialControls.holdOnOpenAction")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allowPaymentHoldOverride}
                  onChange={(event) =>
                    onFormChange({
                      allowPaymentHoldOverride: event.target.checked,
                    })
                  }
                />
                {t("financialControls.allowOverride")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.autoCreditRecommendationEnabled}
                  onChange={(event) =>
                    onFormChange({
                      autoCreditRecommendationEnabled: event.target.checked,
                    })
                  }
                />
                {t("financialControls.autoCreditRecommendation")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.autoApplyRecommendedCredit}
                  onChange={(event) =>
                    onFormChange({
                      autoApplyRecommendedCredit: event.target.checked,
                    })
                  }
                />
                {t("financialControls.autoApplyCredit")}
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("fields.warningPenalty")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.warningPenaltyRatePercent}
                  onChange={(event) =>
                    onFormChange({
                      warningPenaltyRatePercent: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("fields.breachPenalty")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.breachPenaltyRatePercent}
                  onChange={(event) =>
                    onFormChange({
                      breachPenaltyRatePercent: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("fields.criticalPenalty")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.criticalPenaltyRatePercent}
                  onChange={(event) =>
                    onFormChange({
                      criticalPenaltyRatePercent: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("fields.maxCreditCap")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.maxCreditCapAmount}
                  onChange={(event) =>
                    onFormChange({ maxCreditCapAmount: event.target.value })
                  }
                  placeholder={t("common.optional")}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fields.policyNote")}</Label>
              <Textarea
                rows={2}
                value={form.note}
                onChange={(event) => onFormChange({ note: event.target.value })}
                placeholder={t("placeholders.policyNote")}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fields.terminationNote")}</Label>
              <Textarea
                rows={2}
                value={form.terminationNote}
                onChange={(event) =>
                  onFormChange({ terminationNote: event.target.value })
                }
                placeholder={t("placeholders.terminationNote")}
                className="text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving
              ? t("common.saving")
              : editingId
                ? t("actions.updatePolicy")
                : t("actions.createPolicy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SupplierSlaPage() {
  const locale = useLocale();
  const t = useTranslations("AdminSla");
  const { data: session } = useSession();
  const globalPermissions = Array.isArray(
    (session?.user as any)?.globalPermissions,
  )
    ? ((session?.user as any).globalPermissions as string[])
    : [];

  const canRead = globalPermissions.some((permission) =>
    ["sla.read", "sla.manage"].includes(permission),
  );
  const canManage = globalPermissions.includes("sla.manage");
  const canManageNotifications =
    globalPermissions.includes("sla.manage") ||
    globalPermissions.includes("sla.notifications.manage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [actionSavingId, setActionSavingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [editingPolicyId, setEditingPolicyId] = useState<number | null>(null);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [owners, setOwners] = useState<SlaOwner[]>([]);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [breaches, setBreaches] = useState<SlaBreach[]>([]);
  const [terminationCases, setTerminationCases] = useState<TerminationCase[]>(
    [],
  );
  const [analytics, setAnalytics] = useState<SlaAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState("90");
  const [notifying, setNotifying] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedBreach, setExpandedBreach] = useState<number | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [form, setForm] = useState<SlaFormState>(DEFAULT_FORM);

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const response = await fetch(
        `/api/scm/sla/analytics?days=${Number(analyticsDays) || 90}`,
        {
          cache: "no-store",
        },
      );
      const data = await readJson<SlaAnalytics>(
        response,
        t("errors.loadAnalytics"),
      );
      setAnalytics(data);
    } catch (error: any) {
      toast.error(error?.message || t("errors.loadAnalytics"));
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setAnalyticsLoading(true);
      const responses = await Promise.all([
        fetch("/api/scm/suppliers", { cache: "no-store" }),
        fetch("/api/scm/sla/policies?includeInactive=1", { cache: "no-store" }),
        fetch("/api/scm/sla/breaches?latest=1&days=365", { cache: "no-store" }),
        fetch("/api/scm/sla/termination-cases?limit=200", {
          cache: "no-store",
        }),
        fetch(`/api/scm/sla/analytics?days=${Number(analyticsDays) || 90}`, {
          cache: "no-store",
        }),
        canManage
          ? fetch("/api/scm/sla/owners", { cache: "no-store" })
          : Promise.resolve(null),
      ]);

      const [
        supplierRes,
        policyRes,
        breachRes,
        terminationRes,
        analyticsRes,
        ownerRes,
      ] = responses;

      const supplierData = await readJson<Supplier[]>(
        supplierRes,
        t("errors.loadSuppliers"),
      );
      const policyData = await readJson<SlaPolicy[]>(
        policyRes,
        t("errors.loadPolicies"),
      );
      const breachData = await readJson<SlaBreach[]>(
        breachRes,
        t("errors.loadBreaches"),
      );
      const terminationData = await readJson<TerminationCase[]>(
        terminationRes,
        t("errors.loadTerminationCases"),
      );
      const analyticsData = await readJson<SlaAnalytics>(
        analyticsRes,
        t("errors.loadAnalytics"),
      );
      const ownerData = ownerRes
        ? await readJson<SlaOwner[]>(ownerRes, t("errors.loadOwners"))
        : [];

      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setPolicies(Array.isArray(policyData) ? policyData : []);
      setBreaches(Array.isArray(breachData) ? breachData : []);
      setTerminationCases(
        Array.isArray(terminationData) ? terminationData : [],
      );
      setAnalytics(analyticsData || null);
      setOwners(Array.isArray(ownerData) ? ownerData : []);
    } catch (error: any) {
      toast.error(error?.message || t("errors.loadWorkspace"));
      setPolicies([]);
      setBreaches([]);
      setTerminationCases([]);
      setAnalytics(null);
      setOwners([]);
    } finally {
      setLoading(false);
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) {
      void loadData();
    }
  }, [canRead, analyticsDays]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const visibleBreaches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return breaches.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!query) return true;
      return (
        row.supplier.name.toLowerCase().includes(query) ||
        row.supplier.code.toLowerCase().includes(query)
      );
    });
  }, [breaches, search, statusFilter]);

  const paginatedBreaches = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return visibleBreaches.slice(start, end);
  }, [visibleBreaches, currentPage]);

  const totalBreachPages = Math.ceil(visibleBreaches.length / itemsPerPage);

  const submitPolicy = async () => {
    if (!canManage) return;
    if (!form.supplierId) {
      toast.error(t("errors.supplierRequired"));
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/scm/sla/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: Number(form.supplierId),
          isActive: form.isActive,
          effectiveFrom: form.effectiveFrom || null,
          effectiveTo: form.effectiveTo || null,
          evaluationWindowDays: Number(form.evaluationWindowDays),
          minTrackedPoCount: Number(form.minTrackedPoCount),
          targetLeadTimeDays: Number(form.targetLeadTimeDays),
          minimumOnTimeRate: Number(form.minimumOnTimeRate),
          minimumFillRate: Number(form.minimumFillRate),
          maxOpenLatePoCount: Number(form.maxOpenLatePoCount),
          autoEvaluationEnabled: form.autoEvaluationEnabled,
          warningActionDueDays: Number(form.warningActionDueDays),
          breachActionDueDays: Number(form.breachActionDueDays),
          terminationClauseEnabled: form.terminationClauseEnabled,
          terminationLookbackDays: Number(form.terminationLookbackDays),
          terminationMinBreachCount: Number(form.terminationMinBreachCount),
          terminationMinCriticalCount: Number(form.terminationMinCriticalCount),
          terminationRecommendedAction: form.terminationRecommendedAction,
          terminationNote: form.terminationNote || null,
          financialRuleActive: form.financialRuleActive,
          holdPaymentsOnThreeWayVariance: form.holdPaymentsOnThreeWayVariance,
          holdPaymentsOnOpenSlaAction: form.holdPaymentsOnOpenSlaAction,
          allowPaymentHoldOverride: form.allowPaymentHoldOverride,
          autoCreditRecommendationEnabled: form.autoCreditRecommendationEnabled,
          autoApplyRecommendedCredit: form.autoApplyRecommendedCredit,
          autoApplyRequireMatchedInvoice: form.autoApplyRequireMatchedInvoice,
          autoApplyBlockOnOpenDispute: form.autoApplyBlockOnOpenDispute,
          warningPenaltyRatePercent: Number(form.warningPenaltyRatePercent),
          breachPenaltyRatePercent: Number(form.breachPenaltyRatePercent),
          criticalPenaltyRatePercent: Number(form.criticalPenaltyRatePercent),
          minBreachCountForCredit: Number(form.minBreachCountForCredit),
          autoApplyMaxAmount: form.autoApplyMaxAmount
            ? Number(form.autoApplyMaxAmount)
            : null,
          maxCreditCapAmount: form.maxCreditCapAmount
            ? Number(form.maxCreditCapAmount)
            : null,
          financialRuleNote: form.financialRuleNote || null,
          note: form.note || null,
        }),
      });

      await readJson<SlaPolicy>(response, t("errors.savePolicy"));
      toast.success(
        editingPolicyId
          ? t("success.policyUpdated")
          : t("success.policyCreated"),
      );
      setEditingPolicyId(null);
      setForm(DEFAULT_FORM);
      setPolicyModalOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || t("errors.savePolicy"));
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    setEditingPolicyId(null);
    setForm(DEFAULT_FORM);
    setPolicyModalOpen(true);
  };

  const openEditModal = (policy: SlaPolicy) => {
    setEditingPolicyId(policy.id);
    setForm({
      supplierId: String(policy.supplierId),
      isActive: policy.isActive,
      effectiveFrom: policy.effectiveFrom
        ? policy.effectiveFrom.slice(0, 10)
        : "",
      effectiveTo: policy.effectiveTo ? policy.effectiveTo.slice(0, 10) : "",
      evaluationWindowDays: String(policy.evaluationWindowDays),
      minTrackedPoCount: String(policy.minTrackedPoCount),
      targetLeadTimeDays: String(policy.targetLeadTimeDays),
      minimumOnTimeRate: String(policy.minimumOnTimeRate),
      minimumFillRate: String(policy.minimumFillRate),
      maxOpenLatePoCount: String(policy.maxOpenLatePoCount),
      autoEvaluationEnabled: policy.autoEvaluationEnabled,
      warningActionDueDays: String(policy.warningActionDueDays),
      breachActionDueDays: String(policy.breachActionDueDays),
      terminationClauseEnabled: policy.terminationClauseEnabled ?? false,
      terminationLookbackDays: String(policy.terminationLookbackDays ?? 180),
      terminationMinBreachCount: String(policy.terminationMinBreachCount ?? 3),
      terminationMinCriticalCount: String(
        policy.terminationMinCriticalCount ?? 1,
      ),
      terminationRecommendedAction:
        policy.terminationRecommendedAction ?? "REVIEW_CONTRACT",
      terminationNote: policy.terminationNote || "",
      financialRuleActive: policy.financialRule?.isActive ?? true,
      holdPaymentsOnThreeWayVariance:
        policy.financialRule?.holdPaymentsOnThreeWayVariance ?? true,
      holdPaymentsOnOpenSlaAction:
        policy.financialRule?.holdPaymentsOnOpenSlaAction ?? true,
      allowPaymentHoldOverride:
        policy.financialRule?.allowPaymentHoldOverride ?? true,
      autoCreditRecommendationEnabled:
        policy.financialRule?.autoCreditRecommendationEnabled ?? true,
      autoApplyRecommendedCredit:
        policy.financialRule?.autoApplyRecommendedCredit ?? false,
      autoApplyRequireMatchedInvoice:
        policy.financialRule?.autoApplyRequireMatchedInvoice ?? true,
      autoApplyBlockOnOpenDispute:
        policy.financialRule?.autoApplyBlockOnOpenDispute ?? true,
      warningPenaltyRatePercent: String(
        policy.financialRule?.warningPenaltyRatePercent ?? 0,
      ),
      breachPenaltyRatePercent: String(
        policy.financialRule?.breachPenaltyRatePercent ?? 2,
      ),
      criticalPenaltyRatePercent: String(
        policy.financialRule?.criticalPenaltyRatePercent ?? 5,
      ),
      minBreachCountForCredit: String(
        policy.financialRule?.minBreachCountForCredit ?? 1,
      ),
      autoApplyMaxAmount:
        policy.financialRule?.autoApplyMaxAmount == null
          ? ""
          : String(policy.financialRule.autoApplyMaxAmount),
      maxCreditCapAmount:
        policy.financialRule?.maxCreditCapAmount == null
          ? ""
          : String(policy.financialRule.maxCreditCapAmount),
      financialRuleNote: policy.financialRule?.note || "",
      note: policy.note || "",
    });
    setPolicyModalOpen(true);
  };

  const runEvaluation = async (supplierId?: number) => {
    if (!canManage) return;
    try {
      setRunning(true);
      const response = await fetch("/api/scm/sla/breaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierId ? { supplierId } : {}),
      });
      const data = await readJson<{ count: number }>(
        response,
        t("errors.runEvaluation"),
      );
      toast.success(t("success.evaluationCompleted", { count: data.count }));
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || t("errors.runEvaluation"));
    } finally {
      setRunning(false);
    }
  };

  const runNotifications = async () => {
    if (!canManageNotifications) return;
    try {
      setNotifying(true);
      const response = await fetch("/api/scm/sla/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: false,
          dueInHours: 24,
          includeTermination: true,
          maxItems: 120,
        }),
      });
      const result = await readJson<{
        processedCount: number;
        emailedCount: number;
        webhookCount: number;
        errors: string[];
      }>(response, t("errors.runNotifications"));
      if (Array.isArray(result.errors) && result.errors.length > 0) {
        toast.warning(
          t("success.notificationsWithErrors", {
            processed: result.processedCount,
            errors: result.errors.length,
          }),
        );
      } else {
        toast.success(
          t("success.notificationsSent", {
            processed: result.processedCount,
            email: result.emailedCount,
            webhook: result.webhookCount,
          }),
        );
      }
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || t("errors.runNotifications"));
    } finally {
      setNotifying(false);
    }
  };

  if (!canRead) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">
              {t("access.forbiddenTitle")}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t("access.forbiddenDescription")}
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
            {t("header.title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            {t("header.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
            value={analyticsDays}
            onChange={(event) => setAnalyticsDays(event.target.value)}
          >
            <option value="30">{t("timeRanges.days", { count: 30 })}</option>
            <option value="60">{t("timeRanges.days", { count: 60 })}</option>
            <option value="90">{t("timeRanges.days", { count: 90 })}</option>
            <option value="180">{t("timeRanges.days", { count: 180 })}</option>
            <option value="365">{t("timeRanges.days", { count: 365 })}</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadAnalytics()}
            disabled={analyticsLoading}
          >
            {t("actions.refreshAnalytics")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
            />
            {t("actions.refresh")}
          </Button>
          {canManageNotifications && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runNotifications()}
              disabled={notifying}
            >
              {notifying
                ? t("actions.notifying")
                : t("actions.runNotifications")}
            </Button>
          )}
          {canManage && (
            <Button onClick={openCreateModal} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t("actions.createPolicy")}
            </Button>
          )}
        </div>
      </div>

      {/* Analytics Section */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">
            {t("analytics.title")}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t("analytics.description", {
              days: analytics?.range.days || Number(analyticsDays) || 90,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
          {!analytics ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {analyticsLoading
                ? t("analytics.loading")
                : t("analytics.empty")}
            </p>
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("analytics.metrics.evaluations")}
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-foreground">
                    {analytics.summary.totalEvaluations}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("analytics.metrics.breaches")}
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-destructive">
                    {analytics.summary.breachCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("analytics.metrics.overdueActions")}
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-warning">
                    {analytics.summary.overdueActionCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("analytics.metrics.openDisputes")}
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-info">
                    {analytics.summary.openDisputeCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("analytics.metrics.terminationCases")}
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-destructive">
                    {analytics.summary.openTerminationCaseCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("analytics.metrics.appliedCredit")}
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-success">
                    {analytics.summary.appliedCreditAmount}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-medium text-foreground">
                    {t("analytics.trendSnapshot")}
                  </p>
                  <div className="space-y-1 text-xs">
                    {analytics.trends.slice(-7).map((row) => (
                      <div
                        key={row.date}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-muted-foreground">
                          {row.date}
                        </span>
                        <span className="text-muted-foreground">
                          <span className="text-success">
                            {t("analytics.abbreviations.ok", { count: row.OK })}
                          </span>{" "}
                          |
                          <span className="text-warning ml-1">
                            {t("analytics.abbreviations.warning", {
                              count: row.WARNING,
                            })}
                          </span>{" "}
                          |
                          <span className="text-destructive ml-1">
                            {t("analytics.abbreviations.breach", {
                              count: row.BREACH,
                            })}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-medium text-foreground">
                    {t("analytics.topRiskSuppliers")}
                  </p>
                  <div className="space-y-1 text-xs">
                    {analytics.topSuppliers.slice(0, 6).map((row) => (
                      <div
                        key={row.supplierId}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-foreground">
                          {row.supplierName} ({row.supplierCode})
                        </span>
                        <span className="text-muted-foreground">
                          <span className="text-destructive">
                            {t("analytics.abbreviations.breach", {
                              count: row.breachCount,
                            })}
                          </span>{" "}
                          |
                          <span className="text-warning ml-1">
                            {t("analytics.abbreviations.warning", {
                              count: row.warningCount,
                            })}
                          </span>{" "}
                          |
                          <span className="text-info ml-1">
                            {t("analytics.abbreviations.dispute", {
                              count: row.openDisputes,
                            })}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Policy Registry */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">
            {t("policyRegistry.title")}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t("policyRegistry.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : policies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {t("policyRegistry.empty")}
              </p>
              {canManage && (
                <Button
                  onClick={openCreateModal}
                  variant="outline"
                  className="mt-3"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("actions.createFirstPolicy")}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      {t("columns.supplier")}
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      {t("columns.leadTime")}
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      {t("columns.onTimePercent")}
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      {t("columns.fillPercent")}
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      {t("columns.latePo")}
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      {t("columns.window")}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      {t("columns.status")}
                    </TableHead>
                    {canManage && (
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">
                        {t("columns.actions")}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow
                      key={policy.id}
                      className="border-border hover:bg-muted/40"
                    >
                      <TableCell className="py-3">
                        <div className="font-medium text-sm text-foreground">
                          {policy.supplier.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {policy.supplier.code}
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-3 text-sm text-foreground">
                        {t("common.daysValue", {
                          count: policy.targetLeadTimeDays,
                        })}
                      </TableCell>
                      <TableCell className="text-right py-3 text-sm text-foreground">
                        {policy.minimumOnTimeRate}%
                      </TableCell>
                      <TableCell className="text-right py-3 text-sm text-foreground">
                        {policy.minimumFillRate}%
                      </TableCell>
                      <TableCell className="text-right py-3 text-sm text-foreground">
                        {policy.maxOpenLatePoCount}
                      </TableCell>
                      <TableCell className="text-right py-3 text-sm text-foreground">
                        {t("common.daysValue", {
                          count: policy.evaluationWindowDays,
                        })}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            policy.isActive
                              ? "bg-success/10 text-success"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {policy.isActive
                            ? t("policyStatuses.ACTIVE")
                            : t("policyStatuses.INACTIVE")}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditModal(policy)}
                              aria-label={t("actions.editSupplierPolicy", {
                                supplier: policy.supplier.name,
                              })}
                              title={t("actions.edit")}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                void runEvaluation(policy.supplierId)
                              }
                              disabled={running}
                            >
                              {t("actions.evaluate")}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breach Log */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">
                {t("breachLog.title")}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t("breachLog.description")}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:flex-initial">
                <Input
                  placeholder={t("filters.searchSupplier")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full sm:w-56 text-sm"
                />
              </div>
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">{t("filters.allStatuses")}</option>
                <option value="OK">{t("breachStatuses.OK")}</option>
                <option value="WARNING">{t("breachStatuses.WARNING")}</option>
                <option value="BREACH">{t("breachStatuses.BREACH")}</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="sm:hidden"
                aria-label={t("filters.toggle")}
                title={t("filters.toggle")}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : visibleBreaches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-8 w-8 text-success/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {t("breachLog.empty")}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        {t("columns.supplier")}
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        {t("columns.evaluated")}
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        {t("columns.status")}
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        {t("columns.severity")}
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">
                        {t("columns.breachCount")}
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">
                        {t("columns.observedLeadTime")}
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">
                        {t("columns.onTime")}
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">
                        {t("columns.fillRate")}
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        {t("columns.action")}
                      </TableHead>
                      {canManage && (
                        <TableHead className="text-xs font-medium text-muted-foreground">
                          {t("columns.workflow")}
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedBreaches.map((row) => (
                      <TableRow
                        key={row.id}
                        className="border-border hover:bg-muted/40"
                      >
                        <TableCell className="py-3">
                          <div className="font-medium text-sm text-foreground">
                            {row.supplier.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.supplier.code}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground">
                          {fmtDate(row.evaluationDate, locale)}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              getStatusVariant(row.status),
                            )}
                          >
                            {t(`breachStatuses.${row.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              getSeverityVariant(row.severity),
                            )}
                          >
                            {t(`severities.${row.severity}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-3 font-medium text-foreground">
                          {row.breachCount}
                        </TableCell>
                        <TableCell className="text-right py-3 text-sm">
                          {row.observedLeadTimeDays === null
                            ? "—"
                            : t("common.daysValue", {
                                count: Number(row.observedLeadTimeDays),
                              })}
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              getPerformanceColor(row.onTimeRatePercent),
                            )}
                          >
                            {fmtValue(row.onTimeRatePercent, "%")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-3 text-sm">
                          {fmtValue(row.fillRatePercent, "%")}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              getActionVariant(row.actionStatus),
                            )}
                          >
                            {t(`actionStatuses.${row.actionStatus}`)}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="py-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setExpandedBreach(
                                  expandedBreach === row.id ? null : row.id,
                                )
                              }
                              aria-label={t("actions.viewSupplierWorkflow", {
                                supplier: row.supplier.name,
                              })}
                              title={t("actions.viewWorkflow")}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="space-y-3 lg:hidden">
                {paginatedBreaches.map((row) => (
                  <Card key={row.id} className="border-border shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {row.supplier.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.supplier.code}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            getStatusVariant(row.status),
                          )}
                        >
                          {t(`breachStatuses.${row.status}`)}
                        </Badge>
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("columns.evaluated")}
                          </p>
                          <p className="text-sm text-foreground">
                            {fmtDate(row.evaluationDate, locale)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("columns.severity")}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs mt-1",
                              getSeverityVariant(row.severity),
                            )}
                          >
                            {t(`severities.${row.severity}`)}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("columns.breachCount")}
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            {row.breachCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("columns.observedLeadTime")}
                          </p>
                          <p className="text-sm">
                            {row.observedLeadTimeDays === null
                              ? "—"
                              : t("common.daysValue", {
                                  count: Number(row.observedLeadTimeDays),
                                })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("columns.onTime")}
                          </p>
                          <p
                            className={cn(
                              "text-sm font-medium",
                              getPerformanceColor(row.onTimeRatePercent),
                            )}
                          >
                            {fmtValue(row.onTimeRatePercent, "%")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("columns.fillRate")}
                          </p>
                          <p className="text-sm">
                            {fmtValue(row.fillRatePercent, "%")}
                          </p>
                        </div>
                      </div>

                      {/* Action Status */}
                      <div className="pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {t("columns.actionStatus")}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              getActionVariant(row.actionStatus),
                            )}
                          >
                            {t(`actionStatuses.${row.actionStatus}`)}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalBreachPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalBreachPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Termination Queue */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">
            {t("terminationQueue.title")}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t("terminationQueue.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : terminationCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {t("terminationQueue.empty")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      {t("columns.case")}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      {t("columns.supplier")}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      {t("columns.status")}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      {t("columns.action")}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      {t("columns.owner")}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      {t("columns.updated")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terminationCases.slice(0, 10).map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-border hover:bg-muted/40"
                    >
                      <TableCell className="py-3">
                        <div className="font-medium text-sm text-foreground">
                          #{row.id}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="font-medium text-sm text-foreground">
                          {row.supplier.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.supplier.code}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            row.status === "OPEN"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted",
                          )}
                        >
                          {t(`terminationStatuses.${row.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-foreground">
                        {t(`terminationActions.${row.recommendedAction}`)}
                      </TableCell>
                      <TableCell className="py-3">
                        {row.owner ? (
                          <div className="text-xs">
                            <p>{row.owner.name || t("common.unnamed")}</p>
                            <p className="text-muted-foreground">
                              {row.owner.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            {t("common.unassigned")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {fmtDate(
                          row.reviewedAt || row.resolvedAt || row.createdAt,
                          locale,
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SLA Policy Modal */}
      <SlaPolicyModal
        open={policyModalOpen}
        onOpenChange={setPolicyModalOpen}
        editingId={editingPolicyId}
        form={form}
        suppliers={suppliers}
        onFormChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
        onSave={submitPolicy}
        saving={saving}
      />
    </div>
  );
}

// Helper function for performance colors
function getPerformanceColor(value: number | string | null) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || isNaN(num)) return "text-muted-foreground";
  if (num >= 80) return "text-success";
  if (num >= 60) return "text-warning";
  return "text-destructive";
}
