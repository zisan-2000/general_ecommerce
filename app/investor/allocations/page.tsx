"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonTable } from "@/components/investor/InvestorSkeleton";
import { statusBadge, shortDate } from "@/lib/investor-status";

type AllocationPayload = {
  allocations: Array<{
    id: number;
    status: string;
    participationPercent: string;
    committedAmount: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    note: string | null;
    productVariant: {
      id: number;
      sku: string;
      product: { id: number; name: string };
    };
  }>;
};

function fmtAmount(value: string, locale: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvestorAllocationsPage() {
  const t = useTranslations("InvestorPortal");
  const locale = useLocale();
  const [data, setData] = useState<AllocationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/investor/allocations", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || t("errors.loadAllocations"));
        if (active) setData(payload as AllocationPayload);
      } catch (err: any) {
        if (active) setError(err?.message || t("errors.loadAllocations"));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [t]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{t("allocations.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("allocations.description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("allocations.register")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {loading ? (
            <SkeletonTable rows={5} cols={6} />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {(data?.allocations || []).map((item) => {
                  const badge = statusBadge(item.status, t(`statuses.${item.status}` as any));
                  return (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">
                          {item.productVariant.product.name}
                          <span className="ml-1 text-xs text-muted-foreground">({item.productVariant.sku})</span>
                        </p>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>{t("common.share")}: <span className="font-medium text-foreground">{fmtAmount(item.participationPercent, locale)}%</span></div>
                        <div>{t("common.committed")}: <span className="font-medium text-foreground">{fmtAmount(item.committedAmount, locale)}</span></div>
                        <div className="col-span-2">{t("common.effective")}: <span className="font-medium text-foreground">{shortDate(item.effectiveFrom, locale)} - {item.effectiveTo ? shortDate(item.effectiveTo, locale) : t("common.ongoing")}</span></div>
                        <div className="col-span-2">{t("common.note")}: <span className="font-medium text-foreground">{item.note || "—"}</span></div>
                      </div>
                    </div>
                  );
                })}
                {data?.allocations?.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">{t("common.noAllocations")}</p>
                ) : null}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.product")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("common.sharePercent")}</TableHead>
                      <TableHead>{t("common.committed")}</TableHead>
                      <TableHead>{t("common.effective")}</TableHead>
                      <TableHead>{t("common.note")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.allocations || []).map((item) => {
                      const badge = statusBadge(item.status, t(`statuses.${item.status}` as any));
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.productVariant.product.name}
                            <span className="ml-1 text-xs text-muted-foreground">({item.productVariant.sku})</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </TableCell>
                          <TableCell>{fmtAmount(item.participationPercent, locale)}%</TableCell>
                          <TableCell className="whitespace-nowrap font-medium">{fmtAmount(item.committedAmount, locale)}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {shortDate(item.effectiveFrom, locale)} - {item.effectiveTo ? shortDate(item.effectiveTo, locale) : t("common.ongoing")}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.note || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                    {data?.allocations?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          {t("common.noAllocations")}
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
