"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type TrackData = {
  trackingNumber?: string | null;
  externalId?: string | null;
  status: string;
  courierStatus?: string | null;
  trackingUrl?: string | null;
  lastSyncedAt?: string | null;
  courier?: {
    name?: string;
    type?: string | null;
  } | null;
  order?: {
    id: number;
    name: string;
    phone_number: string;
  } | null;
};

type Props = {
  params: Promise<{ trackingNumber: string }>;
};

export default function TrackingPage({ params }: Props) {
  const t = useTranslations("StorefrontSupport.tracking");
  const locale = useLocale();
  const { trackingNumber } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TrackData | null>(null);

  useEffect(() => {
    if (!trackingNumber) return;
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/track/${trackingNumber}`, { cache: "no-store" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(t("errors.load"));
        }
        if (!active) return;
        setData(payload as TrackData);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : t("errors.load"));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const intervalId = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [t, trackingNumber]);

  const statusColor = useMemo(() => {
    const s = data?.status?.toUpperCase();
    if (s === "DELIVERED") return "text-emerald-600";
    if (s === "RETURNED" || s === "CANCELLED") return "text-red-600";
    if (s === "IN_TRANSIT" || s === "OUT_FOR_DELIVERY") return "text-blue-600";
    return "text-amber-600";
  }, [data?.status]);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("trackingNumber")}: {trackingNumber || "..."}
        </p>

        {loading && <p className="mt-6 text-sm text-muted-foreground">{t("loading")}</p>}
        {error && (
          <div className="mt-6 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <div className="mt-6 space-y-3 text-sm">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p>
                <span className="font-semibold">{t("courier")}:</span>{" "}
                {data.courier?.name || t("notAvailable")} {data.courier?.type ? `(${data.courier.type})` : ""}
              </p>
              <p>
                <span className="font-semibold">{t("status")}:</span>{" "}
                <span className={statusColor}>{t(`statuses.${data.status.toLowerCase()}` as any)}</span>
              </p>
              <p>
                <span className="font-semibold">{t("courierStatus")}:</span>{" "}
                {data.courierStatus || t("notAvailable")}
              </p>
              <p>
                <span className="font-semibold">{t("lastSynced")}:</span>{" "}
                {data.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString(locale) : t("notAvailable")}
              </p>
            </div>

            {data.order && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p>
                  <span className="font-semibold">{t("orderId")}:</span> {data.order.id}
                </p>
                <p>
                  <span className="font-semibold">{t("recipient")}:</span> {data.order.name}
                </p>
                <p>
                  <span className="font-semibold">{t("phone")}:</span> {data.order.phone_number}
                </p>
              </div>
            )}

            {data.trackingUrl && (
              <a
                href={data.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                {t("openCourier")}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
