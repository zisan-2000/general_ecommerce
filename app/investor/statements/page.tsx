"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportInvestorStatementPdf } from "@/lib/export-investor-statement-pdf";
import { Badge } from "@/components/ui/badge";
import { SkeletonTable } from "@/components/investor/InvestorSkeleton";
import { statusBadge, shortDateTime } from "@/lib/investor-status";

type StatementPayload = {
  investor: {
    id: number;
    code: string;
    name: string;
  };
  from: string;
  to: string;
  totals: {
    credit: string;
    debit: string;
    net: string;
  };
  transactions: Array<{
    id: number;
    transactionNumber: string;
    transactionDate: string;
    type: string;
    direction: string;
    amount: string;
    currency: string;
  }>;
  payouts: Array<{
    id: number;
    payoutNumber: string;
    status: string;
    payoutAmount: string;
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

function toInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}


export default function InvestorStatementsPage() {
  const t = useTranslations("InvestorPortal");
  const locale = useLocale();
  const defaultFrom = useMemo(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return toInputDate(from);
  }, []);
  const defaultTo = useMemo(() => toInputDate(new Date()), []);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatementPayload | null>(null);

  const load = async (queryFrom: string, queryTo: string) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ from: queryFrom, to: queryTo });
      const response = await fetch(`/api/investor/statements?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || t("errors.loadStatements"));
      setData(payload as StatementPayload);
    } catch (err: any) {
      setError(err?.message || t("errors.loadStatements"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(defaultFrom, defaultTo);
  }, [defaultFrom, defaultTo]);

  const downloadCsv = async () => {
    try {
      setExportingCsv(true);
      const params = new URLSearchParams({ from, to, format: "csv" });
      const response = await fetch(`/api/investor/statements?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || t("errors.exportCsv"));
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `investor-statement-${from}-to-${to}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message || t("errors.exportCsv"));
    } finally {
      setExportingCsv(false);
    }
  };

  const downloadPdf = async () => {
    try {
      if (!data) {
        throw new Error(t("errors.loadBeforePdf"));
      }
      setExportingPdf(true);
      await exportInvestorStatementPdf({
        fileName: `investor-statement-${from}-to-${to}.pdf`,
        title: "Investor Statement",
        from: data.from,
        to: data.to,
        statements: [
          {
            investorCode: data.investor.code,
            investorName: data.investor.name,
            summary: data.totals,
            transactions: data.transactions,
            payouts: data.payouts,
          },
        ],
      });
    } catch (err: any) {
      toast.error(err?.message || t("errors.exportPdf"));
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{t("statements.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("statements.description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("statements.filters")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-1">
              <Label>{t("common.from")}</Label>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("common.to")}</Label>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 md:col-span-1">
              <Button onClick={() => void load(from, to)}>{t("common.apply")}</Button>
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => void downloadCsv()} disabled={exportingCsv}>
                {exportingCsv ? t("common.exporting") : t("statements.exportCsv")}
              </Button>
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => void downloadPdf()} disabled={!data || exportingPdf}>
                {exportingPdf ? t("common.exporting") : t("statements.exportPdf")}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t("common.credit")}</p>
              <p className="text-xl font-semibold">{fmtAmount(data?.totals.credit || "0", locale)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t("common.debit")}</p>
              <p className="text-xl font-semibold">{fmtAmount(data?.totals.debit || "0", locale)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t("common.net")}</p>
              <p className="text-xl font-semibold">{fmtAmount(data?.totals.net || "0", locale)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("common.transactions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {loading ? <SkeletonTable rows={5} cols={5} /> : (
            <>
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
                      <div className="col-span-2">{t("common.amount")}: <span className="font-medium text-foreground">{fmtAmount(item.amount, locale)} {item.currency}</span></div>
                    </div>
                  </div>
                );
              })}
              {data?.transactions?.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">{t("statements.noTransactions")}</p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.transactions || []).map((item) => {
                    const badge = statusBadge(item.direction, t(`statuses.${item.direction}` as any));
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap font-medium">{item.transactionNumber}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{shortDateTime(item.transactionDate, locale)}</TableCell>
                        <TableCell className="text-sm">{t.has(`transactionTypes.${item.type}` as any) ? t(`transactionTypes.${item.type}` as any) : item.type}</TableCell>
                        <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          {fmtAmount(item.amount, locale)} {item.currency}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {data?.transactions?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        {t("statements.noTransactions")}
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
          <CardTitle className="text-base">{t("common.payouts")}</CardTitle>
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
                      <div>{t("common.created")}: <span className="font-medium text-foreground">{shortDateTime(item.createdAt, locale)}</span></div>
                      <div className="col-span-2">{t("common.paid")}: <span className="font-medium text-foreground">{shortDateTime(item.paidAt, locale)}</span></div>
                    </div>
                  </div>
                );
              })}
              {data?.payouts?.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">{t("statements.noPayouts")}</p>
              ) : null}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.payout")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("common.amount")}</TableHead>
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
                        <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          {fmtAmount(item.payoutAmount, locale)} {item.currency}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{shortDateTime(item.createdAt, locale)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{shortDateTime(item.paidAt, locale)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {data?.payouts?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        {t("statements.noPayouts")}
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
