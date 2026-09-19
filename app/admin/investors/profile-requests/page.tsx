"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestorWorkflowGuide } from "@/components/investors/InvestorWorkflowGuide";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Payload = {
  summary: {
    pending: number;
    approved: number;
    rejected: number;
  };
  rows: Array<{
    id: number;
    status: string;
    requestedChanges: Record<string, unknown>;
    requestNote: string | null;
    reviewNote: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    investor: {
      id: number;
      code: string;
      name: string;
      email: string | null;
      status: string;
      kycStatus: string;
    };
    submittedBy: { id: string; name: string | null; email: string } | null;
    reviewedBy: { id: string; name: string | null; email: string } | null;
  }>;
};

function fmtDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale);
}

export default function InvestorProfileRequestsPage() {
  const t = useTranslations("AdminInvestors.pages");
  const locale = useLocale();
  const fieldLabel = (value: string) => {
    const key = `enums.profileFields.${value}` as any;
    return t.has(key) ? t(key) : value;
  };
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [workingId, setWorkingId] = useState<number | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(
        `/api/admin/investor-profile-requests${params.size ? `?${params.toString()}` : ""}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.loadProfileRequests"));
      }
      setData(payload as Payload);
    } catch {
      toast.error(t("errors.loadProfileRequests"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [status]);

  const review = async (id: number, action: "approve" | "reject") => {
    try {
      setWorkingId(id);
      const response = await fetch(`/api/admin/investor-profile-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewNote: reviewNotes[id] || "",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.reviewProfileRequest"));
      }
      toast.success(action === "approve" ? t("success.requestApproved") : t("success.requestRejected"));
      await load();
    } catch {
      toast.error(t("errors.reviewProfileRequest"));
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <InvestorWorkflowGuide currentSection="profile-requests" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("profileRequests.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("profileRequests.description")}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Input
            placeholder={t("common.searchInvestor")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full sm:w-56"
          />
          <Button variant="outline" onClick={() => void load()}>
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.pending")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data?.summary.pending ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.approved")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data?.summary.approved ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.rejected")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data?.summary.rejected ?? 0}</CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {["PENDING", "APPROVED", "REJECTED", ""].map((value) => (
          <Button
            key={value || "ALL"}
            variant={status === value ? "default" : "outline"}
            onClick={() => setStatus(value)}
          >
            {value ? t(`enums.requestStatuses.${value}` as any) : t("common.all")}
          </Button>
        ))}
      </div>

      {loading ? <p className="text-sm text-muted-foreground">{t("profileRequests.loading")}</p> : null}

      {!loading && data ? (
        <div className="space-y-4">
          {data.rows.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                {t("profileRequests.empty")}
              </CardContent>
            </Card>
          ) : (
            data.rows.map((row) => (
              <Card key={row.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {t("profileRequests.requestTitle", { id: row.id, investor: row.investor.name })}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t(`enums.requestStatuses.${row.status}` as any)}</span>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/investors/${row.investor.id}`}>{t("common.openInvestor")}</Link>
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("profileRequests.meta", { code: row.investor.code, submitted: fmtDate(row.submittedAt, locale), kyc: t(`enums.kycStatuses.${row.investor.kycStatus}` as any) })}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {row.requestNote ? <p className="text-sm">{t("profileRequests.requestNote", { note: row.requestNote })}</p> : null}
                  <div className="rounded-md border p-3 text-sm">
                    <p className="mb-2 font-medium">{t("profileRequests.requestedChanges")}</p>
                    <div className="space-y-1 text-muted-foreground">
                      {Object.entries(row.requestedChanges || {}).map(([key, value]) => (
                        <div key={key}>
                          {fieldLabel(key)}: {String(value ?? "") || "—"}
                        </div>
                      ))}
                    </div>
                  </div>
                  {row.status === "PENDING" ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label>{t("common.reviewNote")}</Label>
                        <Textarea
                          value={reviewNotes[row.id] || ""}
                          onChange={(event) =>
                            setReviewNotes((current) => ({
                              ...current,
                              [row.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => void review(row.id, "approve")}
                          disabled={workingId === row.id}
                        >
                          {t("common.approve")}
                        </Button>
                        <Button
                          size="sm"
                          className="w-full sm:w-auto"
                          variant="outline"
                          onClick={() => void review(row.id, "reject")}
                          disabled={workingId === row.id}
                        >
                          {t("common.reject")}
                        </Button>
                      </div>
                    </div>
                  ) : row.reviewNote ? (
                    <p className="text-sm text-muted-foreground">{t("common.reviewNoteValue", { note: row.reviewNote })}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
