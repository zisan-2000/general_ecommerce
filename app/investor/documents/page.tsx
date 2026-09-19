"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload-file";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SkeletonCards, SkeletonForm } from "@/components/investor/InvestorSkeleton";
import { statusBadge, shortDateTime } from "@/lib/investor-status";

type InvestorDocument = {
  id: number;
  type: string;
  fileUrl: string;
  fileName: string | null;
  documentNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  isExpired: boolean;
};

type Payload = {
  requiredDocumentTypes: string[];
  investor: {
    id: number;
    code: string;
    name: string;
    status: string;
    kycStatus: string;
    kycVerifiedAt: string | null;
  } | null;
  documents: InvestorDocument[];
  missingDocumentTypes: string[];
};

export default function InvestorDocumentsPage() {
  const t = useTranslations("InvestorPortal");
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [selectedType, setSelectedType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [documentNumber, setDocumentNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/investor/documents", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || t("errors.loadDocuments"));
      setData(payload as Payload);
    } catch (error: any) {
      toast.error(error?.message || t("errors.loadDocuments"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const currentByType = useMemo(
    () => new Map((data?.documents || []).map((d) => [d.type, d])),
    [data?.documents],
  );
  const docsUnderReview = useMemo(
    () => (data?.documents || []).filter((d) => d.status === "UNDER_REVIEW"),
    [data?.documents],
  );

  const submitDocument = async () => {
    if (!selectedType || !file) { toast.error(t("errors.documentRequired")); return; }
    try {
      setSaving(true);
      setUploadProgress(0);
      const fileUrl = await uploadFile(file, "/api/upload/investor-kyc", (pct) => {
        setUploadProgress(pct);
      });
      setUploadProgress(100);
      const response = await fetch("/api/investor/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType, fileUrl, fileName: file.name,
          mimeType: file.type || null, fileSize: file.size,
          documentNumber, issuedAt: issuedAt || null,
          expiresAt: expiresAt || null, reviewNote: note || null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || t("errors.uploadDocument"));
      toast.success(t("success.documentSubmitted"));
      setSelectedType(""); setFile(null); setDocumentNumber("");
      setIssuedAt(""); setExpiresAt(""); setNote("");
      setUploadProgress(null);
      await load();
    } catch (error: any) {
      toast.error(error?.message || t("errors.uploadDocument"));
      setUploadProgress(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="h-7 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded bg-muted" />
        </div>
        <SkeletonCards count={3} />
        <Card>
          <CardHeader><div className="h-4 w-48 animate-pulse rounded bg-muted" /></CardHeader>
          <CardContent><SkeletonForm fields={5} /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{t("documents.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("documents.description")}
        </p>
      </div>

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: t("documents.kycStatus"), value: data.investor?.kycStatus || "PENDING", isBadge: true },
              { label: t("documents.uploadedCount"), value: String(data.documents.length), isBadge: false },
              { label: t("documents.missingRequired"), value: String(data.missingDocumentTypes.length), isBadge: false },
            ].map(({ label, value, isBadge }) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isBadge ? (
                    <Badge variant={statusBadge(value).variant} className="text-sm px-3 py-1">
                      {t(`statuses.${value}` as any)}
                    </Badge>
                  ) : (
                    <p className="text-2xl font-semibold">{value}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {data.investor?.kycStatus === "UNDER_REVIEW" && docsUnderReview.length > 0 ? (
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
              {t("documents.underReview", { documents: docsUnderReview.map((d) => t.has(`documentTypes.${d.type}` as any) ? t(`documentTypes.${d.type}` as any) : d.type).join(", ") })}
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("documents.uploadTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>{t("documents.documentType")}</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                  >
                    <option value="">{t("documents.selectType")}</option>
                    {data.requiredDocumentTypes.map((type) => (
                      <option key={type} value={type}>{t.has(`documentTypes.${type}` as any) ? t(`documentTypes.${type}` as any) : type}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>{t("common.file")}</Label>
                  <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("documents.documentNumber")}</Label>
                  <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("documents.issuedAt")}</Label>
                  <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("documents.expiresAt")}</Label>
                  <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t("documents.submissionNote")}</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              {uploadProgress !== null && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{uploadProgress < 100 ? t("documents.uploadingFile") : t("common.processing")}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <Button
                onClick={() => void submitDocument()}
                disabled={saving || !selectedType || !file}
              >
                {saving ? (uploadProgress !== null && uploadProgress < 100 ? t("common.uploading") : t("common.submitting")) : t("documents.submit")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("documents.required")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {data.requiredDocumentTypes.map((type) => {
                const doc = currentByType.get(type);
                const docBadge = doc ? statusBadge(doc.status, t(`statuses.${doc.status}` as any)) : null;
                return (
                  <div key={type} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{t.has(`documentTypes.${type}` as any) ? t(`documentTypes.${type}` as any) : type}</p>
                        {docBadge ? (
                          <Badge variant={docBadge.variant}>{docBadge.label}</Badge>
                        ) : (
                          <Badge variant="outline">{t("documents.notUploaded")}</Badge>
                        )}
                      </div>
                      {doc?.fileUrl ? (
                        <Button size="sm" variant="outline" asChild>
                          <a href={doc.fileUrl} target="_blank" rel="noreferrer">{t("common.view")}</a>
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      <div>{t("common.uploaded")}: {shortDateTime(doc?.createdAt, locale)}</div>
                      <div>{t("common.reviewed")}: {shortDateTime(doc?.reviewedAt, locale)}</div>
                      <div>{t("common.expires")}: {shortDateTime(doc?.expiresAt, locale)}</div>
                      {doc?.reviewNote ? <div className="text-foreground">{t("common.note")}: {doc.reviewNote}</div> : null}
                    </div>
                    {doc ? (
                      <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                        {t("documents.reuploadHint")}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
