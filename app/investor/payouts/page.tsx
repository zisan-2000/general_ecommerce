"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonCards, SkeletonTable } from "@/components/investor/InvestorSkeleton";
import { statusBadge, shortDate } from "@/lib/investor-status";

type PayoutPayload = {
  summary: {
    payoutCount: number;
    paidCount: number;
    totalAmount: string;
    paidAmount: string;
  };
  payouts: Array<{
    id: number;
    payoutNumber: string;
    status: string;
    payoutPercent: string;
    holdbackPercent: string;
    grossProfitAmount: string;
    holdbackAmount: string;
    payoutAmount: string;
    currency: string;
    paymentMethod: string | null;
    bankReference: string | null;
    createdAt: string;
    approvedAt: string | null;
    paidAt: string | null;
    run: { id: number; runNumber: string; fromDate: string; toDate: string };
  }>;
};

function fmtAmount(value: string, locale: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvestorPayoutsPage() {
  const t = useTranslations("InvestorPortal");
  const locale = useLocale();
  const [data, setData] = useState<PayoutPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/investor/payouts", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || t("errors.loadPayouts"));
        if (active) setData(payload as PayoutPayload);
      } catch (err: any) {
        if (active) setError(err?.message || t("errors.loadPayouts"));
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
          <div className="h-7 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        </div>
        <SkeletonCards count={4} />
        <Card>
          <CardHeader><div className="h-4 w-32 animate-pulse rounded bg-muted" /></CardHeader>
          <CardContent><SkeletonTable rows={5} cols={6} /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{t("payouts.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("payouts.description")}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("payouts.payoutCount")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data?.summary.payoutCount || 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("payouts.paidCount")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data?.summary.paidCount || 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("common.totalAmount")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{fmtAmount(data?.summary.totalAmount || "0", locale)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("payouts.paidAmount")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{fmtAmount(data?.summary.paidAmount || "0", locale)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("payouts.register")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {(data?.payouts || []).map((item) => {
              const badge = statusBadge(item.status, t(`statuses.${item.status}` as any));
              return (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{item.payoutNumber}</p>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>{t("common.run")}: <span className="font-medium text-foreground">{item.run.runNumber}</span></div>
                    <div>{t("common.amount")}: <span className="font-medium text-foreground">{fmtAmount(item.payoutAmount, locale)} {item.currency}</span></div>
                    <div>{t("common.method")}: <span className="font-medium text-foreground">{item.paymentMethod ? (t.has(`paymentMethods.${item.paymentMethod}` as any) ? t(`paymentMethods.${item.paymentMethod}` as any) : item.paymentMethod) : "—"}</span></div>
                    <div>{t("common.created")}: <span className="font-medium text-foreground">{shortDate(item.createdAt, locale)}</span></div>
                    <div>{t("common.approved")}: <span className="font-medium text-foreground">{shortDate(item.approvedAt, locale)}</span></div>
                    <div>{t("common.paid")}: <span className="font-medium text-foreground">{shortDate(item.paidAt, locale)}</span></div>
                  </div>
                </div>
              );
            })}
            {data?.payouts?.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("common.noPayouts")}</p>
            ) : null}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.payout")}</TableHead>
                  <TableHead>{t("common.run")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("common.amount")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("common.method")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("common.created")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("common.approved")}</TableHead>
                  <TableHead>{t("common.paid")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.payouts || []).map((item) => {
                  const badge = statusBadge(item.status, t(`statuses.${item.status}` as any));
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap font-medium">{item.payoutNumber}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{item.run.runNumber}</TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {fmtAmount(item.payoutAmount, locale)} {item.currency}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {item.paymentMethod ? (t.has(`paymentMethods.${item.paymentMethod}` as any) ? t(`paymentMethods.${item.paymentMethod}` as any) : item.paymentMethod) : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell whitespace-nowrap text-muted-foreground">
                        {shortDate(item.createdAt, locale)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell whitespace-nowrap text-muted-foreground">
                        {shortDate(item.approvedAt, locale)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {shortDate(item.paidAt, locale)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data?.payouts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                      {t("common.noPayouts")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
