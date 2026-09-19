"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonCards, SkeletonCard } from "@/components/investor/InvestorSkeleton";
import { statusBadge, shortDateTime } from "@/lib/investor-status";

type OverviewPayload = {
  investor: { id: number; code: string; name: string };
  summary: {
    totalCredit: string;
    totalDebit: string;
    balance: string;
    allocationCount: number;
    activeAllocationCount: number;
    recentPayoutTotal: string;
    unreadNotificationCount: number;
    pendingProfileRequestCount: number;
  };
  recentTransactions: Array<{
    id: number;
    transactionNumber: string;
    transactionDate: string;
    type: string;
    direction: string;
    amount: string;
    currency: string;
  }>;
  recentPayouts: Array<{
    id: number;
    payoutNumber: string;
    status: string;
    payoutAmount: string;
    currency: string;
    createdAt: string;
    paidAt: string | null;
    run: { id: number; runNumber: string };
  }>;
  recentRuns: Array<{
    id: number;
    runNumber: string;
    status: string;
    fromDate: string;
    toDate: string;
    totalNetProfit: string;
    createdAt: string;
  }>;
};

function fmtAmount(value: string, locale: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvestorDashboardPage() {
  const t = useTranslations("InvestorPortal");
  const locale = useLocale();
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/investor/overview", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || t("errors.loadOverview"));
        if (active) setData(payload as OverviewPayload);
      } catch (err: any) {
        if (active) setError(err?.message || t("errors.loadOverview"));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [t]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="h-7 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <SkeletonCards count={3} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.description")}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("common.totalCredit")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{fmtAmount(data.summary.totalCredit, locale)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("common.totalDebit")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{fmtAmount(data.summary.totalDebit, locale)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("common.netBalance")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{fmtAmount(data.summary.balance, locale)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.activeAllocations")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {data.summary.activeAllocationCount}/{data.summary.allocationCount}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.unreadNotifications")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{data.summary.unreadNotificationCount}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.pendingProfileRequests")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{data.summary.pendingProfileRequestCount}</CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("dashboard.recentTransactions")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("common.noTransactions")}</p>
                ) : (
                  data.recentTransactions.map((item) => {
                    const badge = statusBadge(item.direction, t(`statuses.${item.direction}` as any));
                    return (
                      <div key={item.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{item.transactionNumber}</p>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t.has(`transactionTypes.${item.type}` as any) ? t(`transactionTypes.${item.type}` as any) : item.type} • {fmtAmount(item.amount, locale)} {item.currency}
                        </p>
                        <p className="text-xs text-muted-foreground">{shortDateTime(item.transactionDate, locale)}</p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("dashboard.recentPayouts")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentPayouts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("common.noPayouts")}</p>
                ) : (
                  data.recentPayouts.map((item) => {
                    const badge = statusBadge(item.status, t(`statuses.${item.status}` as any));
                    return (
                      <div key={item.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{item.payoutNumber}</p>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {fmtAmount(item.payoutAmount, locale)} {item.currency}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.run.runNumber} • {shortDateTime(item.paidAt || item.createdAt, locale)}
                        </p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("dashboard.recentProfitRuns")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("common.noProfitRuns")}</p>
                ) : (
                  data.recentRuns.map((item) => {
                    const badge = statusBadge(item.status, t(`statuses.${item.status}` as any));
                    return (
                      <div key={item.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{item.runNumber}</p>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("common.netProfit")}: {fmtAmount(item.totalNetProfit, locale)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {shortDateTime(item.fromDate, locale)} – {shortDateTime(item.toDate, locale)}
                        </p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
