"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Payload = {
  transaction: {
    id: number;
    transactionNumber: string;
    transactionDate: string;
    type: string;
    direction: string;
    amount: string;
    currency: string;
    note: string | null;
    referenceType: string | null;
    referenceNumber: string | null;
    createdAt: string;
    runningBalance: string;
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
      product: { id: number; name: string };
    } | null;
    createdBy: { id: string; name: string | null; email: string } | null;
    payout: {
      id: number;
      payoutNumber: string;
      status: string;
      paidAt: string | null;
      payoutAmount: string;
    } | null;
  };
  investorTotals: {
    credit: string;
    debit: string;
    balance: string;
  };
  relatedTransactions: Array<{
    id: number;
    transactionNumber: string;
    transactionDate: string;
    type: string;
    direction: string;
    amount: string;
    currency: string;
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

export default function InvestorTransactionDetailPage() {
  const t = useTranslations("AdminInvestors.pages");
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/investor-transactions/${params.id}`, {
          cache: "no-store",
        });
        const next = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(t("errors.loadTransactionDetail"));
        }
        setPayload(next as Payload);
      } catch {
        toast.error(t("errors.loadTransactionDetail"));
      } finally {
        setLoading(false);
      }
    };
    if (params.id) void load();
  }, [params.id, t]);

  if (loading || !payload) {
    return <div className="p-6 text-sm text-muted-foreground">{t("ledgerDetail.loading")}</div>;
  }

  const { transaction, investorTotals, relatedTransactions } = payload;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{transaction.transactionNumber}</h1>
        <p className="text-sm text-muted-foreground">
          {t("ledgerDetail.description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.amount")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmtMoney(transaction.amount, locale)} {transaction.currency}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.direction")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{t(`enums.directions.${transaction.direction}` as any)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("ledgerDetail.runningBalance")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmtMoney(transaction.runningBalance, locale)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("ledgerDetail.investorTotalBalance")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmtMoney(investorTotals.balance, locale)}</CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("ledgerDetail.context")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.investor")}</div><Link className="mt-1 block font-medium hover:text-primary" href={`/admin/investors/${transaction.investor.id}`}>{transaction.investor.name} ({transaction.investor.code})</Link></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.type")}</div><div className="mt-1 font-medium">{t(`enums.transactionTypes.${transaction.type}` as any)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("ledgerDetail.transactionDate")}</div><div className="mt-1 font-medium">{fmtDate(transaction.transactionDate, locale)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.createdAt")}</div><div className="mt-1 font-medium">{fmtDate(transaction.createdAt, locale)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("ledgerDetail.referenceType")}</div><div className="mt-1 font-medium">{transaction.referenceType || "—"}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("ledgerDetail.referenceNumber")}</div><div className="mt-1 font-medium">{transaction.referenceNumber || "—"}</div></div>
            <div className="md:col-span-2"><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.note")}</div><div className="mt-1 whitespace-pre-wrap font-medium">{transaction.note || "—"}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.createdBy")}</div><div className="mt-1 font-medium">{transaction.createdBy?.name || transaction.createdBy?.email || t("common.system")}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("ledgerDetail.linkedVariant")}</div><div className="mt-1 font-medium">{transaction.productVariant ? `${transaction.productVariant.product.name} (${transaction.productVariant.sku})` : "—"}</div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("ledgerDetail.downstreamLink")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.investorStatus")}</div><div className="mt-1 font-medium">{t(`enums.investorStatuses.${transaction.investor.status}` as any)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.kycStatus")}</div><div className="mt-1 font-medium">{t(`enums.kycStatuses.${transaction.investor.kycStatus}` as any)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("ledgerDetail.linkedPayout")}</div>{transaction.payout ? <Link href={`/admin/investors/payouts`} className="mt-1 block font-medium hover:text-primary">{transaction.payout.payoutNumber} | {t(`enums.payoutStatuses.${transaction.payout.status}` as any)}</Link> : <div className="mt-1 font-medium">{t("ledgerDetail.noLinkedPayout")}</div>}</div>
            {transaction.payout ? <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("ledgerDetail.payoutAmount")}</div><div className="mt-1 font-medium">{fmtMoney(transaction.payout.payoutAmount, locale)}</div></div> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("ledgerDetail.relatedTransactions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {relatedTransactions.length > 0 ? (
            relatedTransactions.map((item) => (
              <Link
                key={item.id}
                href={`/admin/investors/ledger/${item.id}`}
                className="block rounded-lg border p-3 text-sm hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="font-medium">{item.transactionNumber}</div>
                <div className="text-muted-foreground">
                  {t(`enums.transactionTypes.${item.type}` as any)} | {t(`enums.directions.${item.direction}` as any)} | {fmtMoney(item.amount, locale)} {item.currency} | {fmtDate(item.transactionDate, locale)}
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {t("ledgerDetail.noRelatedTransactions")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
