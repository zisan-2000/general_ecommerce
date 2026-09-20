"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

type ProofResponse = {
  shipment: {
    id: number;
    orderId: number;
    courier?: string | null;
    trackingNumber?: string | null;
    status: string;
    expectedDate?: string | null;
    deliveredAt?: string | null;
    confirmationReady: boolean;
  };
  order: {
    id: number;
    name: string;
    status: string;
    paymentStatus: string;
    createdAt: string;
  };
  proof?: {
    id: number;
    tickReceived: boolean;
    tickCorrectItems: boolean;
    tickGoodCondition: boolean;
    photoUrl?: string | null;
    note?: string | null;
    confirmedAt: string;
  } | null;
};

const CHECKS = [
  { key: "tickReceived", labelKey: "received" },
  { key: "tickCorrectItems", labelKey: "correctItems" },
  {
    key: "tickGoodCondition",
    labelKey: "goodCondition",
  },
] as const;

function formatDate(value: string | null | undefined, locale: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted/80 ${className}`}
      aria-hidden="true"
    />
  );
}

export function DeliveryConfirmationForm({ token }: { token: string }) {
  const t = useTranslations("CustomerAccount.deliveryConfirmation");
  const locale = useLocale();
  const [data, setData] = useState<ProofResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checks, setChecks] = useState({
    tickReceived: false,
    tickCorrectItems: false,
    tickGoodCondition: false,
  });

  useEffect(() => {
    if (!token) {
      setError(t("errors.invalidLink"));
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/delivery-proofs/confirm/${token}`, {
          cache: "no-store",
        });
        const payload = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(t("errors.load"));
        }

        setData(payload);
        if (payload?.proof) {
          setChecks({
            tickReceived: payload.proof.tickReceived,
            tickCorrectItems: payload.proof.tickCorrectItems,
            tickGoodCondition: payload.proof.tickGoodCondition,
          });
          setNote(payload.proof.note || "");
          setPhotoUrl(payload.proof.photoUrl || "");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("errors.load"),
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [t, token]);

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("confirmationToken", token);

      const res = await fetch("/api/upload/delivery-proofs", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.url) {
        throw new Error(
          t("errors.upload"),
        );
      }

      setPhotoUrl(payload.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.upload"));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/delivery-proofs/confirm/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          note,
          photoUrl: photoUrl || null,
          ...checks,
        }),
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(t("errors.submit"));
      }

      setData((current) =>
        current
          ? {
              ...current,
              shipment: {
                ...current.shipment,
                status: payload?.shipment?.status || current.shipment.status,
                deliveredAt:
                  payload?.shipment?.deliveredAt ||
                  current.shipment.deliveredAt,
              },
              proof: payload.proof,
            }
          : current,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("errors.submit"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-destructive">
        {error || t("errors.unavailable")}
      </div>
    );
  }

  const alreadyConfirmed = Boolean(data.proof);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {t("title")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">
              {t("confirmation")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("orderVia", {
                order: data.order.id,
                courier: data.shipment.courier
                  ? t("viaCourier", { courier: data.shipment.courier })
                  : "",
              })}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3 text-right text-card-foreground shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("shipmentStatus")}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {data.shipment.status}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("customer")}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {data.order.name}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <Truck className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("tracking")}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {data.shipment.trackingNumber || t("notAssigned")}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("deliveryTime")}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {formatDate(data.shipment.deliveredAt || data.shipment.expectedDate, locale, t("notAvailable"))}
          </p>
        </div>
      </div>

      {alreadyConfirmed ? (
        <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary p-3 text-primary-foreground">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {t("alreadyConfirmed")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("submittedOn", { date: formatDate(data.proof?.confirmedAt, locale, t("notAvailable")) })}
              </p>
            </div>
          </div>

          {data.proof?.note ? (
            <p className="mt-4 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
              {data.proof.note}
            </p>
          ) : null}

          {data.proof?.photoUrl ? (
            <a
              href={data.proof.photoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex text-sm font-medium text-primary underline"
            >
              {t("viewProofPhoto")}
            </a>
          ) : null}
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
            <p className="text-sm font-medium text-foreground">
              {t("instructions")}
            </p>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("pin")}
              </label>
              <input
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                maxLength={6}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base tracking-[0.32em] text-foreground outline-none ring-0 transition focus:border-primary"
                placeholder="000000"
              />
            </div>

            <div className="mt-5 space-y-3">
              {CHECKS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={checks[item.key]}
                    onChange={(event) =>
                      setChecks((current) => ({
                        ...current,
                        [item.key]: event.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>{t(`checks.${item.labelKey}`)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("optionalNote")}
              </label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                placeholder={t("notePlaceholder")}
              />
            </div>

            <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("optionalPhoto")}
              </label>
              <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
                <ImagePlus className="h-7 w-7 text-muted-foreground" />
                <span className="mt-3 text-sm font-medium text-foreground">
                  {t("uploadProof")}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  {t("photoHint")}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </label>

              {uploading ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("uploading")}
                </p>
              ) : null}

              {photoUrl ? (
                <a
                  href={photoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-medium text-primary underline"
                >
                  {t("viewPhoto")}
                </a>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || uploading}
            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("submit")}
          </button>
        </form>
      )}
    </div>
  );
}
