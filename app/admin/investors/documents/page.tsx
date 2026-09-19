"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload-file";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestorWorkflowGuide } from "@/components/investors/InvestorWorkflowGuide";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type InvestorDocument = {
  id: number;
  investorId: number;
  type: string;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  documentNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
  uploadedBy?: { id: string; name: string | null; email: string } | null;
  reviewedBy?: { id: string; name: string | null; email: string } | null;
};

type InvestorSummary = {
  id: number;
  code: string;
  name: string;
  email: string | null;
  status: string;
  kycStatus: string;
  kycVerifiedAt: string | null;
  documents: InvestorDocument[];
  missingDocumentTypes: string[];
};

type Payload = {
  requiredDocumentTypes: string[];
  investors: InvestorSummary[];
};

function fmtDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(locale);
}

function toInputDate(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

export default function InvestorDocumentsPage() {
  const t = useTranslations("AdminInvestors.pages");
  const locale = useLocale();
  const enumLabel = (group: string, value: string) => {
    const key = `enums.${group}.${value}` as any;
    return t.has(key) ? t(key) : value;
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [requiredTypes, setRequiredTypes] = useState<string[]>([]);
  const [investors, setInvestors] = useState<InvestorSummary[]>([]);
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [documentNumber, setDocumentNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  const load = async (nextSearch = search) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      const response = await fetch(
        `/api/admin/investor-documents${params.size ? `?${params.toString()}` : ""}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.loadDocuments"));
      }
      const data = payload as Payload;
      setRequiredTypes(Array.isArray(data.requiredDocumentTypes) ? data.requiredDocumentTypes : []);
      setInvestors(Array.isArray(data.investors) ? data.investors : []);
    } catch {
      toast.error(t("errors.loadDocuments"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load("");
  }, []);

  const summary = useMemo(() => {
    const totalDocs = investors.reduce((sum, investor) => sum + investor.documents.length, 0);
    const pendingDocs = investors.reduce(
      (sum, investor) =>
        sum + investor.documents.filter((document) => document.status === "PENDING" || document.status === "UNDER_REVIEW").length,
      0,
    );
    const expiredDocs = investors.reduce(
      (sum, investor) => sum + investor.documents.filter((document) => document.isExpired).length,
      0,
    );
    const missingSlots = investors.reduce(
      (sum, investor) => sum + investor.missingDocumentTypes.length,
      0,
    );
    return { totalDocs, pendingDocs, expiredDocs, missingSlots };
  }, [investors]);

  const uploadDocument = async () => {
    if (!selectedInvestorId || !selectedType || !file) {
      toast.error(t("errors.documentRequiredFields"));
      return;
    }

    try {
      setSaving(true);
      const fileUrl = await uploadFile(file, "/api/upload/investor-kyc");
      const response = await fetch("/api/admin/investor-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorId: Number(selectedInvestorId),
          type: selectedType,
          fileUrl,
          fileName: file.name,
          mimeType: file.type || null,
          fileSize: file.size,
          documentNumber,
          issuedAt: issuedAt || null,
          expiresAt: expiresAt || null,
          reviewNote: note || null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.uploadDocument"));
      }
      toast.success(t("success.documentUploaded"));
      setSelectedType("");
      setFile(null);
      setDocumentNumber("");
      setIssuedAt("");
      setExpiresAt("");
      setNote("");
      await load();
    } catch {
      toast.error(t("errors.uploadDocument"));
    } finally {
      setSaving(false);
    }
  };

  const reviewDocument = async (documentId: number, action: "verify" | "reject" | "reopen") => {
    try {
      setSaving(true);
      const response = await fetch("/api/admin/investor-documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          action,
          reviewNote: reviewNotes[documentId] || "",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.reviewDocument"));
      }
      toast.success(t("success.documentReviewUpdated"));
      await load();
    } catch {
      toast.error(t("errors.reviewDocument"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <InvestorWorkflowGuide currentSection="documents" />

      <div>
        <h1 className="text-2xl font-semibold">{t("documents.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("documents.description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.investors")}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{investors.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("common.documents")}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{summary.totalDocs}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("documents.pendingReview")}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{summary.pendingDocs}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("documents.expiredMissing")}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{summary.expiredDocs + summary.missingSlots}</CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("documents.uploadTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1">
              <Label>{t("common.investor")}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedInvestorId}
                onChange={(event) => setSelectedInvestorId(event.target.value)}
              >
                <option value="">{t("common.selectInvestor")}</option>
                {investors.map((investor) => (
                  <option key={investor.id} value={investor.id}>
                    {investor.name} ({investor.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t("documents.documentType")}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
              >
                <option value="">{t("documents.selectDocumentType")}</option>
                {requiredTypes.map((type) => (
                  <option key={type} value={type}>{enumLabel("documentTypes", type)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t("common.file")}</Label>
              <Input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </div>
            <div className="space-y-1">
              <Label>{t("documents.documentNumber")}</Label>
              <Input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("documents.issuedAt")}</Label>
              <Input type="date" value={issuedAt} onChange={(event) => setIssuedAt(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("documents.expiresAt")}</Label>
              <Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("documents.uploadNote")}</Label>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <Button onClick={() => void uploadDocument()} disabled={saving}>
            {saving ? t("common.saving") : t("documents.upload")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("documents.registry")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder={t("common.searchInvestor")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full sm:max-w-md"
            />
            <Button variant="outline" onClick={() => void load(search)}>{t("common.search")}</Button>
          </div>

          {loading ? <p className="text-sm text-muted-foreground">{t("common.loading")}</p> : null}

          <div className="space-y-4">
            {investors.map((investor) => (
              <div key={investor.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{investor.name} ({investor.code})</p>
                    <p className="text-sm text-muted-foreground">
                      {t("documents.kycLine", {
                        status: enumLabel("kycStatuses", investor.kycStatus),
                        verification: investor.kycVerifiedAt
                          ? t("documents.verifiedAt", { date: fmtDate(investor.kycVerifiedAt, locale) })
                          : "",
                      })}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("documents.missing", {
                      types: investor.missingDocumentTypes.length > 0
                        ? investor.missingDocumentTypes.map((type) => enumLabel("documentTypes", type)).join(", ")
                        : t("common.none"),
                    })}
                  </div>
                </div>

                {investor.kycStatus === "UNDER_REVIEW" &&
                investor.documents.some((document) => document.status === "UNDER_REVIEW") ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {t("documents.kycReviewNotice")}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {investor.documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("documents.noDocuments")}</p>
                  ) : investor.documents.map((document) => (
                    <div key={document.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{enumLabel("documentTypes", document.type)}</p>
                          <p className="break-all text-xs text-muted-foreground">
                            {document.fileName || t("documents.uploadedFile")} • {enumLabel("documentStatuses", document.status)}
                          </p>
                        </div>
                        <a href={document.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 text-sm text-primary underline">
                          {t("common.view")}
                        </a>
                      </div>
                      <div className="mt-2 grid gap-1 break-words text-xs text-muted-foreground">
                        <div>{t("documents.uploadedAt", { date: fmtDate(document.createdAt, locale) })}</div>
                        <div>{t("documents.expiresAtValue", { date: fmtDate(document.expiresAt, locale) })}</div>
                        <div>{t("documents.reviewedAt", { date: fmtDate(document.reviewedAt, locale) })}</div>
                        {document.reviewNote ? <div>{t("common.noteValue", { note: document.reviewNote })}</div> : null}
                      </div>
                      <Textarea
                        className="mt-3"
                        placeholder={t("documents.reviewNote")}
                        value={reviewNotes[document.id] ?? document.reviewNote ?? ""}
                        onChange={(event) =>
                          setReviewNotes((current) => ({ ...current, [document.id]: event.target.value }))
                        }
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => void reviewDocument(document.id, "verify")} disabled={saving}>
                          {t("common.verify")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void reviewDocument(document.id, "reopen")} disabled={saving}>
                          {t("common.reopen")}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => void reviewDocument(document.id, "reject")} disabled={saving}>
                          {t("common.reject")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!loading && investors.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.noInvestors")}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
