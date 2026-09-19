"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Person = { id: string; name: string | null; email: string };

type InvestorDetail = {
  id: number;
  code: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  taxNumber: string | null;
  nationalIdNumber: string | null;
  passportNumber: string | null;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
    beneficiaryVerifiedAt: string | null;
    beneficiaryVerificationNote: string | null;
    status: string;
  kycStatus: string;
  kycVerifiedAt: string | null;
  kycReference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: Person | null;
  portalAccesses: Array<{
    id: number;
    status: string;
    createdAt: string;
    user: Person;
  }>;
  documents: Array<{
    id: number;
    type: string;
    status: string;
    isExpired: boolean;
  }>;
  _count: {
    transactions: number;
    allocations: number;
    payouts: number;
    documents: number;
    changeRequests: number;
  };
  totals: {
    credit: string;
    debit: string;
    balance: string;
  };
};

type ChangeRequest = {
  id: number;
  status: string;
  requestedChanges: Record<string, unknown>;
  currentSnapshot: Record<string, unknown> | null;
  changeSummary: string | null;
  reviewNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  appliedAt: string | null;
  requestedBy: Person | null;
  reviewedBy: Person | null;
};

type ActivityItem = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  metadata?: { message?: string } | null;
};

type DetailPayload = {
  investor: InvestorDetail;
  changeRequests: ChangeRequest[];
  recentActivity: ActivityItem[];
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

export default function InvestorDetailPage() {
  const t = useTranslations("AdminInvestors.pages");
  const locale = useLocale();
  const enumLabel = (group: string, value: string) => {
    const key = `enums.${group}.${value}` as any;
    return t.has(key) ? t(key) : value;
  };
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const globalPermissions = Array.isArray((session?.user as any)?.globalPermissions)
    ? ((session?.user as any).globalPermissions as string[])
    : [];
  const canManage = globalPermissions.includes("investors.manage");

  const [loading, setLoading] = useState(true);
  const [savingDirect, setSavingDirect] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);
  const [savingBeneficiary, setSavingBeneficiary] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [directForm, setDirectForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [requestForm, setRequestForm] = useState({
    legalName: "",
    taxNumber: "",
    nationalIdNumber: "",
    passportNumber: "",
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
    status: "ACTIVE",
    kycReference: "",
    changeSummary: "",
  });
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/investors/${params.id}`, { cache: "no-store" });
      const next = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.loadInvestorDetail"));
      }
      const data = next as DetailPayload;
      setPayload(data);
      setDirectForm({
        name: data.investor.name ?? "",
        email: data.investor.email ?? "",
        phone: data.investor.phone ?? "",
        notes: data.investor.notes ?? "",
      });
      setRequestForm({
        legalName: data.investor.legalName ?? "",
        taxNumber: data.investor.taxNumber ?? "",
        nationalIdNumber: data.investor.nationalIdNumber ?? "",
        passportNumber: data.investor.passportNumber ?? "",
        bankName: data.investor.bankName ?? "",
        bankAccountName: data.investor.bankAccountName ?? "",
        bankAccountNumber: data.investor.bankAccountNumber ?? "",
        status: data.investor.status ?? "ACTIVE",
        kycReference: data.investor.kycReference ?? "",
        changeSummary: "",
      });
    } catch {
      toast.error(t("errors.loadInvestorDetail"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      void load();
    }
  }, [params.id]);

  const documentSummary = useMemo(() => {
    const docs = payload?.investor.documents ?? [];
    return {
      verified: docs.filter((item) => item.status === "VERIFIED").length,
      pending: docs.filter((item) => item.status === "PENDING" || item.status === "UNDER_REVIEW")
        .length,
      expired: docs.filter((item) => item.isExpired).length,
    };
  }, [payload]);

  const saveDirect = async () => {
    try {
      setSavingDirect(true);
      const response = await fetch(`/api/admin/investors/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(directForm),
      });
      const next = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.updateInvestor"));
      }
      toast.success(t("success.investorUpdated"));
      await load();
    } catch {
      toast.error(t("errors.updateInvestor"));
    } finally {
      setSavingDirect(false);
    }
  };

  const submitChangeRequest = async () => {
    try {
      setSavingRequest(true);
      const response = await fetch(`/api/admin/investors/${params.id}/change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestForm),
      });
      const next = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.submitChangeRequest"));
      }
      toast.success(t("success.changeRequestSubmitted"));
      setRequestForm((current) => ({ ...current, changeSummary: "" }));
      await load();
    } catch {
      toast.error(t("errors.submitChangeRequest"));
    } finally {
      setSavingRequest(false);
    }
  };

  const reviewChangeRequest = async (changeRequestId: number, action: "approve" | "reject") => {
    try {
      setReviewingId(changeRequestId);
      const response = await fetch(`/api/admin/investor-change-requests/${changeRequestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewNote: reviewNotes[changeRequestId] || "",
        }),
      });
      const next = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.reviewChangeRequest"));
      }
      toast.success(
        action === "approve" ? t("success.changeRequestApproved") : t("success.changeRequestRejected"),
      );
      await load();
    } catch {
      toast.error(t("errors.reviewChangeRequest"));
    } finally {
      setReviewingId(null);
    }
  };

  const updateBeneficiaryVerification = async (action: "verify" | "revoke") => {
    try {
      setSavingBeneficiary(true);
      const response = await fetch(
        `/api/admin/investors/${params.id}/beneficiary-verification`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note:
              action === "verify"
                ? t("investorDetail.verifyAuditNote")
                : t("investorDetail.revokeAuditNote"),
          }),
        },
      );
      const next = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.updateBeneficiary"));
      }
      toast.success(
        action === "verify"
          ? t("success.beneficiaryVerified")
          : t("success.beneficiaryRevoked"),
      );
      await load();
    } catch {
      toast.error(t("errors.updateBeneficiary"));
    } finally {
      setSavingBeneficiary(false);
    }
  };

  if (loading || !payload) {
    return <div className="p-6 text-sm text-muted-foreground">{t("investorDetail.loading")}</div>;
  }

  const { investor, changeRequests, recentActivity } = payload;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {investor.name} <span className="text-muted-foreground">({investor.code})</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("investorDetail.description")}
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {t("investorDetail.statusLine", {
            status: enumLabel("investorStatuses", investor.status),
            kyc: enumLabel("kycStatuses", investor.kycStatus),
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.netBalance")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmtMoney(investor.totals.balance, locale)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.allocations")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{investor._count.allocations}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.payouts")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{investor._count.payouts}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.documents")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{investor._count.documents}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("investorDetail.pendingChanges")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{changeRequests.filter((item) => item.status === "PENDING").length}</CardContent></Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">{t("common.overview")}</TabsTrigger>
          <TabsTrigger value="direct">{t("investorDetail.directUpdates")}</TabsTrigger>
          <TabsTrigger value="requests">{t("investorDetail.sensitiveChanges")}</TabsTrigger>
          <TabsTrigger value="activity">{t("common.activity")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("investorDetail.master")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.legalName")}</div><div className="mt-1 font-medium">{investor.legalName || "—"}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.email")}</div><div className="mt-1 font-medium">{investor.email || "—"}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.phone")}</div><div className="mt-1 font-medium">{investor.phone || "—"}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.kycReference")}</div><div className="mt-1 font-medium">{investor.kycReference || "—"}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.taxNumber")}</div><div className="mt-1 font-medium">{investor.taxNumber || "—"}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.nationalId")}</div><div className="mt-1 font-medium">{investor.nationalIdNumber || "—"}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.passport")}</div><div className="mt-1 font-medium">{investor.passportNumber || "—"}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.createdBy")}</div><div className="mt-1 font-medium">{investor.createdBy?.name || investor.createdBy?.email || "—"}</div></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("investorDetail.bankCompliance")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.bankName")}</div><div className="mt-1 font-medium">{investor.bankName || "—"}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.accountName")}</div><div className="mt-1 font-medium">{investor.bankAccountName || "—"}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.accountNumber")}</div><div className="mt-1 font-medium">{maskAccount(investor.bankAccountNumber)}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("investorDetail.kycVerifiedAt")}</div><div className="mt-1 font-medium">{fmtDate(investor.kycVerifiedAt, locale)}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("investorDetail.beneficiaryVerified")}</div><div className="mt-1 font-medium">{fmtDate(investor.beneficiaryVerifiedAt, locale)}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("investorDetail.beneficiaryNote")}</div><div className="mt-1 font-medium">{investor.beneficiaryVerificationNote || "—"}</div></div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => updateBeneficiaryVerification("verify")} disabled={!canManage || savingBeneficiary}>
                    {savingBeneficiary ? t("common.working") : t("investorDetail.verifyBeneficiary")}
                  </Button>
                  {investor.beneficiaryVerifiedAt ? (
                    <Button size="sm" variant="outline" onClick={() => updateBeneficiaryVerification("revoke")} disabled={!canManage || savingBeneficiary}>
                      {t("common.revoke")}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("investorDetail.portalDocumentSummary")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("investorDetail.verifiedDocs")}</div><div className="mt-1 text-2xl font-semibold">{documentSummary.verified}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("investorDetail.pendingDocs")}</div><div className="mt-1 text-2xl font-semibold">{documentSummary.pending}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("investorDetail.expiredDocs")}</div><div className="mt-1 text-2xl font-semibold">{documentSummary.expired}</div></div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t("investorDetail.portalAccess")}</div>
                  {investor.portalAccesses.length > 0 ? (
                    investor.portalAccesses.map((item) => (
                      <div key={item.id} className="rounded-lg border p-3 text-sm">
                        <div className="font-medium">{item.user.name || item.user.email}</div>
                        <div className="text-muted-foreground">
                          {enumLabel("accessStatuses", item.status)} | {t("common.createdDate", { date: fmtDate(item.createdAt, locale) })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                      {t("investorDetail.noPortalAccess")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("investorDetail.governanceNotes")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.createdAt")}</div><div className="mt-1 font-medium">{fmtDate(investor.createdAt, locale)}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.lastUpdated")}</div><div className="mt-1 font-medium">{fmtDate(investor.updatedAt, locale)}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.notes")}</div><div className="mt-1 whitespace-pre-wrap font-medium">{investor.notes || "—"}</div></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="direct" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("investorDetail.directProfileUpdates")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("investorDetail.directDescription")}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t("common.name")}</Label>
                  <Input value={directForm.name} onChange={(event) => setDirectForm((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t("common.email")}</Label>
                  <Input value={directForm.email} onChange={(event) => setDirectForm((current) => ({ ...current, email: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t("common.phone")}</Label>
                  <Input value={directForm.phone} onChange={(event) => setDirectForm((current) => ({ ...current, phone: event.target.value }))} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>{t("common.notes")}</Label>
                  <Textarea value={directForm.notes} onChange={(event) => setDirectForm((current) => ({ ...current, notes: event.target.value }))} rows={4} />
                </div>
              </div>
              <Button onClick={saveDirect} disabled={!canManage || savingDirect}>
                {savingDirect ? t("common.saving") : t("investorDetail.saveDirect")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("investorDetail.submitSensitive")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-1"><Label>{t("common.legalName")}</Label><Input value={requestForm.legalName} onChange={(event) => setRequestForm((current) => ({ ...current, legalName: event.target.value }))} /></div>
                <div className="space-y-1"><Label>{t("common.status")}</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={requestForm.status} onChange={(event) => setRequestForm((current) => ({ ...current, status: event.target.value }))}><option value="ACTIVE">{t("enums.investorStatuses.ACTIVE")}</option><option value="SUSPENDED">{t("enums.investorStatuses.SUSPENDED")}</option><option value="INACTIVE">{t("enums.investorStatuses.INACTIVE")}</option></select></div>
                <div className="space-y-1"><Label>{t("common.kycReference")}</Label><Input value={requestForm.kycReference} onChange={(event) => setRequestForm((current) => ({ ...current, kycReference: event.target.value }))} /></div>
                <div className="space-y-1"><Label>{t("common.taxNumber")}</Label><Input value={requestForm.taxNumber} onChange={(event) => setRequestForm((current) => ({ ...current, taxNumber: event.target.value }))} /></div>
                <div className="space-y-1"><Label>{t("common.nationalId")}</Label><Input value={requestForm.nationalIdNumber} onChange={(event) => setRequestForm((current) => ({ ...current, nationalIdNumber: event.target.value }))} /></div>
                <div className="space-y-1"><Label>{t("common.passportNumber")}</Label><Input value={requestForm.passportNumber} onChange={(event) => setRequestForm((current) => ({ ...current, passportNumber: event.target.value }))} /></div>
                <div className="space-y-1"><Label>{t("common.bankName")}</Label><Input value={requestForm.bankName} onChange={(event) => setRequestForm((current) => ({ ...current, bankName: event.target.value }))} /></div>
                <div className="space-y-1"><Label>{t("common.accountName")}</Label><Input value={requestForm.bankAccountName} onChange={(event) => setRequestForm((current) => ({ ...current, bankAccountName: event.target.value }))} /></div>
                <div className="space-y-1"><Label>{t("common.accountNumber")}</Label><Input value={requestForm.bankAccountNumber} onChange={(event) => setRequestForm((current) => ({ ...current, bankAccountNumber: event.target.value }))} /></div>
              </div>
              <div className="space-y-1">
                <Label>{t("investorDetail.changeSummary")}</Label>
                <Textarea value={requestForm.changeSummary} onChange={(event) => setRequestForm((current) => ({ ...current, changeSummary: event.target.value }))} rows={3} placeholder={t("investorDetail.changeSummaryPlaceholder")} />
              </div>
              <Button onClick={submitChangeRequest} disabled={!canManage || savingRequest}>
                {savingRequest ? t("common.submitting") : t("investorDetail.submitRequest")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("investorDetail.changeRequestQueue")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {changeRequests.length > 0 ? (
                changeRequests.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium">{t("investorDetail.requestNumber", { id: item.id })}</div>
                        <div className="text-sm text-muted-foreground">
                          {t("investorDetail.requestMeta", {
                            status: enumLabel("requestStatuses", item.status),
                            date: fmtDate(item.requestedAt, locale),
                            actor: item.requestedBy?.name || item.requestedBy?.email || t("common.unknown"),
                          })}
                        </div>
                      </div>
                      {item.status === "PENDING" && canManage ? (
                        <div className="flex gap-2">
                          <Button variant="outline" disabled={reviewingId === item.id} onClick={() => reviewChangeRequest(item.id, "reject")}>
                            {t("common.reject")}
                          </Button>
                          <Button disabled={reviewingId === item.id} onClick={() => reviewChangeRequest(item.id, "approve")}>
                            {reviewingId === item.id ? t("common.working") : t("common.approve")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {item.changeSummary ? (
                      <div className="text-sm">
                        <span className="font-medium">{t("common.summary")}:</span> {item.changeSummary}
                      </div>
                    ) : null}
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border p-3">
                        <div className="mb-2 text-sm font-medium">{t("investorDetail.currentSnapshot")}</div>
                        <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(item.currentSnapshot ?? {}, null, 2)}</pre>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="mb-2 text-sm font-medium">{t("investorDetail.requestedChanges")}</div>
                        <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(item.requestedChanges ?? {}, null, 2)}</pre>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>{t("common.reviewNote")}</Label>
                      <Textarea value={reviewNotes[item.id] ?? item.reviewNote ?? ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))} rows={2} />
                    </div>
                    {item.reviewedAt ? (
                      <div className="text-sm text-muted-foreground">
                        {t("investorDetail.reviewMeta", {
                          date: fmtDate(item.reviewedAt, locale),
                          actor: item.reviewedBy?.name || item.reviewedBy?.email || t("common.unknown"),
                        })}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {t("investorDetail.noChangeRequests")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("common.recentActivity")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div className="font-medium">
                        {item.metadata?.message || `${item.action} ${item.entity}`}
                      </div>
                      <div className="text-sm text-muted-foreground">{fmtDate(item.createdAt, locale)}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.actorName || item.actorEmail || t("common.system")} | {enumLabel("activityActions", item.action)} | {enumLabel("activityEntities", item.entity)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {t("investorDetail.noActivity")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
