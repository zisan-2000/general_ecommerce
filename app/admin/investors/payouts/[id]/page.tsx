"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload-file";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Payload = {
  payout: {
    id: number;
    payoutNumber: string;
    payoutAmount: string;
    grossProfitAmount: string;
    holdbackAmount: string;
    holdbackPercent: string;
    payoutPercent: string;
    status: string;
    currency: string;
    paymentMethod: string | null;
    bankReference: string | null;
    note: string | null;
    approvalNote: string | null;
    rejectionReason: string | null;
    beneficiaryNameSnapshot: string | null;
    beneficiaryBankNameSnapshot: string | null;
    beneficiaryAccountNumberSnapshot: string | null;
    beneficiaryVerifiedAt: string | null;
    beneficiaryVerificationNote: string | null;
    holdReason: string | null;
    heldAt: string | null;
    releasedAt: string | null;
    releaseNote: string | null;
    paymentProofUrl: string | null;
    paymentProofUploadedAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    paidAt: string | null;
    voidedAt: string | null;
    voidReason: string | null;
    voidReversalReference: string | null;
    investor: {
      id: number;
      code: string;
      name: string;
      status: string;
      bankName: string | null;
      bankAccountName: string | null;
      bankAccountNumber: string | null;
      beneficiaryVerifiedAt: string | null;
      beneficiaryVerificationNote: string | null;
    };
    run: {
      id: number;
      runNumber: string;
      status: string;
      fromDate: string;
      toDate: string;
    };
    transaction: {
      id: number;
      transactionNumber: string;
      transactionDate: string;
      amount: string;
    } | null;
  };
  readiness: {
    beneficiaryVerified: boolean;
    onHold: boolean;
    canPay: boolean;
  };
  recentActivity: Array<{
    id: string;
    action: string;
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

function maskAccount(value?: string | null) {
  if (!value) return "—";
  if (value.length <= 4) return value;
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

export default function InvestorPayoutDetailPage() {
  const t = useTranslations("AdminInvestors.pages");
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.globalPermissions)
    ? ((session?.user as any).globalPermissions as string[])
    : [];
  const canApprove = permissions.includes("investor_payout.approve");
  const canPay = permissions.includes("investor_payout.pay");
  const canVoid = permissions.includes("investor_payout.void");
  const canManage = permissions.includes("investor_payout.manage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [note, setNote] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paidAt, setPaidAt] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadedProofUrl, setUploadedProofUrl] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/investor-payouts/${params.id}`, {
        cache: "no-store",
      });
      const next = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.loadPayoutDetail"));
      }
      const data = next as Payload;
      setPayload(data);
      setBankReference(data.payout.bankReference || "");
      setPaymentMethod(data.payout.paymentMethod || "BANK_TRANSFER");
      setPaidAt(data.payout.paidAt ? data.payout.paidAt.slice(0, 16) : "");
      setUploadedProofUrl(data.payout.paymentProofUrl || "");
    } catch {
      toast.error(t("errors.loadPayoutDetail"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) void load();
  }, [params.id]);

  const act = async (action: "approve" | "reject" | "hold" | "release" | "pay" | "void") => {
    try {
      setSaving(true);
      let paymentProofUrl = uploadedProofUrl;
      if (action === "pay" && file) {
        paymentProofUrl = await uploadFile(file, "/api/upload/investor-payout-proof");
        setUploadedProofUrl(paymentProofUrl);
      }

      const response = await fetch(`/api/admin/investor-payouts/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note,
          holdReason: note,
          releaseNote: note,
          paymentMethod,
          bankReference,
          paidAt: paidAt || null,
          paymentProofUrl: paymentProofUrl || null,
          voidReason,
        }),
      });
      const next = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.processPayout"));
      }
      toast.success(t("success.payoutAction", { action: t(`enums.actions.${action}` as any) }));
      setNote("");
      setFile(null);
      await load();
    } catch {
      toast.error(t("errors.processPayout"));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !payload) {
    return <div className="p-6 text-sm text-muted-foreground">{t("payoutDetail.loading")}</div>;
  }

  const { payout, readiness, recentActivity } = payload;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{payout.payoutNumber}</h1>
        <p className="text-sm text-muted-foreground">
          {t("payoutDetail.description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("payoutDetail.payoutAmount")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmtMoney(payout.payoutAmount, locale)} {payout.currency}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("payoutDetail.grossProfit")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmtMoney(payout.grossProfitAmount, locale)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("payoutDetail.holdback")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmtMoney(payout.holdbackAmount, locale)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.status")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{t(`enums.payoutStatuses.${payout.status}` as any)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("payoutDetail.onHold")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{readiness.onHold ? t("common.yes") : t("common.no")}</CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("payoutDetail.context")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.investor")}</div><Link href={`/admin/investors/${payout.investor.id}`} className="mt-1 block font-medium hover:text-primary">{payout.investor.name} ({payout.investor.code})</Link></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.run")}</div><Link href={`/admin/investors/profit-runs/${payout.run.id}`} className="mt-1 block font-medium hover:text-primary">{payout.run.runNumber}</Link></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.approved")}</div><div className="mt-1 font-medium">{fmtDate(payout.approvedAt, locale)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.paid")}</div><div className="mt-1 font-medium">{fmtDate(payout.paidAt, locale)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("payoutDetail.holdReason")}</div><div className="mt-1 font-medium">{payout.holdReason || "—"}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("payoutDetail.releaseNote")}</div><div className="mt-1 font-medium">{payout.releaseNote || "—"}</div></div>
            <div className="md:col-span-2"><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("payoutDetail.executionNote")}</div><div className="mt-1 whitespace-pre-wrap font-medium">{payout.note || "—"}</div></div>
            {payout.transaction ? (
              <div className="md:col-span-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("payoutDetail.ledgerTransaction")}</div>
                <Link href={`/admin/investors/ledger/${payout.transaction.id}`} className="mt-1 block font-medium hover:text-primary">
                  {payout.transaction.transactionNumber}
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("payoutDetail.beneficiaryReadiness")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("payoutDetail.investorBeneficiaryVerified")}</div><div className="mt-1 font-medium">{fmtDate(payout.investor.beneficiaryVerifiedAt, locale)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("payoutDetail.snapshotVerified")}</div><div className="mt-1 font-medium">{fmtDate(payout.beneficiaryVerifiedAt, locale)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("payoutDetail.beneficiaryName")}</div><div className="mt-1 font-medium">{payout.beneficiaryNameSnapshot || "—"}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.bank")}</div><div className="mt-1 font-medium">{payout.beneficiaryBankNameSnapshot || "—"}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.account")}</div><div className="mt-1 font-medium">{maskAccount(payout.beneficiaryAccountNumberSnapshot)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("payoutDetail.verificationNote")}</div><div className="mt-1 font-medium">{payout.beneficiaryVerificationNote || "—"}</div></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("payoutDetail.executionControls")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!readiness.beneficiaryVerified ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              {t("payoutDetail.beneficiaryWarning")}
            </div>
          ) : null}
          {readiness.onHold ? (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              {t("payoutDetail.holdWarning")}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("payoutDetail.workflowNote")}</Label>
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>{t("payoutDetail.voidReason")}</Label>
              <Textarea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>{t("payoutDetail.paymentMethod")}</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                <option value="BANK_TRANSFER">{t("enums.paymentMethods.BANK_TRANSFER")}</option>
                <option value="MOBILE_BANKING">{t("enums.paymentMethods.MOBILE_BANKING")}</option>
                <option value="CHEQUE">{t("enums.paymentMethods.CHEQUE")}</option>
                <option value="CASH">{t("enums.paymentMethods.CASH")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t("payoutDetail.bankReference")}</Label>
              <Input value={bankReference} onChange={(event) => setBankReference(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("payoutDetail.paidAt")}</Label>
              <Input type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("payoutDetail.paymentProof")}</Label>
              <Input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              {uploadedProofUrl ? (
                <a href={uploadedProofUrl} className="text-xs text-primary underline" target="_blank" rel="noreferrer">
                  {t("payoutDetail.viewProof")}
                </a>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canApprove && payout.status === "PENDING_APPROVAL" ? (
              <>
                <Button onClick={() => void act("approve")} disabled={saving || !readiness.beneficiaryVerified}>
                  {saving ? t("common.working") : t("common.approve")}
                </Button>
                <Button variant="outline" onClick={() => void act("reject")} disabled={saving}>
                  {saving ? t("common.working") : t("common.reject")}
                </Button>
              </>
            ) : null}
            {(canManage || canApprove || canPay) && ["PENDING_APPROVAL", "APPROVED"].includes(payout.status) && !readiness.onHold ? (
              <Button variant="outline" onClick={() => void act("hold")} disabled={saving}>
                {saving ? t("common.working") : t("common.hold")}
              </Button>
            ) : null}
            {(canManage || canApprove || canPay) && readiness.onHold ? (
              <Button variant="outline" onClick={() => void act("release")} disabled={saving}>
                {saving ? t("common.working") : t("payoutDetail.releaseHold")}
              </Button>
            ) : null}
            {canPay && payout.status === "APPROVED" ? (
              <Button onClick={() => void act("pay")} disabled={saving || !readiness.canPay}>
                {saving ? t("common.working") : t("payoutDetail.markPaid")}
              </Button>
            ) : null}
            {canVoid && (payout.status === "APPROVED" || payout.status === "PAID") ? (
              <Button variant="destructive" onClick={() => void act("void")} disabled={saving}>
                {saving ? t("common.working") : t("common.void")}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="activity">{t("common.activity")}</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="space-y-3">
          {recentActivity.length > 0 ? (
            recentActivity.map((item) => (
              <div key={item.id} className="rounded-lg border p-4 text-sm">
                <div className="font-medium">{item.metadata?.message || item.action}</div>
                <div className="mt-1 text-muted-foreground">
                  {item.actorName || item.actorEmail || t("common.system")} | {fmtDate(item.createdAt, locale)}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {t("payoutDetail.noActivity")}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
