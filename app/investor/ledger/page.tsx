"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SkeletonCards, SkeletonTable } from "@/components/investor/InvestorSkeleton";
import { statusBadge, shortDateTime } from "@/lib/investor-status";

type LedgerPayload = {
  totals: { credit: string; debit: string; balance: string };
  transactions: Array<{
    id: number;
    transactionNumber: string;
    transactionDate: string;
    type: string;
    direction: string;
    amount: string;
    currency: string;
    note: string | null;
    productVariant: {
      id: number;
      sku: string;
      product: { id: number; name: string };
    } | null;
  }>;
};

function fmtAmount(value: string, locale: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvestorLedgerPage() {
  const t = useTranslations("InvestorPortal");
  const locale = useLocale();
  const [data, setData] = useState<LedgerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (typeFilter.trim()) params.set("type", typeFilter.trim().toUpperCase());
        const response = await fetch(`/api/investor/ledger?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || t("errors.loadLedger"));
        if (active) setData(payload as LedgerPayload);
      } catch (err: any) {
        if (active) setError(err?.message || t("errors.loadLedger"));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [typeFilter, t]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{t("ledger.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("ledger.description")}</p>
      </div>

      {loading ? (
        <>
          <SkeletonCards count={3} />
          <Card>
            <CardHeader><div className="h-4 w-32 animate-pulse rounded bg-muted" /></CardHeader>
            <CardContent><SkeletonTable rows={6} cols={7} /></CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("ledger.summary")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">{t("common.credit")}</p>
                <p className="text-xl font-semibold">{fmtAmount(data?.totals.credit || "0", locale)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("common.debit")}</p>
                <p className="text-xl font-semibold">{fmtAmount(data?.totals.debit || "0", locale)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("common.balance")}</p>
                <p className="text-xl font-semibold">{fmtAmount(data?.totals.balance || "0", locale)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("common.transactions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder={t("ledger.filterPlaceholder")}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full md:max-w-sm"
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="space-y-3 md:hidden">
                {(data?.transactions || []).map((item) => {
                  const badge = statusBadge(item.direction, t(`statuses.${item.direction}` as any));
                  return (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">{item.transactionNumber}</p>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>{t("common.date")}: <span className="font-medium text-foreground">{shortDateTime(item.transactionDate, locale)}</span></div>
                        <div>{t("common.type")}: <span className="font-medium text-foreground">{t.has(`transactionTypes.${item.type}` as any) ? t(`transactionTypes.${item.type}` as any) : item.type}</span></div>
                        <div>{t("common.amount")}: <span className="font-medium text-foreground">{fmtAmount(item.amount, locale)} {item.currency}</span></div>
                        <div className="col-span-2">{t("common.product")}: <span className="font-medium text-foreground">{item.productVariant ? `${item.productVariant.product.name} (${item.productVariant.sku})` : "—"}</span></div>
                        <div className="col-span-2">{t("common.note")}: <span className="font-medium text-foreground">{item.note || "—"}</span></div>
                      </div>
                    </div>
                  );
                })}
                {data?.transactions?.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">{t("common.noTransactions")}</p>
                ) : null}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.number")}</TableHead>
                      <TableHead>{t("common.date")}</TableHead>
                      <TableHead>{t("common.type")}</TableHead>
                      <TableHead>{t("common.direction")}</TableHead>
                      <TableHead>{t("common.amount")}</TableHead>
                      <TableHead>{t("common.product")}</TableHead>
                      <TableHead>{t("common.note")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.transactions || []).map((item) => {
                      const badge = statusBadge(item.direction, t(`statuses.${item.direction}` as any));
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="whitespace-nowrap font-medium">{item.transactionNumber}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{shortDateTime(item.transactionDate, locale)}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{t.has(`transactionTypes.${item.type}` as any) ? t(`transactionTypes.${item.type}` as any) : item.type}</TableCell>
                          <TableCell>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-medium">
                            {fmtAmount(item.amount, locale)} {item.currency}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.productVariant
                              ? `${item.productVariant.product.name} (${item.productVariant.sku})`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.note || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                    {data?.transactions?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                          {t("common.noTransactions")}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
