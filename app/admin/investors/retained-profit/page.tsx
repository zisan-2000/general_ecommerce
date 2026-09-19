"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RunRow = {
  id: number;
  runNumber: string;
  fromDate: string;
  toDate: string;
  status: string;
  postedAt: string | null;
  totalNetRevenue: string;
  totalNetProfit: string;
  retainedVariantCount: number;
  retainedShareTotal: string;
  retainedRevenue: string;
  retainedProfit: string;
};

type SelectedRun = {
  id: number;
  runNumber: string;
  fromDate: string;
  toDate: string;
  status: string;
  postedAt: string | null;
  totalNetRevenue: string;
  totalNetProfit: string;
  retainedLines: Array<{
    id: number;
    sku: string;
    productName: string;
    netRevenue: string;
    netProfit: string;
    retainedSharePct: string;
    retainedRevenue: string;
    retainedProfit: string;
  }>;
};

type Payload = {
  filters: {
    from: string;
    to: string;
    status: string;
  };
  summary: {
    totalRuns: number;
    runsWithRetainedProfit: number;
    retainedVariantCount: number;
    totalRetainedRevenue: string;
    totalRetainedProfit: string;
  };
  runs: RunRow[];
  selectedRunId: number | null;
  selectedRun: SelectedRun | null;
};

function fmtDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(locale);
}

function fmtMoney(value: string, locale: string) {
  return Number(value || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function InvestorRetainedProfitPage() {
  const t = useTranslations("AdminInvestors.pages");
  const locale = useLocale();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const monthStart = useMemo(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().slice(0, 10);
  }, []);

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState("POSTED");
  const [selectedRunId, setSelectedRunId] = useState<number | "">("");

  const load = async (options?: { runId?: number | "" }) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (status) params.set("status", status);
      const nextRunId = options?.runId ?? selectedRunId;
      if (nextRunId) params.set("runId", String(nextRunId));

      const response = await fetch(
        `/api/admin/investor-retained-profit?${params.toString()}`,
        { cache: "no-store" },
      );
      const next = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.loadRetainedProfit"));
      }
      const data = next as Payload;
      setPayload(data);
      setSelectedRunId(data.selectedRunId ?? "");
    } catch {
      toast.error(t("errors.loadRetainedProfit"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const applyFilters = async () => {
    await load({ runId: "" });
  };

  const openRun = async (runId: number) => {
    setSelectedRunId(runId);
    await load({ runId });
  };

  if (loading && !payload) {
    return <div className="p-6 text-sm text-muted-foreground">{t("retainedProfit.loading")}</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("retainedProfit.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("retainedProfit.description")}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/investors/profit-runs">{t("retainedProfit.openRuns")}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("common.filters")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>{t("common.from")}</Label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("common.to")}</Label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("common.status")}</Label>
            <select
              className="h-10 min-w-[180px] rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="POSTED">{t("enums.profitStatuses.POSTED")}</option>
              <option value="APPROVED">{t("enums.profitStatuses.APPROVED")}</option>
              <option value="PENDING_APPROVAL">{t("enums.profitStatuses.PENDING_APPROVAL")}</option>
              <option value="">{t("common.all")}</option>
            </select>
          </div>
          <Button onClick={() => void applyFilters()} disabled={loading}>
            {loading ? t("common.loading") : t("common.apply")}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("retainedProfit.runsInScope")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{payload?.summary.totalRuns ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("retainedProfit.runsWithProfit")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{payload?.summary.runsWithRetainedProfit ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("retainedProfit.retainedVariants")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{payload?.summary.retainedVariantCount ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("retainedProfit.retainedRevenue")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmtMoney(payload?.summary.totalRetainedRevenue || "0", locale)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("retainedProfit.retainedProfit")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmtMoney(payload?.summary.totalRetainedProfit || "0", locale)}</CardContent></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("retainedProfit.runRegister")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payload?.runs.length ? (
              payload.runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => void openRun(run.id)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    payload.selectedRunId === run.id
                      ? "border-primary/30 bg-primary/10"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium">{run.runNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {fmtDate(run.fromDate, locale)} - {fmtDate(run.toDate, locale)} | {t(`enums.profitStatuses.${run.status}` as any)}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t("retainedProfit.postedAt", { date: fmtDate(run.postedAt, locale) })}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-4 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.variants")}</div>
                      <div className="mt-1 font-medium">{run.retainedVariantCount}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("retainedProfit.shareTotal")}</div>
                      <div className="mt-1 font-medium">{(Number(run.retainedShareTotal) * 100).toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("retainedProfit.retainedRevenue")}</div>
                      <div className="mt-1 font-medium">{fmtMoney(run.retainedRevenue, locale)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("retainedProfit.retainedProfit")}</div>
                      <div className="mt-1 font-medium">{fmtMoney(run.retainedProfit, locale)}</div>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                {t("retainedProfit.emptyRuns")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("retainedProfit.selectedBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payload?.selectedRun ? (
              <>
                <div className="rounded-lg border p-4 text-sm">
                  <div className="font-medium">{payload.selectedRun.runNumber}</div>
                  <div className="mt-1 text-muted-foreground">
                    {fmtDate(payload.selectedRun.fromDate, locale)} - {fmtDate(payload.selectedRun.toDate, locale)} | {t(`enums.profitStatuses.${payload.selectedRun.status}` as any)}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("retainedProfit.runRevenue")}</div>
                      <div className="mt-1 font-medium">{fmtMoney(payload.selectedRun.totalNetRevenue, locale)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("retainedProfit.runProfit")}</div>
                      <div className="mt-1 font-medium">{fmtMoney(payload.selectedRun.totalNetProfit, locale)}</div>
                    </div>
                  </div>
                </div>

                {payload.selectedRun.retainedLines.length > 0 ? (
                  payload.selectedRun.retainedLines.map((line) => (
                    <div key={line.id} className="rounded-lg border p-4 text-sm">
                      <div className="font-medium">
                        {line.productName} ({line.sku})
                      </div>
                      <div className="mt-2 grid gap-3 md:grid-cols-3">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("retainedProfit.companyShare")}</div>
                          <div className="mt-1 font-medium">{(Number(line.retainedSharePct) * 100).toFixed(2)}%</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("retainedProfit.retainedRevenue")}</div>
                          <div className="mt-1 font-medium">{fmtMoney(line.retainedRevenue, locale)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("retainedProfit.retainedProfit")}</div>
                          <div className="mt-1 font-medium">{fmtMoney(line.retainedProfit, locale)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    {t("retainedProfit.noLines")}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                {t("retainedProfit.selectRun")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
