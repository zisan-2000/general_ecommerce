"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Payload = {
  allocation: {
    id: number;
    investorId: number;
    productVariantId: number;
    participationPercent: string | null;
    committedAmount: string | null;
    status: string;
    note: string | null;
    effectiveFrom: string;
    effectiveTo: string | null;
    investor: {
      id: number;
      code: string;
      name: string;
      status: string;
      kycStatus: string;
    };
    productVariant: {
      id: number;
      sku: string;
      active: boolean;
      product: { id: number; name: string };
    };
    createdBy: { id: string; name: string | null; email: string } | null;
  };
  overlappingAllocations: Array<{
    id: number;
    participationPercent: string | null;
    committedAmount: string | null;
    status: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    investor: {
      id: number;
      code: string;
      name: string;
      status: string;
    };
  }>;
  productVariantAllocationPercent: string;
  investorTransactions: Array<{
    id: number;
    transactionNumber: string;
    transactionDate: string;
    type: string;
    direction: string;
    amount: string;
    currency: string;
  }>;
  relatedProfitLines: Array<{
    id: number;
    allocatedRevenue: string;
    allocatedNetProfit: string;
    participationSharePct: string;
    profitRun: {
      id: number;
      runNumber: string;
      fromDate: string;
      toDate: string;
      status: string;
    };
  }>;
};

function fmtDate(value: string | null | undefined, locale: string, empty = "—") {
  if (!value) return empty;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(locale);
}

function fmtMoney(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  return Number(value || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function InvestorAllocationDetailPage() {
  const t = useTranslations("AdminInvestors.pages");
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [status, setStatus] = useState("ACTIVE");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/investor-allocations/${params.id}`, {
        cache: "no-store",
      });
      const next = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.loadAllocationDetail"));
      }
      const data = next as Payload;
      setPayload(data);
      setStatus(data.allocation.status);
      setEffectiveTo(data.allocation.effectiveTo ? data.allocation.effectiveTo.slice(0, 10) : "");
      setNote(data.allocation.note ?? "");
    } catch {
      toast.error(t("errors.loadAllocationDetail"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) void load();
  }, [params.id]);

  const save = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/admin/investor-allocations/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          effectiveTo: effectiveTo || null,
          note,
        }),
      });
      const next = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.updateAllocation"));
      }
      toast.success(t("success.allocationUpdated"));
      await load();
    } catch {
      toast.error(t("errors.updateAllocation"));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !payload) {
    return <div className="p-6 text-sm text-muted-foreground">{t("allocationDetail.loading")}</div>;
  }

  const { allocation, overlappingAllocations, investorTransactions, relatedProfitLines, productVariantAllocationPercent } = payload;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("allocationDetail.title", { id: allocation.id })}</h1>
        <p className="text-sm text-muted-foreground">
          {t("allocationDetail.description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.investor")}</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{allocation.investor.name}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.variant")}</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{allocation.productVariant.sku}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("allocationDetail.participation")}</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{allocation.participationPercent || "—"}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("allocationDetail.committed")}</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{fmtMoney(allocation.committedAmount, locale)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("allocationDetail.variantActivePercent")}</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{productVariantAllocationPercent}</CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("allocationDetail.context")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.investor")}</div><Link href={`/admin/investors/${allocation.investor.id}`} className="mt-1 block font-medium hover:text-primary">{allocation.investor.name} ({allocation.investor.code})</Link></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.investorStatus")}</div><div className="mt-1 font-medium">{t(`enums.investorStatuses.${allocation.investor.status}` as any)} | {t(`enums.kycStatuses.${allocation.investor.kycStatus}` as any)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.variant")}</div><div className="mt-1 font-medium">{allocation.productVariant.product.name} ({allocation.productVariant.sku})</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("allocationDetail.variantActive")}</div><div className="mt-1 font-medium">{allocation.productVariant.active ? t("common.yes") : t("common.no")}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.effectiveFrom")}</div><div className="mt-1 font-medium">{fmtDate(allocation.effectiveFrom, locale)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.effectiveTo")}</div><div className="mt-1 font-medium">{fmtDate(allocation.effectiveTo, locale, t("common.openEnded"))}</div></div>
            <div className="md:col-span-2"><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.note")}</div><div className="mt-1 whitespace-pre-wrap font-medium">{allocation.note || "—"}</div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("allocationDetail.lifecycleControl")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>{t("common.status")}</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="ACTIVE">{t("enums.allocationStatuses.ACTIVE")}</option>
                <option value="SUSPENDED">{t("enums.allocationStatuses.SUSPENDED")}</option>
                <option value="CLOSED">{t("enums.allocationStatuses.CLOSED")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t("common.effectiveTo")}</Label>
              <Input type="date" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("common.note")}</Label>
              <Textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? t("common.saving") : t("allocationDetail.saveChanges")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("allocationDetail.overlapRisks")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overlappingAllocations.length > 0 ? (
              overlappingAllocations.map((item) => (
                <Link key={item.id} href={`/admin/investors/allocations/${item.id}`} className="block rounded-lg border p-3 text-sm hover:border-primary/40 hover:bg-muted/30">
                  <div className="font-medium">{item.investor.name} ({item.investor.code})</div>
                  <div className="text-muted-foreground">
                    {t(`enums.allocationStatuses.${item.status}` as any)} | {item.participationPercent || "—"} | {fmtDate(item.effectiveFrom, locale)} {"→"} {fmtDate(item.effectiveTo, locale, t("common.openEnded"))}
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                {t("allocationDetail.noOverlaps")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("allocationDetail.linkedLedgerEntries")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {investorTransactions.length > 0 ? (
              investorTransactions.map((item) => (
                <Link key={item.id} href={`/admin/investors/ledger/${item.id}`} className="block rounded-lg border p-3 text-sm hover:border-primary/40 hover:bg-muted/30">
                  <div className="font-medium">{item.transactionNumber}</div>
                  <div className="text-muted-foreground">
                    {t(`enums.transactionTypes.${item.type}` as any)} | {t(`enums.directions.${item.direction}` as any)} | {fmtMoney(item.amount, locale)} {item.currency}
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                {t("allocationDetail.noLedgerEntries")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("allocationDetail.relatedProfitRuns")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {relatedProfitLines.length > 0 ? (
            relatedProfitLines.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{item.profitRun.runNumber}</div>
                <div className="text-muted-foreground">
                  {fmtDate(item.profitRun.fromDate, locale)} {"→"} {fmtDate(item.profitRun.toDate, locale)} | {t(`enums.profitStatuses.${item.profitRun.status}` as any)}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {t("allocationDetail.profitLine", {
                    share: item.participationSharePct,
                    revenue: fmtMoney(item.allocatedRevenue, locale),
                    profit: fmtMoney(item.allocatedNetProfit, locale),
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {t("allocationDetail.noProfitHistory")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
