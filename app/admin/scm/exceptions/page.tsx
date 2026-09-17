"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ScmExceptionList,
  type ScmExceptionItem,
} from "@/components/admin/scm/ScmExceptionList";
import { ScmEmptyState } from "@/components/admin/scm/ScmEmptyState";
import { ScmSectionHeader } from "@/components/admin/scm/ScmSectionHeader";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { useTranslations } from "next-intl";

type ExceptionsResponse = {
  summary: {
    critical: number;
    needsReview: number;
    operationalRisks: number;
  };
  critical: ScmExceptionItem[];
  needsReview: ScmExceptionItem[];
  operationalRisks: ScmExceptionItem[];
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || fallback);
  }
  return payload as T;
}

export default function ScmExceptionsPage() {
  const t = useTranslations("AdminScmExceptions");
  const [data, setData] = useState<ExceptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await readJson<ExceptionsResponse>(
        await fetch("/api/scm/exceptions", { cache: "no-store" }),
        t("errors.load"),
      );
      setData(payload);
    } catch (err: any) {
      setError(err?.message || t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [t]);

  return (
    <div className="space-y-8 p-4 md:p-6">
      <ScmSectionHeader
        title={t("header.title")}
        description={t("header.description")}
        action={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("actions.refresh")}
          </Button>
        }
      />

      {loading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 grid-cols-3">
        <ScmStatCard
          label={t("stats.critical.label")}
          value={data?.summary.critical ?? 0}
          hint={t("stats.critical.hint")}
          icon={ShieldAlert}
          tone={(data?.summary.critical ?? 0) > 0 ? "critical" : "default"}
        />
        <ScmStatCard
          label={t("stats.needsReview.label")}
          value={data?.summary.needsReview ?? 0}
          hint={t("stats.needsReview.hint")}
          icon={AlertTriangle}
          tone={(data?.summary.needsReview ?? 0) > 0 ? "warning" : "default"}
        />
        <ScmStatCard
          label={t("stats.operationalRisks.label")}
          value={data?.summary.operationalRisks ?? 0}
          hint={t("stats.operationalRisks.hint")}
          icon={RefreshCw}
        />
      </div>

      <section className="space-y-4">
        <ScmSectionHeader
          title={t("critical.title")}
          description={t("critical.description")}
        />
        <ScmExceptionList
          items={data?.critical ?? []}
          empty={
            <ScmEmptyState
              title={t("critical.emptyTitle")}
              description={t("critical.emptyDescription")}
              icon={ShieldAlert}
            />
          }
        />
      </section>

      <section className="space-y-4">
        <ScmSectionHeader
          title={t("needsReview.title")}
          description={t("needsReview.description")}
        />
        <ScmExceptionList
          items={data?.needsReview ?? []}
          empty={
            <ScmEmptyState
              title={t("needsReview.emptyTitle")}
              description={t("needsReview.emptyDescription")}
              icon={AlertTriangle}
            />
          }
        />
      </section>

      <section className="space-y-4">
        <ScmSectionHeader
          title={t("operationalRisks.title")}
          description={t("operationalRisks.description")}
        />
        <ScmExceptionList
          items={data?.operationalRisks ?? []}
          empty={
            <ScmEmptyState
              title={t("operationalRisks.emptyTitle")}
              description={t("operationalRisks.emptyDescription")}
              icon={RefreshCw}
            />
          }
        />
      </section>
    </div>
  );
}
