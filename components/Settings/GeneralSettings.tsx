"use client";

import { useEffect, useState } from "react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  GOOGLE_ANALYTICS_DEFAULTS,
  GTM_ID,
  GA4_ID,
  parseGoogleAnalyticsSettings,
  type GoogleAnalyticsSettings,
} from "@/lib/analytics/config";

export default function GeneralSettings() {
  const [settings, setSettings] = useState<GoogleAnalyticsSettings>({
    ...GOOGLE_ANALYTICS_DEFAULTS,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/site", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "Failed to load settings");
        }
        if (active) {
          setSettings({
            ...GOOGLE_ANALYTICS_DEFAULTS,
            ...Object.fromEntries(
              Object.keys(GOOGLE_ANALYTICS_DEFAULTS).map((key) => [
                key,
                body[key] ??
                  GOOGLE_ANALYTICS_DEFAULTS[
                    key as keyof GoogleAnalyticsSettings
                  ],
              ]),
            ),
          });
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = parseGoogleAnalyticsSettings({ ...settings });
      setSaving(true);
      const response = await fetch("/api/site", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to save tracking settings");
      }
      setSettings(result);
      setMessage("Saved. Reload storefront tabs to apply the new configuration.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to save settings",
      );
    } finally {
      setSaving(false);
    }
  }

  function status(enabled: boolean, id: string | null, pattern: RegExp) {
    if (!settings.googleTrackingEnabled || !enabled) return "Disabled";
    return pattern.test(id?.trim() ?? "") ? "Configured" : "Invalid ID";
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={save}
        className="space-y-5 rounded-xl border bg-card p-6"
      >
        <h1 className="text-xl font-semibold">
          Google Analytics &amp; Tag Manager
        </h1>
        <p className="text-sm text-muted-foreground">
          Configuration status shows saved IDs, not a verified connection to
          Google. A container ID cannot identify its Google account owner.
        </p>
        <fieldset disabled={loading || saving} className="space-y-5">
          <label className="flex items-center justify-between gap-4">
            Enable Google tracking
            <Switch
              checked={settings.googleTrackingEnabled}
              onCheckedChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  googleTrackingEnabled: value,
                }))
              }
            />
          </label>
          <div className="space-y-3 rounded-lg border p-4">
            <label className="flex items-center justify-between gap-4">
              Enable Google Tag Manager
              <Switch
                checked={settings.googleTagManagerEnabled}
                onCheckedChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    googleTagManagerEnabled: value,
                  }))
                }
              />
            </label>
            <label htmlFor="gtm-id" className="block text-sm font-medium">
              GTM Container ID
            </label>
            <Input
              id="gtm-id"
              value={settings.googleTagManagerId ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  googleTagManagerId: event.target.value,
                }))
              }
              placeholder="GTM-MTXSMKW5"
            />
            <p className="text-sm text-muted-foreground">
              Example: GTM-MTXSMKW5. Status:{" "}
              {status(
                settings.googleTagManagerEnabled,
                settings.googleTagManagerId,
                GTM_ID,
              )}
            </p>
          </div>
          <div className="space-y-3 rounded-lg border p-4">
            <label className="flex items-center justify-between gap-4">
              Enable GA4
              <Switch
                checked={settings.googleAnalyticsEnabled}
                onCheckedChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    googleAnalyticsEnabled: value,
                  }))
                }
              />
            </label>
            <label htmlFor="ga4-id" className="block text-sm font-medium">
              GA4 Measurement ID
            </label>
            <Input
              id="ga4-id"
              value={settings.googleAnalyticsMeasurementId ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  googleAnalyticsMeasurementId: event.target.value,
                }))
              }
              placeholder="G-XXXXXXXXXX"
            />
            <p className="text-sm text-muted-foreground">
              Status:{" "}
              {status(
                settings.googleAnalyticsEnabled,
                settings.googleAnalyticsMeasurementId,
                GA4_ID,
              )}
              . GTM takes priority when enabled; direct GA4 runs only when GTM
              is disabled.
            </p>
          </div>
          <label className="flex items-center justify-between gap-4">
            Enable analytics debug mode
            <Switch
              checked={settings.googleAnalyticsDebugMode}
              onCheckedChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  googleAnalyticsDebugMode: value,
                }))
              }
            />
          </label>
          <p className="text-sm text-muted-foreground">
            Ecommerce events use the site&apos;s data layer and must be mapped
            to GA4 tags in GTM. Turning GA4 off here disables direct GA4; GA4
            tags inside GTM are managed in GTM.
          </p>
          <Button type="submit">
            {saving
              ? "Saving..."
              : loading
                ? "Loading..."
                : "Save Google tracking settings"}
          </Button>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
