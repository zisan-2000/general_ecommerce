"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SkeletonCards, SkeletonForm } from "@/components/investor/InvestorSkeleton";
import { statusBadge, shortDateTime } from "@/lib/investor-status";

type Payload = {
  investor: {
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
    notes: string | null;
    updatedAt: string;
  };
  requests: Array<{
    id: number;
    status: string;
    requestedChanges: Record<string, unknown>;
    requestNote: string | null;
    reviewNote: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    appliedAt: string | null;
    submittedBy: { id: string; name: string | null; email: string } | null;
    reviewedBy: { id: string; name: string | null; email: string } | null;
  }>;
};

const FORM_FIELDS: [string, string][] = [
  ["name", "profile.fields.name"], ["legalName", "profile.fields.legalName"],
  ["email", "profile.fields.email"], ["phone", "profile.fields.phone"],
  ["taxNumber", "profile.fields.taxNumber"], ["nationalIdNumber", "profile.fields.nationalId"],
  ["passportNumber", "profile.fields.passportNumber"], ["bankName", "profile.fields.bankName"],
  ["bankAccountName", "profile.fields.accountName"], ["bankAccountNumber", "profile.fields.accountNumber"],
];

type FormState = {
  name: string; legalName: string; email: string; phone: string;
  taxNumber: string; nationalIdNumber: string; passportNumber: string;
  bankName: string; bankAccountName: string; bankAccountNumber: string;
  notes: string; requestNote: string;
};

const EMPTY_FORM: FormState = {
  name: "", legalName: "", email: "", phone: "", taxNumber: "",
  nationalIdNumber: "", passportNumber: "", bankName: "",
  bankAccountName: "", bankAccountNumber: "", notes: "", requestNote: "",
};

export default function InvestorProfilePage() {
  const t = useTranslations("InvestorPortal");
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [original, setOriginal] = useState<FormState>(EMPTY_FORM);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/investor/profile", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || t("errors.loadProfile"));
      const next = payload as Payload;
      setData(next);
      const loaded: FormState = {
        name: next.investor.name ?? "",
        legalName: next.investor.legalName ?? "",
        email: next.investor.email ?? "",
        phone: next.investor.phone ?? "",
        taxNumber: next.investor.taxNumber ?? "",
        nationalIdNumber: next.investor.nationalIdNumber ?? "",
        passportNumber: next.investor.passportNumber ?? "",
        bankName: next.investor.bankName ?? "",
        bankAccountName: next.investor.bankAccountName ?? "",
        bankAccountNumber: next.investor.bankAccountNumber ?? "",
        notes: next.investor.notes ?? "",
        requestNote: "",
      };
      setOriginal(loaded);
      setForm(loaded);
    } catch (error: any) {
      toast.error(error?.message || t("errors.loadProfile"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/investor/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || t("errors.submitProfile"));
      toast.success(t("success.profileSubmitted"));
      await load();
    } catch (error: any) {
      toast.error(error?.message || t("errors.submitProfile"));
    } finally {
      setSaving(false);
    }
  };

  const dirtyFields = useMemo(
    () => new Set(
      (Object.keys(form) as (keyof FormState)[]).filter(
        (k) => k !== "requestNote" && form[k] !== original[k],
      ),
    ),
    [form, original],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="h-7 w-24 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <SkeletonCards count={3} />
        <Card>
          <CardHeader><div className="h-4 w-48 animate-pulse rounded bg-muted" /></CardHeader>
          <CardContent><SkeletonForm fields={9} /></CardContent>
        </Card>
      </div>
    );
  }
  const hasDirtyFields = dirtyFields.size > 0;

  const statusBadgeInvestor = data ? statusBadge(data.investor.status, t(`statuses.${data.investor.status}` as any)) : null;
  const kycBadge = data ? statusBadge(data.investor.kycStatus, t(`statuses.${data.investor.kycStatus}` as any)) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{t("profile.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("profile.description")}
        </p>
      </div>

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("profile.investorStatus")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={statusBadgeInvestor!.variant} className="text-sm px-3 py-1">
                  {statusBadgeInvestor!.label}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("profile.kycStatus")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={kycBadge!.variant} className="text-sm px-3 py-1">
                  {kycBadge!.label}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("profile.beneficiaryVerified")}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.investor.beneficiaryVerifiedAt ? (
                  <Badge variant="default" className="text-sm px-3 py-1">
                    {shortDateTime(data.investor.beneficiaryVerifiedAt, locale)}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-sm px-3 py-1">{t("statuses.PENDING")}</Badge>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{t("profile.submitTitle")}</CardTitle>
                {hasDirtyFields && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {t("profile.changedFields", { count: dirtyFields.size })}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasDirtyFields && (
                <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                  {t("profile.changedHint")}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {FORM_FIELDS.map(([key, labelKey]) => {
                  const isDirty = dirtyFields.has(key as keyof FormState);
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className={isDirty ? "text-primary" : ""}>{t(labelKey as any)}</Label>
                        {isDirty && (
                          <span className="text-xs text-primary">{t("profile.modified")}</span>
                        )}
                      </div>
                      <Input
                        value={form[key as keyof FormState]}
                        onChange={(e) => setForm((c) => ({ ...c, [key]: e.target.value }))}
                        className={isDirty ? "border-primary/60 ring-1 ring-primary/20 focus-visible:ring-primary" : ""}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="space-y-1">
                {(() => { const isDirty = dirtyFields.has("notes"); return (
                  <>
                    <div className="flex items-center justify-between">
                      <Label className={isDirty ? "text-primary" : ""}>{t("common.notes")}</Label>
                      {isDirty && <span className="text-xs text-primary">{t("profile.modified")}</span>}
                    </div>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
                      className={isDirty ? "border-primary/60 ring-1 ring-primary/20 focus-visible:ring-primary" : ""}
                    />
                  </>
                );})()}
              </div>
              <div className="space-y-1">
                <Label>{t("profile.requestNote")} <span className="text-xs text-muted-foreground">({t("profile.requestNoteHint")})</span></Label>
                <Textarea
                  value={form.requestNote}
                  onChange={(e) => setForm((c) => ({ ...c, requestNote: e.target.value }))}
                  placeholder={t("profile.requestNotePlaceholder")}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void submit()} disabled={saving || !hasDirtyFields}>
                  {saving ? t("common.submitting") : t("profile.submit")}
                </Button>
                {hasDirtyFields && (
                  <Button variant="ghost" size="sm" onClick={() => setForm(original)}>
                    {t("profile.reset")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("profile.recentRequests")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("profile.empty")}</p>
              ) : (
                data.requests.map((item) => {
                  const reqBadge = statusBadge(item.status, t(`statuses.${item.status}` as any));
                  return (
                    <div key={item.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{t("profile.requestNumber", { id: item.id })}</p>
                        <Badge variant={reqBadge.variant}>{reqBadge.label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("profile.requestDates", { submitted: shortDateTime(item.submittedAt, locale), reviewed: shortDateTime(item.reviewedAt, locale) })}
                      </p>
                      {item.requestNote ? <p className="mt-2 text-sm">{t("withdrawals.requestNoteValue", { note: item.requestNote })}</p> : null}
                      {item.reviewNote ? <p className="mt-1 text-sm text-muted-foreground">{t("withdrawals.reviewNoteValue", { note: item.reviewNote })}</p> : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
