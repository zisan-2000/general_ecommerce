"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestorWorkflowGuide } from "@/components/investors/InvestorWorkflowGuide";
import { Input } from "@/components/ui/input";

type NotificationRow = {
  id: number;
  type: string;
  title: string;
  message: string;
  status: string;
  targetUrl: string | null;
  entity: string | null;
  entityId: string | null;
  metadata: unknown;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  unreadCount: number;
  rows: NotificationRow[];
};

function fmtDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale);
}

export default function InvestorNotificationsPage() {
  const t = useTranslations("AdminInvestors.pages");
  const locale = useLocale();
  const typeLabel = (value: string) => {
    const key = `enums.notificationTypes.${value}` as any;
    if (t.has(key)) return t(key);
    return value
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = async (nextUnreadOnly = unreadOnly) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: "100" });
      if (nextUnreadOnly) {
        params.set("unreadOnly", "true");
      }
      const response = await fetch(
        `/api/admin/investor-notifications?${params.toString()}`,
        {
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.loadNotifications"));
      }
      setData(payload as NotificationsResponse);
    } catch {
      setError(t("errors.loadNotifications"));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const markRead = async (row: NotificationRow) => {
    try {
      const response = await fetch("/api/admin/investor-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.markNotification"));
      }
      await load();
    } catch {
      setError(t("errors.markNotification"));
    }
  };

  const markAllRead = async () => {
    try {
      setMarkingAll(true);
      const response = await fetch("/api/admin/investor-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.markAllNotifications"));
      }
      await load();
    } catch {
      setError(t("errors.markAllNotifications"));
    } finally {
      setMarkingAll(false);
    }
  };

  const typeOptions = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.rows.map((row) => row.type))].sort();
  }, [data]);

  const visibleRows = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.rows.filter((row) => {
      if (typeFilter !== "ALL" && row.type !== typeFilter) return false;
      if (!query) return true;
      return (
        row.title.toLowerCase().includes(query) ||
        row.message.toLowerCase().includes(query) ||
        row.type.toLowerCase().includes(query)
      );
    });
  }, [data, search, typeFilter]);

  const unreadVisibleCount = useMemo(
    () => visibleRows.filter((row) => !row.readAt).length,
    [visibleRows],
  );

  return (
    <div className="space-y-6 p-6">
      <InvestorWorkflowGuide currentSection="notifications" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("notifications.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("notifications.description")}
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
            {unreadOnly ? t("notifications.showAll") : t("notifications.unreadOnly")}
          </Button>
          <Button variant="outline" onClick={() => void load()}>
            {t("common.refresh")}
          </Button>
          <Button variant="outline" onClick={() => void markAllRead()} disabled={markingAll}>
            {markingAll ? t("notifications.marking") : t("notifications.markAllRead")}
          </Button>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">{t("notifications.loading")}</p> : null}
      {!loading && error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && !error && data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("notifications.unread")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">
                {data.unreadCount}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("notifications.visibleRows")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">
                {visibleRows.length}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("notifications.needsAction")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">
                {unreadVisibleCount}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("notifications.queue")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  placeholder={t("notifications.searchPlaceholder")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="md:max-w-sm"
                />
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm md:w-56"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="ALL">{t("notifications.allTypes")}</option>
                  {typeOptions.map((value) => (
                    <option key={value} value={value}>
                      {typeLabel(value)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {visibleRows.length === 0 ? (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    {t("notifications.empty")}
                  </div>
                ) : (
                  visibleRows.map((row) => (
                    <div
                      key={row.id}
                      className={`rounded-lg border p-4 ${
                        row.readAt ? "bg-background" : "bg-emerald-50/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{row.title}</h3>
                            <Badge variant="outline">{typeLabel(row.type)}</Badge>
                            <Badge variant={row.readAt ? "secondary" : "default"}>
                              {row.readAt ? t("notifications.read") : t("notifications.unread")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{row.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("notifications.createdAt", { date: fmtDate(row.createdAt, locale) })}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {row.targetUrl ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={row.targetUrl}>{t("common.open")}</Link>
                            </Button>
                          ) : null}
                          {!row.readAt ? (
                            <Button size="sm" onClick={() => void markRead(row)}>
                              {t("notifications.markRead")}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
