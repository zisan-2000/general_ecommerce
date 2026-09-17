"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BarChart3, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Synonym = {
  id: number;
  label: string;
  terms: string[];
  locale: string;
  active: boolean;
};

type Rule = {
  id: number;
  name: string;
  query: string;
  matchType: "EXACT" | "PREFIX" | "CONTAINS";
  action: {
    pinProductIds?: number[];
    boostProductIds?: number[];
    suggestedQueries?: string[];
  };
  priority: number;
  active: boolean;
};

type ConfigData = {
  synonyms: Synonym[];
  rules: Rule[];
  outbox: Record<string, number>;
  provider: string;
  typesenseConfigured: boolean;
};

type AnalyticsData = {
  days: number;
  kpis: {
    searches: number;
    zeroResults: number;
    zeroResultRate: number;
    clicks: number;
    clickThroughRate: number;
    addToCarts: number;
  };
  queries: Array<{
    query: string;
    normalizedQuery: string;
    searches: number;
    zeroResults: number;
    clicks: number;
    addToCarts: number;
  }>;
};

const fieldClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

async function apiRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export default function SearchManagement() {
  const t = useTranslations("AdminSearchManagement");

  const [config, setConfig] = useState<ConfigData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [reindexing, setReindexing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextConfig, nextAnalytics] = await Promise.all([
        apiRequest("/api/admin/search/config"),
        apiRequest(`/api/admin/search/analytics?days=${days}`),
      ]);
      setConfig(nextConfig);
      setAnalytics(nextAnalytics);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const createSynonym = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await apiRequest("/api/admin/search/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "synonym",
          label: values.get("label"),
          terms: values.get("terms"),
          locale: values.get("locale"),
        }),
      });
      form.reset();
      toast.success(t("toasts.synonymCreated"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.synonymNotSaved"),
      );
    }
  };

  const createRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await apiRequest("/api/admin/search/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "rule",
          name: values.get("name"),
          query: values.get("query"),
          matchType: values.get("matchType"),
          priority: values.get("priority"),
          pinProductIds: values.get("pinProductIds"),
          boostProductIds: values.get("boostProductIds"),
          suggestedQueries: values.get("suggestedQueries"),
        }),
      });
      form.reset();
      toast.success(t("toasts.ruleCreated"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.ruleNotSaved"),
      );
    }
  };

  const setActive = async (
    kind: "synonym" | "rule",
    id: number,
    active: boolean,
  ) => {
    try {
      await apiRequest("/api/admin/search/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, active }),
      });
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.statusNotChanged"),
      );
    }
  };

  const remove = async (kind: "synonym" | "rule", id: number) => {
    if (!window.confirm(t("confirm.delete"))) return;
    try {
      await apiRequest("/api/admin/search/config", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id }),
      });
      toast.success(t("toasts.configDeleted"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.notDeleted"),
      );
    }
  };

  const reindex = async () => {
    setReindexing(true);
    try {
      const result = await apiRequest("/api/admin/search/reindex", {
        method: "POST",
      });
      toast.success(
        t("toasts.reindexQueued", {
          count: Number(result.queued ?? 0).toLocaleString(),
        }),
      );
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.reindexFailed"),
      );
    } finally {
      setReindexing(false);
    }
  };

  const kpis = analytics?.kpis;
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Search className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">
              {t("hero.badge")}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold">{t("hero.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("hero.description")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{" "}
          {t("actions.refresh")}
        </button>
      </header>

      {config ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <p>
            {t("provider.label")}{" "}
            <strong className="uppercase">{config.provider}</strong>
            <span className="mx-2 text-muted-foreground">•</span>
            {t("provider.typesenseLabel")}{" "}
            <strong>
              {config.typesenseConfigured
                ? t("provider.configured")
                : t("provider.notConfigured")}
            </strong>
            <span className="mx-2 text-muted-foreground">•</span>
            {t("provider.pendingJobs")}{" "}
            <strong>{config.outbox.PENDING ?? 0}</strong>
          </p>
          <button
            type="button"
            onClick={() => void reindex()}
            disabled={reindexing}
            className="h-9 rounded-lg border px-3 text-xs font-bold hover:bg-muted disabled:opacity-50"
          >
            {reindexing ? t("actions.queuing") : t("actions.queueReindex")}
          </button>
        </div>
      ) : null}

      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <BarChart3 className="h-5 w-5 text-primary" />{" "}
            {t("performance.title")}
          </h2>
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className={`${fieldClass} w-auto`}
          >
            <option value={7}>{t("performance.range.last7")}</option>
            <option value={30}>{t("performance.range.last30")}</option>
            <option value={90}>{t("performance.range.last90")}</option>
          </select>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { key: "searches", value: kpis?.searches ?? 0 },
            {
              key: "zeroResultRate",
              value: `${kpis?.zeroResultRate ?? 0}%`,
            },
            { key: "clicks", value: kpis?.clicks ?? 0 },
            {
              key: "clickThroughRate",
              value: `${kpis?.clickThroughRate ?? 0}%`,
            },
            { key: "addToCarts", value: kpis?.addToCarts ?? 0 },
          ].map((entry) => (
            <div
              key={entry.key}
              className="rounded-lg border bg-background p-3"
            >
              <p className="text-xs text-muted-foreground">
                {t(`performance.kpis.${entry.key}`)}
              </p>
              <p className="mt-1 text-xl font-bold">{entry.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{t("performance.table.query")}</th>
                <th className="px-3 py-2">{t("performance.table.searches")}</th>
                <th className="px-3 py-2">
                  {t("performance.table.zeroResults")}
                </th>
                <th className="px-3 py-2">{t("performance.table.clicks")}</th>
                <th className="px-3 py-2">{t("performance.table.cart")}</th>
              </tr>
            </thead>
            <tbody>
              {analytics?.queries.slice(0, 30).map((row) => (
                <tr key={row.normalizedQuery} className="border-t">
                  <td className="px-3 py-2 font-medium">{row.query}</td>
                  <td className="px-3 py-2">{row.searches}</td>
                  <td className="px-3 py-2">{row.zeroResults}</td>
                  <td className="px-3 py-2">{row.clicks}</td>
                  <td className="px-3 py-2">{row.addToCarts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <h2 className="text-lg font-bold">{t("synonyms.title")}</h2>
          <form
            onSubmit={createSynonym}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input
              name="label"
              required
              maxLength={100}
              placeholder={t("synonyms.placeholders.label")}
              className={fieldClass}
            />
            <input
              name="locale"
              defaultValue="en-BD"
              maxLength={16}
              aria-label={t("synonyms.localeAria")}
              className={fieldClass}
            />
            <input
              name="terms"
              required
              placeholder={t("synonyms.placeholders.terms")}
              className={`${fieldClass} sm:col-span-2`}
            />
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground sm:col-span-2">
              <Plus className="h-4 w-4" /> {t("synonyms.addButton")}
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {config?.synonyms.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.terms.join(" · ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void setActive("synonym", item.id, !item.active)
                    }
                    className={`rounded-md px-2 py-1 text-xs font-bold ${
                      item.active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.active ? t("status.active") : t("status.paused")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove("synonym", item.id)}
                    className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label={t("synonyms.deleteAria", {
                      label: item.label,
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <h2 className="text-lg font-bold">{t("rules.title")}</h2>
          <form
            onSubmit={createRule}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input
              name="name"
              required
              maxLength={120}
              placeholder={t("rules.placeholders.name")}
              className={fieldClass}
            />
            <input
              name="query"
              required
              maxLength={100}
              placeholder={t("rules.placeholders.query")}
              className={fieldClass}
            />
            <select name="matchType" className={fieldClass}>
              <option value="CONTAINS">{t("matchTypes.CONTAINS")}</option>
              <option value="PREFIX">{t("matchTypes.PREFIX")}</option>
              <option value="EXACT">{t("matchTypes.EXACT")}</option>
            </select>
            <input
              name="priority"
              type="number"
              defaultValue={0}
              min={-10000}
              max={10000}
              placeholder={t("rules.placeholders.priority")}
              className={fieldClass}
            />
            <input
              name="pinProductIds"
              placeholder={t("rules.placeholders.pinProductIds")}
              className={fieldClass}
            />
            <input
              name="boostProductIds"
              placeholder={t("rules.placeholders.boostProductIds")}
              className={fieldClass}
            />
            <input
              name="suggestedQueries"
              placeholder={t("rules.placeholders.suggestedQueries")}
              className={`${fieldClass} sm:col-span-2`}
            />
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground sm:col-span-2">
              <Plus className="h-4 w-4" /> {t("rules.addButton")}
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {config?.rules.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("rules.summary", {
                      matchType: t(`matchTypes.${item.matchType}`),
                      query: item.query,
                      priority: item.priority,
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void setActive("rule", item.id, !item.active)
                    }
                    className={`rounded-md px-2 py-1 text-xs font-bold ${
                      item.active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.active ? t("status.active") : t("status.paused")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove("rule", item.id)}
                    className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label={t("rules.deleteAria", { name: item.name })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
