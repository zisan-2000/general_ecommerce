"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Person = { id: string; name: string | null; email: string };

type Payload = {
  run: {
    id: number;
    runNumber: string;
    fromDate: string;
    toDate: string;
    status: string;
    allocationBasis: string;
    marketingExpense: string;
    adsExpense: string;
    logisticsExpense: string;
    otherExpense: string;
    totalOperatingExpense: string;
    totalNetRevenue: string;
    totalNetCogs: string;
    totalNetProfit: string;
    note: string | null;
    approvedAt: string | null;
    postedAt: string | null;
    postingNote: string | null;
    createdAt: string;
    createdBy: Person | null;
    approvedBy: Person | null;
    postedBy: Person | null;
    _count: { variantLines: number; allocationLines: number; payouts: number };
    variantLines: Array<{
      id: number;
      netRevenue: string;
      netCogs: string;
      allocatedExpense: string;
      netProfit: string;
      unallocatedSharePct: string;
      unitsNet: number;
      productVariant: { id: number; sku: string; product: { id: number; name: string } };
    }>;
    allocationLines: Array<{
      id: number;
      participationSharePct: string;
      allocatedRevenue: string;
      allocatedNetProfit: string;
      investor: { id: number; code: string; name: string; status: string };
      productVariant: { id: number; sku: string; product: { id: number; name: string } };
      sourceAllocation: { id: number; status: string; effectiveFrom: string; effectiveTo: string | null } | null;
    }>;
    payouts: Array<{
      id: number;
      payoutNumber: string;
      payoutAmount: string;
      status: string;
      paidAt: string | null;
      investor: { id: number; code: string; name: string };
      transaction: { id: number; transactionNumber: string; transactionDate: string; amount: string } | null;
    }>;
  };
  governance: {
    variantLineCount: number;
    allocationLineCount: number;
    variantsWithUnallocatedCount: number;
    unallocatedShareTotal: string;
    companyRetainedRevenueTotal: string;
    companyRetainedProfitTotal: string;
    missingSourceAllocationCount: number;
    inactiveSourceAllocationCount: number;
    negativeDistributionCount: number;
    nonBlockingWarnings: string[];
    blockingIssues: string[];
  };
  recentActivity: Array<{
    id: string;
    action: string;
    entity: string;
    createdAt: string;
    actorName: string | null;
    actorEmail: string | null;
    metadata?: { message?: string } | null;
  }>;
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

export default function InvestorProfitRunDetailPage() {
  const t = useTranslations("AdminInvestors.pages");
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.globalPermissions)
    ? ((session?.user as any).globalPermissions as string[])
    : [];
  const canApprove = permissions.includes("investor_profit.approve");
  const canPost = permissions.includes("investor_profit.post");

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [workflowNote, setWorkflowNote] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/investor-profit-runs/${params.id}`, {
        cache: "no-store",
      });
      const next = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.loadProfitRunDetail"));
      }
      setPayload(next as Payload);
    } catch {
      toast.error(t("errors.loadProfitRunDetail"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) void load();
  }, [params.id]);

  const act = async (action: "approve" | "reject" | "post") => {
    try {
      setActing(true);
      const response = await fetch(
        action === "post"
          ? `/api/admin/investor-profit-runs/${params.id}/post`
          : `/api/admin/investor-profit-runs/${params.id}`,
        {
          method: action === "post" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "post"
              ? { note: workflowNote }
              : { action, note: workflowNote },
          ),
        },
      );
      const next = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.updateProfitRun"));
      }
      toast.success(
        action === "post"
          ? t("success.profitRunPosted")
          : action === "approve"
            ? t("success.profitRunApproved")
            : t("success.profitRunRejected"),
      );
      setWorkflowNote("");
      await load();
    } catch {
      toast.error(t("errors.updateProfitRun"));
    } finally {
      setActing(false);
    }
  };

  if (loading || !payload) {
    return <div className="p-6 text-sm text-muted-foreground">{t("profitRunDetail.loading")}</div>;
  }

  const { run, governance, recentActivity } = payload;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{run.runNumber}</h1>
        <p className="text-sm text-muted-foreground">
          {t("profitRunDetail.description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.netProfit")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmtMoney(run.totalNetProfit, locale)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("profitRunDetail.runStatus")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{t(`enums.profitStatuses.${run.status}` as any)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.variants")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{run._count.variantLines}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.allocations")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{run._count.allocationLines}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("profitRunDetail.warnings")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{governance.nonBlockingWarnings.length}</CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("profitRunDetail.overview")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.period")}</div><div className="mt-1 font-medium">{fmtDate(run.fromDate, locale)} - {fmtDate(run.toDate, locale)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("profitRunDetail.allocationBasis")}</div><div className="mt-1 font-medium">{t(`enums.allocationBases.${run.allocationBasis}` as any)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.netRevenue")}</div><div className="mt-1 font-medium">{fmtMoney(run.totalNetRevenue, locale)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.netCogs")}</div><div className="mt-1 font-medium">{fmtMoney(run.totalNetCogs, locale)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.operatingExpense")}</div><div className="mt-1 font-medium">{fmtMoney(run.totalOperatingExpense, locale)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.createdBy")}</div><div className="mt-1 font-medium">{run.createdBy?.name || run.createdBy?.email || t("common.system")}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.approved")}</div><div className="mt-1 font-medium">{run.approvedAt ? t("common.dateByActor", { date: fmtDate(run.approvedAt, locale), actor: run.approvedBy?.name || run.approvedBy?.email || t("common.unknown") }) : "—"}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.posted")}</div><div className="mt-1 font-medium">{run.postedAt ? t("common.dateByActor", { date: fmtDate(run.postedAt, locale), actor: run.postedBy?.name || run.postedBy?.email || t("common.unknown") }) : "—"}</div></div>
            <div className="md:col-span-2"><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("profitRunDetail.runNote")}</div><div className="mt-1 whitespace-pre-wrap font-medium">{run.note || "—"}</div></div>
            <div className="md:col-span-2"><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("profitRunDetail.postingNote")}</div><div className="mt-1 whitespace-pre-wrap font-medium">{run.postingNote || "—"}</div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("profitRunDetail.governanceChecks")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("profitRunDetail.retainedVariants")}</div><div className="mt-1 font-medium">{governance.variantsWithUnallocatedCount}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("profitRunDetail.retainedShareTotal")}</div><div className="mt-1 font-medium">{(Number(governance.unallocatedShareTotal) * 100).toFixed(2)}%</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("profitRunDetail.retainedRevenue")}</div><div className="mt-1 font-medium">{fmtMoney(governance.companyRetainedRevenueTotal, locale)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("profitRunDetail.retainedProfit")}</div><div className="mt-1 font-medium">{fmtMoney(governance.companyRetainedProfitTotal, locale)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("profitRunDetail.missingAllocation")}</div><div className="mt-1 font-medium">{governance.missingSourceAllocationCount}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("profitRunDetail.inactiveAllocation")}</div><div className="mt-1 font-medium">{governance.inactiveSourceAllocationCount}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("profitRunDetail.negativeLines")}</div><div className="mt-1 font-medium">{governance.negativeDistributionCount}</div></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profitRunDetail.workflowControl")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {governance.blockingIssues.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-medium">{t("profitRunDetail.blockers")}</div>
              <ul className="mt-2 list-disc pl-5">
                {governance.blockingIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : governance.nonBlockingWarnings.length > 0 ? (
            <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm text-blue-900">
              <div className="font-medium">{t("profitRunDetail.controlledWarnings")}</div>
              <ul className="mt-2 list-disc pl-5">
                {governance.nonBlockingWarnings.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
              {t("profitRunDetail.governancePassed")}
            </div>
          )}
          <div className="space-y-1">
            <Label>{t("profitRunDetail.workflowNote")}</Label>
            <Input value={workflowNote} onChange={(event) => setWorkflowNote(event.target.value)} placeholder={t("profitRunDetail.workflowNotePlaceholder")} />
          </div>
          <div className="flex flex-wrap gap-2">
            {canApprove && run.status === "PENDING_APPROVAL" ? (
              <>
                <Button onClick={() => void act("approve")} disabled={acting || governance.blockingIssues.length > 0}>
                  {acting ? t("common.working") : t("profitRunDetail.approveRun")}
                </Button>
                <Button variant="outline" onClick={() => void act("reject")} disabled={acting}>
                  {acting ? t("common.working") : t("profitRunDetail.rejectRun")}
                </Button>
              </>
            ) : null}
            {canPost && run.status === "APPROVED" ? (
              <Button onClick={() => void act("post")} disabled={acting || governance.blockingIssues.length > 0}>
                {acting ? t("common.working") : t("profitRunDetail.postToLedger")}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="variants" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="variants">{t("common.variants")}</TabsTrigger>
          <TabsTrigger value="allocations">{t("common.allocations")}</TabsTrigger>
          <TabsTrigger value="payouts">{t("common.payouts")}</TabsTrigger>
          <TabsTrigger value="activity">{t("common.activity")}</TabsTrigger>
        </TabsList>

        <TabsContent value="variants" className="space-y-3">
          {run.variantLines.map((line) => (
            <div key={line.id} className="rounded-lg border p-4 text-sm">
              <div className="font-medium">{line.productVariant.product.name} ({line.productVariant.sku})</div>
              <div className="mt-1 text-muted-foreground">
                {t("profitRunDetail.variantLine", {
                  units: line.unitsNet,
                  revenue: fmtMoney(line.netRevenue, locale),
                  cogs: fmtMoney(line.netCogs, locale),
                  expense: fmtMoney(line.allocatedExpense, locale),
                  profit: fmtMoney(line.netProfit, locale),
                  retained: (Number(line.unallocatedSharePct) * 100).toFixed(2),
                })}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="allocations" className="space-y-3">
          {run.allocationLines.map((line) => (
            <div key={line.id} className="rounded-lg border p-4 text-sm">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div className="font-medium">
                  <Link href={`/admin/investors/${line.investor.id}`} className="hover:text-primary">
                    {line.investor.name} ({line.investor.code})
                  </Link>
                </div>
                {line.sourceAllocation ? (
                  <Link href={`/admin/investors/allocations/${line.sourceAllocation.id}`} className="text-muted-foreground hover:text-primary">
                    {t("profitRunDetail.sourceAllocation", { id: line.sourceAllocation.id })}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{t("profitRunDetail.noSourceAllocation")}</span>
                )}
              </div>
              <div className="mt-1 text-muted-foreground">
                {line.productVariant.product.name} ({line.productVariant.sku}) | {t("profitRunDetail.allocationLine", {
                  share: (Number(line.participationSharePct) * 100).toFixed(2),
                  revenue: fmtMoney(line.allocatedRevenue, locale),
                  profit: fmtMoney(line.allocatedNetProfit, locale),
                })}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="payouts" className="space-y-3">
          {run.payouts.length > 0 ? (
            run.payouts.map((item) => (
              <div key={item.id} className="rounded-lg border p-4 text-sm">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div className="font-medium">{item.payoutNumber}</div>
                  <div className="text-muted-foreground">{t(`enums.payoutStatuses.${item.status}` as any)}</div>
                </div>
                <div className="mt-1 text-muted-foreground">
                  <Link href={`/admin/investors/${item.investor.id}`} className="hover:text-primary">
                    {item.investor.name} ({item.investor.code})
                  </Link>{" "}
                  | {t("profitRunDetail.payoutLine", { amount: fmtMoney(item.payoutAmount, locale), paid: fmtDate(item.paidAt, locale) })}
                </div>
                {item.transaction ? (
                  <div className="mt-1 text-muted-foreground">
                    {t("common.ledger")}: <Link href={`/admin/investors/ledger/${item.transaction.id}`} className="hover:text-primary">{item.transaction.transactionNumber}</Link>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {t("profitRunDetail.noPayoutDrafts")}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-3">
          {recentActivity.length > 0 ? (
            recentActivity.map((item) => (
              <div key={item.id} className="rounded-lg border p-4 text-sm">
                <div className="font-medium">{item.metadata?.message || `${item.action} ${item.entity}`}</div>
                <div className="mt-1 text-muted-foreground">
                  {item.actorName || item.actorEmail || t("common.system")} | {fmtDate(item.createdAt, locale)}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {t("profitRunDetail.noActivity")}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
