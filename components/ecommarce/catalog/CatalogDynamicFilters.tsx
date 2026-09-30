"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import FilterSection from "./CatalogFilterSection";
import type { catalogFacetPage } from "@/lib/catalog-facet-page";

type FacetPage = ReturnType<typeof catalogFacetPage>;

export default function CatalogDynamicFilters({ initial, category, selections }: {
  initial: FacetPage;
  category: string;
  selections: Record<string, string[]>;
}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const locale = useLocale();
  const t = useTranslations("StorefrontCatalog.page");
  const bn = locale.startsWith("bn");
  useEffect(() => () => controller.current?.abort(), []);

  async function loadMore() {
    if (controller.current || data.nextOffset === null) return;
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ category, offset: String(data.nextOffset) });
      const response = await fetch(`/api/storefront/catalog-facets?${params}`, { signal: request.signal });
      if (!response.ok) throw new Error("Could not load filters");
      const next: FacetPage = await response.json();
      setData((current) => ({ groups: [...current.groups, ...next.groups], nextOffset: next.nextOffset }));
    } catch {
      if (!request.signal.aborted) setError(true);
    } finally {
      if (!request.signal.aborted) setLoading(false);
      controller.current = null;
    }
  }

  const visibleNames = new Set(data.groups.map((group) => group.name));
  return <>
    {Object.entries(selections).filter(([name]) => !visibleNames.has(name)).flatMap(([name, values]) =>
      values.map((value) => <input key={`${name}:${value}`} type="hidden" name={name} value={value} />),
    )}
    {data.groups.map((group) => {
      const selected = selections[group.name] ?? [];
      return <FilterSection key={group.name} title={group.title} badge={selected.length} defaultOpen={selected.length > 0}>
        <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
          {group.values.map((entry) => <label key={entry.value} className="flex cursor-pointer items-start justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
            <span className="flex min-w-0 items-start gap-2">
              <input type="checkbox" name={group.name} value={entry.value} defaultChecked={selected.includes(entry.value)} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
              <span className="break-words">{group.boolean ? t(entry.value === "true" ? "yes" : "no") : entry.value}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{entry.productCount}</span>
          </label>)}
        </div>
      </FilterSection>;
    })}
    {error ? <p role="alert" className="text-sm text-destructive">{bn ? "ফিল্টার লোড হয়নি। আবার চেষ্টা করুন।" : "Could not load filters. Please retry."}</p> : null}
    {data.nextOffset !== null ? <button type="button" disabled={loading} onClick={loadMore} className="w-full rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">
      {loading ? (bn ? "লোড হচ্ছে…" : "Loading…") : (bn ? "আরও ফিল্টার দেখুন" : "Show more filters")}
    </button> : null}
  </>;
}
