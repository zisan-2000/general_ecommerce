"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SkeletonCards } from "@/components/investor/InvestorSkeleton";
import { statusBadge, shortDateTime } from "@/lib/investor-status";

type WithdrawalRequestRow = {
  id: number;
  requestNumber: string;
  requestedAmount: string;
  approvedAmount: string | null;
  currency: string;
  status: string;
  requestedSettlementDate: string | null;
  requestNote: string | null;
  reviewNote: string | null;
  rejectionReason: string | null;
  settlementNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  settledAt: string | null;
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
  investor: {
    id: number;
    code: string;
    name: string;
    status: string;
    kycStatus: string;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
    beneficiaryVerifiedAt: string | null;
    beneficiaryVerificationNote: string | null;
  };
  metrics: {
    availableBalance: string;
    activeCommittedAmount: string;
    pendingPayoutAmount: string;
    pendingWithdrawalAmount: string;
    withdrawableBalance: string;
  };
  requests: WithdrawalRequestRow[];
};

function fmtAmount(value: string, locale: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvestorWithdrawalsPage() {
  const t = useTranslations("InvestorPortal");
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [amount, setAmount] = useState("");
  const [requestedSettlementDate, setRequestedSettlementDate] = useState("");
  const [requestNote, setRequestNote] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/investor/withdrawals", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || t("errors.loadWithdrawals"));
      setData(payload as Payload);
    } catch (error: any) {
      toast.error(error?.message || t("errors.loadWithdrawals"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/investor/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, requestedSettlementDate: requestedSettlementDate || null, requestNote: requestNote || null }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || t("errors.submitWithdrawal"));
      toast.success(t("success.withdrawalSubmitted"));
      setAmount("");
      setRequestedSettlementDate("");
      setRequestNote("");
      await load();
    } catch (error: any) {
      toast.error(error?.message || t("errors.submitWithdrawal"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="h-7 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded bg-muted" />
        </div>
        <SkeletonCards count={5} />
        <Card>
          <CardHeader><div className="h-4 w-40 animate-pulse rounded bg-muted" /></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
            </div>
            <div className="h-20 animate-pulse rounded bg-muted" />
            <div className="h-9 w-40 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{t("withdrawals.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("withdrawals.description")}
        </p>
      </div>

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: t("withdrawals.availableBalance"), value: data.metrics.availableBalance },
              { label: t("withdrawals.activeCommitted"), value: data.metrics.activeCommittedAmount },
              { label: t("withdrawals.pendingPayouts"), value: data.metrics.pendingPayoutAmount },
              { label: t("withdrawals.pendingWithdrawals"), value: data.metrics.pendingWithdrawalAmount },
              { label: t("withdrawals.withdrawable"), value: data.metrics.withdrawableBalance },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{fmtAmount(value, locale)}</CardContent>
              </Card>
            ))}
          </div>

          {data.investor.kycStatus !== "VERIFIED" || !data.investor.beneficiaryVerifiedAt ? (
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
              {t("withdrawals.verificationRequired")}
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("withdrawals.submitTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>{t("withdrawals.requestedAmount")}</Label>
                  <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("withdrawals.requestedSettlementDate")}</Label>
                  <Input type="date" value={requestedSettlementDate} onChange={(e) => setRequestedSettlementDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("withdrawals.beneficiary")}</Label>
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    {(data.investor.bankAccountName || data.investor.name) + " | " + (data.investor.bankName || t("withdrawals.noBank"))}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t("withdrawals.requestNote")}</Label>
                <Textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder={t("withdrawals.requestNotePlaceholder")} />
              </div>
              <Button onClick={() => void submit()} disabled={saving || !amount.trim() || Number(amount) <= 0}>
                {saving ? t("common.submitting") : t("withdrawals.submit")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("withdrawals.recentRequests")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("withdrawals.empty")}</p>
              ) : (
                data.requests.map((row) => {
                  const badge = statusBadge(row.status, t(`statuses.${row.status}` as any));
                  return (
                    <div key={row.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{row.requestNumber}</p>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t("withdrawals.submittedLine", { date: shortDateTime(row.submittedAt, locale), amount: row.requestedAmount, currency: row.currency })}
                          </p>
                        </div>
                        {row.transaction ? (
                          <div className="text-right text-sm text-muted-foreground">
                            <div>{row.transaction.transactionNumber}</div>
                            <div>{shortDateTime(row.transaction.transactionDate, locale)}</div>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <div>{t("common.approved")}: {row.approvedAmount ?? "—"} {row.approvedAmount ? row.currency : ""}</div>
                        <div>{t("withdrawals.settlementDate")}: {shortDateTime(row.requestedSettlementDate, locale)}</div>
                        <div>{t("common.reviewed")}: {shortDateTime(row.reviewedAt, locale)}</div>
                        <div>{t("common.settled")}: {shortDateTime(row.settledAt, locale)}</div>
                      </div>
                      {row.requestNote ? <p className="mt-3 text-sm">{t("withdrawals.requestNoteValue", { note: row.requestNote })}</p> : null}
                      {row.reviewNote ? <p className="mt-2 text-sm text-muted-foreground">{t("withdrawals.reviewNoteValue", { note: row.reviewNote })}</p> : null}
                      {row.rejectionReason ? <p className="mt-2 text-sm text-destructive">{t("withdrawals.rejectionReasonValue", { reason: row.rejectionReason })}</p> : null}
                      {row.settlementNote ? <p className="mt-2 text-sm text-muted-foreground">{t("withdrawals.settlementNoteValue", { note: row.settlementNote })}</p> : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
