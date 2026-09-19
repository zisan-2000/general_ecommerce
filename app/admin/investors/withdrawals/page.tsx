"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InvestorWorkflowGuide } from "@/components/investors/InvestorWorkflowGuide";

type WithdrawalRow = {
  id: number;
  requestNumber: string;
  requestedAmount: string;
  approvedAmount: string | null;
  currency: string;
  availableBalanceSnapshot: string;
  activeCommittedAmountSnapshot: string;
  pendingPayoutAmountSnapshot: string;
  withdrawableBalanceSnapshot: string;
  status: string;
  requestedSettlementDate: string | null;
  requestNote: string | null;
  reviewNote: string | null;
  rejectionReason: string | null;
  settlementNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  settledAt: string | null;
  investor: {
    id: number;
    code: string;
    name: string;
    status?: string;
    kycStatus?: string;
  } | null;
  submittedBy: { id: string; name: string | null; email: string } | null;
  reviewedBy: { id: string; name: string | null; email: string } | null;
  settledBy: { id: string; name: string | null; email: string } | null;
  transaction: {
    id: number;
    transactionNumber: string;
    transactionDate: string;
    amount: string;
    direction: string;
    type: string;
  } | null;
};

type Payload = {
  summary: {
    requested: number;
    approved: number;
    settled: number;
    rejected: number;
    totalRequestedAmount: string;
  };
  rows: WithdrawalRow[];
};

function fmtDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(locale);
}

function fmtMoney(value: string | null | undefined, locale: string) {
  return Number(value || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function InvestorWithdrawalsPage() {
  const t = useTranslations("AdminInvestors.pages");
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [status, setStatus] = useState("REQUESTED");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [approvedAmounts, setApprovedAmounts] = useState<Record<number, string>>({});
  const [settlementNotes, setSettlementNotes] = useState<Record<number, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(
        `/api/admin/investor-withdrawals${params.size ? `?${params.toString()}` : ""}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.loadWithdrawals"));
      }
      setData(payload as Payload);
    } catch {
      toast.error(t("errors.loadWithdrawals"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [status]);

  const act = async (
    row: WithdrawalRow,
    action: "approve" | "reject" | "settle",
  ) => {
    try {
      setWorkingId(row.id);
      const response = await fetch(`/api/admin/investor-withdrawals/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewNote: reviewNotes[row.id] || "",
          approvedAmount: approvedAmounts[row.id] || row.requestedAmount,
          settlementNote: settlementNotes[row.id] || "",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.updateWithdrawal"));
      }
      toast.success(
        action === "approve"
          ? t("success.withdrawalApproved")
          : action === "reject"
            ? t("success.withdrawalRejected")
            : t("success.withdrawalSettled"),
      );
      await load();
    } catch {
      toast.error(t("errors.updateWithdrawal"));
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <InvestorWorkflowGuide currentSection="withdrawals" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("withdrawals.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("withdrawals.description")}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Input
            placeholder={t("withdrawals.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full sm:w-56"
          />
          <Button variant="outline" onClick={() => void load()}>
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.requested")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data?.summary.requested ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.approved")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data?.summary.approved ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.settled")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data?.summary.settled ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.rejected")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data?.summary.rejected ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("withdrawals.totalRequested")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmtMoney(data?.summary.totalRequestedAmount, locale)}</CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {["REQUESTED", "APPROVED", "SETTLED", "REJECTED", ""].map((value) => (
          <Button
            key={value || "ALL"}
            variant={status === value ? "default" : "outline"}
            onClick={() => setStatus(value)}
          >
            {value ? t(`enums.withdrawalStatuses.${value}` as any) : t("common.all")}
          </Button>
        ))}
      </div>

      {loading ? <p className="text-sm text-muted-foreground">{t("withdrawals.loading")}</p> : null}

      {!loading && data ? (
        <div className="space-y-4">
          {data.rows.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                {t("withdrawals.empty")}
              </CardContent>
            </Card>
          ) : (
            data.rows.map((row) => (
              <Card key={row.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{row.requestNumber}</CardTitle>
                        <Badge variant="outline">{t(`enums.withdrawalStatuses.${row.status}` as any)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("withdrawals.submittedMeta", { investor: `${row.investor?.name || "—"} (${row.investor?.code || "—"})`, date: fmtDate(row.submittedAt, locale) })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {row.investor ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/admin/investors/${row.investor.id}`}>{t("common.openInvestor")}</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-md border p-3 text-sm">
                      <div className="text-muted-foreground">{t("common.requested")}</div>
                      <div className="font-semibold">{fmtMoney(row.requestedAmount, locale)} {row.currency}</div>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <div className="text-muted-foreground">{t("withdrawals.withdrawableSnapshot")}</div>
                      <div className="font-semibold">{fmtMoney(row.withdrawableBalanceSnapshot, locale)}</div>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <div className="text-muted-foreground">{t("withdrawals.committedSnapshot")}</div>
                      <div className="font-semibold">{fmtMoney(row.activeCommittedAmountSnapshot, locale)}</div>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <div className="text-muted-foreground">{t("withdrawals.payoutSnapshot")}</div>
                      <div className="font-semibold">{fmtMoney(row.pendingPayoutAmountSnapshot, locale)}</div>
                    </div>
                  </div>

                  {row.requestNote ? <p className="text-sm">{t("withdrawals.requestNote", { note: row.requestNote })}</p> : null}
                  {row.reviewNote ? <p className="text-sm text-muted-foreground">{t("common.reviewNoteValue", { note: row.reviewNote })}</p> : null}
                  {row.rejectionReason ? <p className="text-sm text-destructive">{t("withdrawals.rejectionReason", { reason: row.rejectionReason })}</p> : null}
                  {row.settlementNote ? <p className="text-sm text-muted-foreground">{t("withdrawals.settlementNoteValue", { note: row.settlementNote })}</p> : null}
                  {row.transaction ? (
                    <p className="text-sm text-muted-foreground">
                      {t("withdrawals.ledgerPosted", { number: row.transaction.transactionNumber, date: fmtDate(row.transaction.transactionDate, locale) })}
                    </p>
                  ) : null}

                  {row.status === "REQUESTED" ? (
                    <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t("withdrawals.approvedAmount")}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={approvedAmounts[row.id] ?? row.requestedAmount}
                          onChange={(event) =>
                            setApprovedAmounts((current) => ({
                              ...current,
                              [row.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("common.reviewNote")}</Label>
                        <Textarea
                          value={reviewNotes[row.id] || ""}
                          onChange={(event) =>
                            setReviewNotes((current) => ({
                              ...current,
                              [row.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 md:col-span-2">
                        <Button
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => void act(row, "approve")}
                          disabled={workingId === row.id}
                        >
                          {t("common.approve")}
                        </Button>
                        <Button
                          size="sm"
                          className="w-full sm:w-auto"
                          variant="outline"
                          onClick={() => void act(row, "reject")}
                          disabled={workingId === row.id}
                        >
                          {t("common.reject")}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {row.status === "APPROVED" ? (
                    <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label>{t("withdrawals.settlementNote")}</Label>
                        <Textarea
                          value={settlementNotes[row.id] || ""}
                          onChange={(event) =>
                            setSettlementNotes((current) => ({
                              ...current,
                              [row.id]: event.target.value,
                            }))
                          }
                          placeholder={t("withdrawals.settlementPlaceholder")}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Button
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => void act(row, "settle")}
                          disabled={workingId === row.id}
                        >
                          {t("withdrawals.settle")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
