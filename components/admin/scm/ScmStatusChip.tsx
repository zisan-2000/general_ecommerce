"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type ScmStatusChipProps = {
  status: string;
  className?: string;
};

function normalizeStatus(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusClasses(status: string) {
  const normalized = status.toUpperCase();

  if (
    ["REJECTED", "FAILED", "CANCELLED", "VARIANCE", "OUT_OF_STOCK", "OVERDUE"].includes(
      normalized,
    )
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    [
      "SUBMITTED",
      "PENDING",
      "PENDING_REVIEW",
      "IN_PROGRESS",
      "TREASURY_PROCESSING",
      "LOW_STOCK",
      "PARTIALLY_RECEIVED",
      "PARTIALLY_DISPATCHED",
      "PARTIALLY_RELEASED",
    ].includes(normalized)
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    [
      "APPROVED",
      "FINAL_APPROVED",
      "MANAGER_APPROVED",
      "COMMITTEE_APPROVED",
      "FINANCE_APPROVED",
      "BUDGET_CLEARED",
      "ENDORSED",
      "RECEIVED",
      "RELEASED",
      "MATCHED",
      "PAID",
      "DELIVERED",
      "RESOLVED",
      "CLOSED",
    ].includes(normalized)
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["DRAFT", "OPEN", "ACKNOWLEDGED"].includes(normalized)) {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  return "border-sky-200 bg-sky-50 text-sky-700";
}

export function ScmStatusChip({ status, className }: ScmStatusChipProps) {
  const t = useTranslations("AdminScmCommon");
  const translationKey = `statuses.${status.toUpperCase()}`;
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", getStatusClasses(status), className)}
    >
      {t.has(translationKey as any) ? t(translationKey as any) : normalizeStatus(status)}
    </Badge>
  );
}
