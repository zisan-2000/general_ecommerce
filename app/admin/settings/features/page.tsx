"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ResolvedStoreFeature, StoreFeatureKey } from "@/lib/store-features";
import { STOREFRONT_FEATURES_CHANGED_EVENT } from "@/providers/storefront-features-provider";

type FeatureResponse = {
  storage?: "database" | "defaults";
  features?: ResolvedStoreFeature[];
  error?: string;
  blockedBy?: string[];
};

export default function StoreFeaturesPage() {
  const [features, setFeatures] = useState<ResolvedStoreFeature[]>([]);
  const [storage, setStorage] = useState<"database" | "defaults">("database");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<StoreFeatureKey | null>(null);
  const [error, setError] = useState("");

  const loadFeatures = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/store-features", {
        cache: "no-store",
      });
      const payload = (await response.json()) as FeatureResponse;
      if (!response.ok) throw new Error(payload.error || "Features could not be loaded.");
      setFeatures(payload.features ?? []);
      setStorage(payload.storage ?? "database");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Features could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeatures();
  }, [loadFeatures]);

  const updateFeature = useCallback(
    async (feature: ResolvedStoreFeature) => {
      setSaving(feature.key);
      try {
        const response = await fetch("/api/admin/store-features", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: feature.key, enabled: !feature.configuredEnabled }),
        });
        const payload = (await response.json()) as FeatureResponse;
        if (!response.ok) {
          const blocked = payload.blockedBy?.length
            ? ` Blocked by: ${payload.blockedBy.join(", ")}.`
            : "";
          throw new Error(`${payload.error || "Feature was not updated."}${blocked}`);
        }
        setFeatures(payload.features ?? []);
        setStorage("database");
        window.dispatchEvent(new Event(STOREFRONT_FEATURES_CHANGED_EVENT));
        toast.success(`${feature.label} ${feature.configuredEnabled ? "disabled" : "enabled"}.`);
      } catch (updateError) {
        toast.error(updateError instanceof Error ? updateError.message : "Feature was not updated.");
      } finally {
        setSaving(null);
      }
    },
    [],
  );

  return (
    <main className="p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-[0.16em]">Store configuration</p>
            </div>
            <h1 className="mt-2 text-2xl font-black">Optional modules</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              These switches control navigation, storefront discovery, management actions and new purchases. Existing order and audit history stays readable.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadFeatures()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>

        {storage === "defaults" ? (
          <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>The StoreFeature migration has not been applied. Safe defaults are active, but changes cannot be saved yet.</p>
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading && features.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-40 animate-pulse rounded-2xl border bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {features.map((feature) => {
              const busy = saving === feature.key;
              return (
                <section key={feature.key} className="rounded-2xl border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-bold">{feature.label}</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={feature.configuredEnabled}
                      aria-label={`${feature.configuredEnabled ? "Disable" : "Enable"} ${feature.label}`}
                      disabled={busy || storage === "defaults"}
                      onClick={() => void updateFeature(feature)}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${feature.configuredEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                    >
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${feature.configuredEnabled ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-2.5 py-1 font-semibold ${feature.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {feature.enabled ? "Enabled" : "Disabled"}
                    </span>
                    {feature.blockedBy.map((dependency) => (
                      <span key={dependency} className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        Requires {dependency}
                      </span>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
