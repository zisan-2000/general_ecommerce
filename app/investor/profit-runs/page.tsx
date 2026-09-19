"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonTable } from "@/components/investor/InvestorSkeleton";
import { statusBadge, shortDate } from "@/lib/investor-status";

type ProfitPayload = {
  runs: Array<{
    id: number;
    runNumber: string;
    status: string;
    fromDate: string;
    toDate: string;
    totalNetProfit: string;
    totalNetRevenue: string;
    totalNetCogs: string;
    totalOperatingExpense: string;
    postedAt: string | null;
  }>;
  selectedRunId: number | null;
  allocationLines: Array<{
    id: number;
    participationSharePct: string;
    allocatedRevenue: string;
    allocatedNetProfit: string;
    productVariant: {
      id: number;
      sku: string;
      product: { id: number; name: string };
    };
  }>;
  payouts: Array<{
    id: number;
    payoutNumber: string;
    status: string;
    payoutAmount: string;
    payoutPercent: string;
    holdbackPercent: string;
    currency: string;
    createdAt: string;
    paidAt: string | null;
  }>;
};

function fmtAmount(value: string, locale: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvestorProfitRunsPage() {
  const t = useTranslations("InvestorPortal");
  const locale = useLocale();
  const [runId, setRunId] = useState<number | null>(null);
  const [data, setData] = useState<ProfitPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (runId) params.set("runId", String(runId));
        const response = await fetch(`/api/investor/profit-runs?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || t("errors.loadProfitRuns"));
        const parsed = payload as ProfitPayload;
        if (active) {
          setData(parsed);
          if (!runId && parsed.selectedRunId) setRunId(parsed.selectedRunId);
        }
      } catch (err: any) {
        if (active) setError(err?.message || t("errors.loadProfitRuns"));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [runId, t]);

  const selectedRun = useMemo(
    () => (data?.runs || []).find((r) => r.id === runId) || null,
    [data, runId],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{t("profitRuns.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("profitRuns.description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profitRuns.selection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-1">
            <Label>{t("common.profitRun")}</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={String(runId ?? "")}
              onChange={(e) => setRunId(Number(e.target.value) || null)}
            >
              <option value="">{t("profitRuns.selectRun")}</option>
              {(data?.runs || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.runNumber} — {t(`statuses.${item.status}` as any)}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2">
                  <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : selectedRun ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("common.run")}</p>
                <p className="font-medium">{selectedRun.runNumber}</p>
                <Badge className="mt-2" variant={statusBadge(selectedRun.status).variant}>
                  {t(`statuses.${selectedRun.status}` as any)}
                </Badge>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("common.period")}</p>
                <p className="font-medium text-sm">
                  {shortDate(selectedRun.fromDate, locale)} – {shortDate(selectedRun.toDate, locale)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("profitRuns.totalNetProfit")}</p>
                <p className="text-lg font-semibold">{fmtAmount(selectedRun.totalNetProfit, locale)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("profitRuns.postedAt")}</p>
                <p className="font-medium text-sm">{shortDate(selectedRun.postedAt, locale)}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profitRuns.allocationLines")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <SkeletonTable rows={3} cols={4} /> : (
            <>
            <div className="space-y-3 md:hidden">
              {(data?.allocationLines || []).map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">
                    {item.productVariant.product.name}
                    <span className="ml-1 text-xs text-muted-foreground">({item.productVariant.sku})</span>
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>{t("common.share")}: <span className="font-medium text-foreground">{fmtAmount(item.participationSharePct, locale)}%</span></div>
                    <div>{t("common.revenue")}: <span className="font-medium text-foreground">{fmtAmount(item.allocatedRevenue, locale)}</span></div>
                    <div className="col-span-2">{t("common.netProfit")}: <span className="font-medium text-foreground">{fmtAmount(item.allocatedNetProfit, locale)}</span></div>
                  </div>
                </div>
              ))}
              {data?.allocationLines?.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">{t("profitRuns.noAllocationLines")}</p>
              ) : null}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.product")}</TableHead>
                    <TableHead>{t("common.sharePercent")}</TableHead>
                    <TableHead>{t("profitRuns.allocatedRevenue")}</TableHead>
                    <TableHead>{t("profitRuns.allocatedNetProfit")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.allocationLines || []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.productVariant.product.name}
                        <span className="ml-1 text-xs text-muted-foreground">({item.productVariant.sku})</span>
                      </TableCell>
                      <TableCell>{fmtAmount(item.participationSharePct, locale)}%</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtAmount(item.allocatedRevenue, locale)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtAmount(item.allocatedNetProfit, locale)}</TableCell>
                    </TableRow>
                  ))}
                  {data?.allocationLines?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        {t("profitRuns.noAllocationLines")}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profitRuns.payoutRecords")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <SkeletonTable rows={3} cols={5} /> : (
            <>
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
                      <div>{t("common.amount")}: <span className="font-medium text-foreground">{fmtAmount(item.payoutAmount, locale)} {item.currency}</span></div>
                      <div>{t("profitRuns.payoutPercent")}: <span className="font-medium text-foreground">{fmtAmount(item.payoutPercent, locale)}%</span></div>
                      <div>{t("common.created")}: <span className="font-medium text-foreground">{shortDate(item.createdAt, locale)}</span></div>
                      <div>{t("common.paid")}: <span className="font-medium text-foreground">{shortDate(item.paidAt, locale)}</span></div>
                    </div>
                  </div>
                );
              })}
              {data?.payouts?.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">{t("profitRuns.noPayouts")}</p>
              ) : null}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.payout")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("common.amount")}</TableHead>
                    <TableHead>{t("profitRuns.payoutPercent")}</TableHead>
                    <TableHead>{t("common.created")}</TableHead>
                    <TableHead>{t("common.paid")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.payouts || []).map((item) => {
                    const badge = statusBadge(item.status, t(`statuses.${item.status}` as any));
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap font-medium">{item.payoutNumber}</TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {fmtAmount(item.payoutAmount, locale)} {item.currency}
                        </TableCell>
                        <TableCell>{fmtAmount(item.payoutPercent, locale)}%</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{shortDate(item.createdAt, locale)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{shortDate(item.paidAt, locale)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {data?.payouts?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                        {t("profitRuns.noPayouts")}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
