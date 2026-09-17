"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FolderKanban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvestorWorkflowGuide } from "@/components/investors/InvestorWorkflowGuide";

type WorkspaceCard = {
  id: string;
  label: string;
  value: string;
  hint: string;
  href: string;
};

type WorkspaceItem = {
  id: string;
  title: string;
  description: string;
  count: number;
  href: string;
  tone: "default" | "warning" | "critical";
};

type WorkspaceLink = {
  id: string;
  label: string;
  description: string;
  href: string;
};

type WorkspaceActivity = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  message: string;
  createdAt: string;
  userName: string | null;
};

type WorkspacePayload = {
  summary: WorkspaceCard[];
  tasks: WorkspaceItem[];
  exceptions: WorkspaceItem[];
  quickLinks: WorkspaceLink[];
  recentActivity: WorkspaceActivity[];
};

function fmtDate(value: string, locale: string, unavailable: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return unavailable;
  return parsed.toLocaleString(locale);
}

function toneClasses(tone: WorkspaceItem["tone"]) {
  if (tone === "critical") {
    return "border-red-200 bg-red-50/70 text-red-900";
  }
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50/70 text-amber-900";
  }
  return "border-slate-200 bg-slate-50/70 text-slate-900";
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default function InvestorOperationsClient({
  mode,
}: {
  mode: "overview" | "tasks" | "exceptions";
}) {
  const t = useTranslations("AdminInvestors.operations");
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WorkspacePayload | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/admin/investor-workspace", {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(t("errors.load"));
        }
        if (active) {
          setData(payload as WorkspacePayload);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || t("errors.load"));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [t]);

  const payloadCopy = (
    collection: "summary" | "tasks" | "exceptions" | "quickLinks",
    id: string,
    field: "label" | "hint" | "title" | "description",
    fallback: string,
  ) => {
    const key = `payload.${collection}.${id}.${field}`;
    return t.has(key as any) ? t(key as any) : fallback;
  };

  const pageMeta = useMemo(() => {
    if (mode === "tasks") {
      return {
        title: t("page.tasks.title"),
        description: t("page.tasks.description"),
      };
    }
    if (mode === "exceptions") {
      return {
        title: t("page.exceptions.title"),
        description: t("page.exceptions.description"),
      };
    }
    return {
      title: t("page.overview.title"),
      description: t("page.overview.description"),
    };
  }, [mode, t]);

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{pageMeta.title}</h1>
        <p className="text-sm text-muted-foreground">{pageMeta.description}</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}
      {!loading && error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && !error && data ? (
        <>
          <InvestorWorkflowGuide
            currentSection={
              mode === "overview"
                ? "overview"
                : mode === "tasks"
                  ? "tasks"
                  : "exceptions"
            }
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.summary.map((card) => (
              <Link key={card.id} href={card.href}>
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {payloadCopy("summary", card.id, "label", card.label)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold">{card.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{payloadCopy("summary", card.id, "hint", card.hint)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {mode === "overview" ? (
            <div className="grid gap-6 xl:grid-cols-[1.35fr,0.95fr]">
              <div className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{t("overview.actionQueue.title")}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {t("overview.actionQueue.description")}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/admin/investors/my-tasks">{t("overview.actionQueue.open")}</Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.tasks.length === 0 ? (
                      <EmptyState message={t("empty.tasks")} />
                    ) : (
                      data.tasks.slice(0, 5).map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={`block rounded-lg border p-4 transition-colors hover:border-primary/40 ${toneClasses(item.tone)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-medium">{payloadCopy("tasks", item.id, "title", item.title)}</p>
                              <p className="text-sm opacity-90">{payloadCopy("tasks", item.id, "description", item.description)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-semibold">{item.count}</p>
                              <p className="text-xs uppercase tracking-wide opacity-75">{t("labels.open")}</p>
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{t("overview.exceptions.title")}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {t("overview.exceptions.description")}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/admin/investors/exceptions">{t("overview.exceptions.open")}</Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.exceptions.length === 0 ? (
                      <EmptyState message={t("empty.exceptions")} />
                    ) : (
                      data.exceptions.slice(0, 5).map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={`block rounded-lg border p-4 transition-colors hover:border-primary/40 ${toneClasses(item.tone)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-medium">{payloadCopy("exceptions", item.id, "title", item.title)}</p>
                              <p className="text-sm opacity-90">{payloadCopy("exceptions", item.id, "description", item.description)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-semibold">{item.count}</p>
                              <p className="text-xs uppercase tracking-wide opacity-75">{t("labels.flagged")}</p>
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("overview.quickStart.title")}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {t("overview.quickStart.description")}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.quickLinks.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:border-primary/40"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">{payloadCopy("quickLinks", item.id, "label", item.label)}</p>
                          <p className="text-sm text-muted-foreground">{payloadCopy("quickLinks", item.id, "description", item.description)}</p>
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground" />
                      </Link>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("overview.recentActivity.title")}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {t("overview.recentActivity.description")}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.recentActivity.length === 0 ? (
                      <EmptyState message={t("empty.activity")} />
                    ) : (
                      data.recentActivity.map((item) => (
                        <div key={item.id} className="rounded-lg border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-medium">{item.message}</p>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              {t.has(`activity.entities.${item.entity}` as any)
                                ? t(`activity.entities.${item.entity}` as any)
                                : item.entity.replace(/_/g, " ")}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {fmtDate(item.createdAt, locale, t("labels.unavailable"))}
                            </p>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {item.userName || t("labels.system")} • {t.has(`activity.actions.${item.action}` as any) ? t(`activity.actions.${item.action}` as any) : item.action}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          {mode === "tasks" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("tasks.title")}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t("tasks.description")}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.tasks.length === 0 ? (
                  <EmptyState message={t("empty.tasks")} />
                ) : (
                  data.tasks.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`flex items-start gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40 ${toneClasses(item.tone)}`}
                    >
                      <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{payloadCopy("tasks", item.id, "title", item.title)}</p>
                          <p className="text-lg font-semibold">{item.count}</p>
                        </div>
                        <p className="text-sm opacity-90">{payloadCopy("tasks", item.id, "description", item.description)}</p>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}

          {mode === "exceptions" ? (
            <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("exceptions.title")}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("exceptions.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.exceptions.length === 0 ? (
                    <EmptyState message={t("empty.exceptions")} />
                  ) : (
                    data.exceptions.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={`flex items-start gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40 ${toneClasses(item.tone)}`}
                      >
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{payloadCopy("exceptions", item.id, "title", item.title)}</p>
                            <p className="text-lg font-semibold">{item.count}</p>
                          </div>
                          <p className="text-sm opacity-90">{payloadCopy("exceptions", item.id, "description", item.description)}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("followUp.title")}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("followUp.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    {
                      id: "registry-followup",
                      label: t("followUp.registry.title"),
                      description: t("followUp.registry.description"),
                      href: "/admin/investors/registry",
                      icon: CheckCircle2,
                    },
                    {
                      id: "profit-followup",
                      label: t("followUp.profitRuns.title"),
                      description: t("followUp.profitRuns.description"),
                      href: "/admin/investors/profit-runs",
                      icon: FolderKanban,
                    },
                    {
                      id: "payout-followup",
                      label: t("followUp.payouts.title"),
                      description: t("followUp.payouts.description"),
                      href: "/admin/investors/payouts",
                      icon: Clock3,
                    },
                    {
                      id: "statement-followup",
                      label: t("followUp.statementSchedules.title"),
                      description: t("followUp.statementSchedules.description"),
                      href: "/admin/investors/statement-schedules?dueOnly=true",
                      icon: CheckCircle2,
                    },
                  ].map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40"
                    >
                      <item.icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                      <div className="space-y-1">
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
