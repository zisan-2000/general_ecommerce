"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { useLocale, useTranslations } from "next-intl";

type NotificationRow = {
  id: number;
  type: string;
  stage: string;
  status: string;
  title: string;
  message: string;
  entityNumber: string;
  href: string;
  metadata: unknown;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  unreadCount: number;
  rows: NotificationRow[];
  health: {
    unreadInternalCount: number;
    modules: Array<{
      key: string;
      label: string;
      systemCount: number;
      emailPending: number;
      emailFailed: number;
      emailSent: number;
    }>;
    recentFailures: Array<{
      key: string;
      label: string;
      id: number;
      recipientEmail: string | null;
      message: string;
      createdAt: string;
      error: string | null;
    }>;
  };
};

function fmtDate(value: string | null | undefined, locale: string, unavailable: string) {
  if (!value) return unavailable;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return unavailable;
  return date.toLocaleString(locale);
}

export default function ScmNotificationsPage() {
  const t = useTranslations("AdminScmNotifications");
  const locale = useLocale();
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [retryingQueue, setRetryingQueue] = useState(false);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");

  const load = async (nextUnreadOnly = unreadOnly) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: "100" });
      if (nextUnreadOnly) {
        params.set("unreadOnly", "true");
      }
      const response = await fetch(`/api/scm/notifications?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || t("errors.load"));
      }
      setData(payload as NotificationsResponse);
    } catch (err: any) {
      setError(err?.message || t("errors.load"));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [t]);

  const markRead = async (row: NotificationRow) => {
    try {
      const response = await fetch("/api/scm/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, type: row.type }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || t("errors.mark"));
      }
      await load();
    } catch (err: any) {
      setError(err?.message || t("errors.mark"));
    }
  };

  const markAllRead = async () => {
    try {
      setMarkingAll(true);
      const response = await fetch("/api/scm/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || t("errors.markAll"));
      }
      await load();
    } catch (err: any) {
      setError(err?.message || t("errors.markAll"));
    } finally {
      setMarkingAll(false);
    }
  };

  const processQueue = async (action: "process_email_queue" | "retry_failed_email_queue") => {
    try {
      if (action === "process_email_queue") {
        setProcessingQueue(true);
      } else {
        setRetryingQueue(true);
      }
      const response = await fetch("/api/scm/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || t("errors.queue"));
      }
      await load();
    } catch (err: any) {
      setError(err?.message || t("errors.queue"));
    } finally {
      if (action === "process_email_queue") {
        setProcessingQueue(false);
      } else {
        setRetryingQueue(false);
      }
    }
  };

  const moduleOptions = useMemo(() => {
    if (!data) return [];
    return data.health.modules
      .map((module) => ({
        value: module.key,
        label: module.label,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [data]);

  const visibleRows = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.rows.filter((row) => {
      if (moduleFilter !== "ALL" && row.type !== moduleFilter) return false;
      if (!query) return true;
      return (
        row.title.toLowerCase().includes(query) ||
        row.message.toLowerCase().includes(query) ||
        row.entityNumber.toLowerCase().includes(query) ||
        row.stage.toLowerCase().includes(query)
      );
    });
  }, [data, moduleFilter, search]);

  const needsActionRows = useMemo(
    () => visibleRows.filter((row) => !row.readAt),
    [visibleRows],
  );

  const recentUpdateRows = useMemo(
    () => visibleRows.filter((row) => Boolean(row.readAt)),
    [visibleRows],
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("header.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("header.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const next = !unreadOnly;
              setUnreadOnly(next);
              void load(next);
            }}
          >
            {unreadOnly ? t("actions.showAll") : t("actions.unreadOnly")}
          </Button>
          <Button variant="outline" onClick={() => void load()}>
            {t("actions.refresh")}
          </Button>
          <Button variant="outline" onClick={() => void markAllRead()} disabled={markingAll}>
            {markingAll ? t("actions.marking") : t("actions.markAllRead")}
          </Button>
          <Button
            variant="outline"
            onClick={() => void processQueue("process_email_queue")}
            disabled={processingQueue}
          >
            {processingQueue ? t("actions.processing") : t("actions.processQueue")}
          </Button>
          <Button
            variant="outline"
            onClick={() => void processQueue("retry_failed_email_queue")}
            disabled={retryingQueue}
          >
            {retryingQueue ? t("actions.retrying") : t("actions.retryFailed")}
          </Button>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}
      {!loading && error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && !error && data ? (
        <>
          <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
            <ScmStatCard
              label={t("stats.unread.label")}
              value={String(data.unreadCount)}
              hint={t("stats.unread.hint")}
              tone={data.unreadCount > 0 ? "warning" : "default"}
            />
            <ScmStatCard
              label={t("stats.visible.label")}
              value={String(visibleRows.length)}
              hint={t("stats.visible.hint")}
            />
            <ScmStatCard
              label={t("stats.failed.label")}
              value={String(data.health.recentFailures.length)}
              hint={t("stats.failed.hint")}
              tone={data.health.recentFailures.length > 0 ? "critical" : "default"}
            />
            <ScmStatCard
              label={t("stats.modules.label")}
              value={String(data.health.modules.length)}
              hint={t("stats.modules.hint")}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("controls.title")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("controls.searchPlaceholder")}
              />
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value)}
              >
                <option value="ALL">{t("controls.allModules")}</option>
                {moduleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          <div className="grid gap-4 grid-cols-2 xl:grid-cols-3">
            {data.health.modules.map((module) => (
              <Card key={module.key}>
                <CardHeader>
                  <CardTitle className="text-base">{module.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>{t("health.system")}</span>
                    <span className="font-medium text-foreground">{module.systemCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("health.emailSent")}</span>
                    <span className="font-medium text-foreground">{module.emailSent}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("health.emailPending")}</span>
                    <span className="font-medium text-foreground">{module.emailPending}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("health.emailFailed")}</span>
                    <span className="font-medium text-destructive">{module.emailFailed}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("alerts.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.health.recentFailures.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("alerts.empty")}</p>
              ) : (
                data.health.recentFailures.map((row) => (
                  <div key={`${row.key}-${row.id}`} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{row.label}</Badge>
                          <Badge variant="destructive">{t("labels.failed")}</Badge>
                        </div>
                        <p className="text-sm font-medium">{row.recipientEmail || t("labels.noEmail")}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(row.createdAt, locale, t("labels.notAvailable"))}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{row.message}</p>
                    {row.error ? (
                      <p className="mt-1 text-xs text-destructive">{t("labels.error")}: {row.error}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            {visibleRows.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  {t("empty")}
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("needsAction.title")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {needsActionRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("needsAction.empty")}
                      </p>
                    ) : (
                      needsActionRows.map((row) => (
                        <Card key={`${row.type}-${row.id}`} className="border-amber-200 bg-amber-50/40 shadow-none">
                          <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <CardTitle className="text-base">{row.title}</CardTitle>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">{row.type}</Badge>
                                <Badge>{row.stage}</Badge>
                                <Badge variant="secondary">{t("labels.unread")}</Badge>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t("labels.entity")}: {row.entityNumber || t("labels.notAvailable")} | {t("labels.created")}: {fmtDate(row.createdAt, locale, t("labels.notAvailable"))}
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-sm">{row.message}</p>
                            <div className="flex flex-wrap gap-2">
                              <Button asChild size="sm">
                                <Link href={row.href}>{t("actions.openWorkflow")}</Link>
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void markRead(row)}>
                                {t("actions.markRead")}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("recent.title")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recentUpdateRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("recent.empty")}
                      </p>
                    ) : (
                      recentUpdateRows.map((row) => (
                        <Card key={`${row.type}-${row.id}`} className="shadow-none">
                          <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <CardTitle className="text-base">{row.title}</CardTitle>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">{row.type}</Badge>
                                <Badge variant="outline">{row.stage}</Badge>
                                <Badge variant="outline">{t("labels.read")}</Badge>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t("labels.entity")}: {row.entityNumber || t("labels.notAvailable")} | {t("labels.readAt")}: {fmtDate(row.readAt, locale, t("labels.notAvailable"))}
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-sm">{row.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("labels.sent")}: {fmtDate(row.sentAt, locale, t("labels.notAvailable"))}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button asChild size="sm" variant="outline">
                                <Link href={row.href}>{t("actions.openModule")}</Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
