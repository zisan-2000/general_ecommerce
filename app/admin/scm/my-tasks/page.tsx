"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, ClipboardList, RefreshCw, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScmActionList, type ScmActionItem } from "@/components/admin/scm/ScmActionList";
import { ScmEmptyState } from "@/components/admin/scm/ScmEmptyState";
import { ScmSectionHeader } from "@/components/admin/scm/ScmSectionHeader";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { useTranslations } from "next-intl";

type MyTasksResponse = {
  summary: {
    needsMyAction: number;
    waitingOnOthers: number;
    recentlyCompleted: number;
    overdue: number;
  };
  needsMyAction: ScmActionItem[];
  waitingOnOthers: ScmActionItem[];
  recentlyCompleted: ScmActionItem[];
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || fallback);
  }
  return payload as T;
}

export default function ScmMyTasksPage() {
  const t = useTranslations("AdminScmTasks");
  const [data, setData] = useState<MyTasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await readJson<MyTasksResponse>(
        await fetch("/api/scm/my-tasks", { cache: "no-store" }),
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

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <ScmStatCard
          label={t("stats.needsMyAction.label")}
          value={data?.summary.needsMyAction ?? 0}
          hint={t("stats.needsMyAction.hint")}
          icon={ClipboardCheck}
          tone={(data?.summary.needsMyAction ?? 0) > 0 ? "warning" : "default"}
        />
        <ScmStatCard
          label={t("stats.overdue.label")}
          value={data?.summary.overdue ?? 0}
          hint={t("stats.overdue.hint")}
          icon={TimerReset}
          tone={(data?.summary.overdue ?? 0) > 0 ? "critical" : "default"}
        />
        <ScmStatCard
          label={t("stats.waiting.label")}
          value={data?.summary.waitingOnOthers ?? 0}
          hint={t("stats.waiting.hint")}
          icon={ClipboardList}
        />
        <ScmStatCard
          label={t("stats.completed.label")}
          value={data?.summary.recentlyCompleted ?? 0}
          hint={t("stats.completed.hint")}
          icon={RefreshCw}
        />
      </div>

      <section className="space-y-4 ">
        <ScmSectionHeader
          title={t("needsAction.title")}
          description={t("needsAction.description")}
        />
        <ScmActionList
          items={data?.needsMyAction ?? []}
          empty={
            <ScmEmptyState
              title={t("needsAction.emptyTitle")}
              description={t("needsAction.emptyDescription")}
              icon={ClipboardCheck}
            />
          }
        />
      </section>

      <section className="space-y-4 ">
        <ScmSectionHeader
          title={t("waiting.title")}
          description={t("waiting.description")}
        />
        <ScmActionList
          items={data?.waitingOnOthers ?? []}
          empty={
            <ScmEmptyState
              title={t("waiting.emptyTitle")}
              description={t("waiting.emptyDescription")}
              icon={ClipboardList}
            />
          }
        />
      </section>

      <section className="space-y-4">
        <ScmSectionHeader
          title={t("completed.title")}
          description={t("completed.description")}
        />
        <ScmActionList
          items={data?.recentlyCompleted ?? []}
          empty={
            <ScmEmptyState
              title={t("completed.emptyTitle")}
              description={t("completed.emptyDescription")}
              icon={RefreshCw}
            />
          }
        />
      </section>
    </div>
  );
}
