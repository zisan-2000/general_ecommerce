"use client";

import { useState } from "react";
import { Calculator, ChevronDown, Loader2, MapPin, Truck } from "lucide-react";
import { ALLOWED_SHIPPING_AREAS, type AllowedShippingArea } from "@/lib/shipping-areas";
import { useLocale, useTranslations } from "next-intl";

const BANGLADESH_DELIVERY_AREAS = ALLOWED_SHIPPING_AREAS.filter(
  (area) => area !== "Outside Bangladesh",
);

type ShippingQuote = {
  shippingCost: number;
  total: number;
  reason: string;
  matchedRate: {
    area: string;
    freeMinOrder: number | null;
    estimatedDays: number | null;
  } | null;
};

function money(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "BDT",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProductConversionTools({
  price,
  currency,
}: {
  price: number;
  currency: string;
}) {
  const t = useTranslations("StorefrontProduct.conversion");
  const locale = useLocale();
  const [months, setMonths] = useState(6);
  const [district, setDistrict] = useState("Dhaka");
  const [area, setArea] = useState<AllowedShippingArea>("Dhaka");
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checkDelivery = async () => {
    if (!district.trim()) {
      setError(t("errors.districtRequired"));
      return;
    }
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: "Bangladesh",
          district: district.trim(),
          area,
          subtotal: price,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("errors.quoteFailed"));
      setQuote(data as ShippingQuote);
    } catch (caught) {
      setQuote(null);
      setError(caught instanceof Error ? caught.message : t("errors.quoteFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <details className="group overflow-hidden rounded-md border border-border bg-card" aria-labelledby="emi-heading">
        <summary className="flex h-12 cursor-pointer list-none items-center gap-2 px-3 text-foreground transition hover:bg-muted [&::-webkit-details-marker]:hidden">
          <Calculator className="h-4 w-4 shrink-0 text-[#174a92]" />
          <span id="emi-heading" className="min-w-0 flex-1 text-[12px] font-bold">{t("emi.title")}</span>
          <span className="text-[10px] font-medium text-muted-foreground">{t("emi.from", { amount: money(price / 12, currency, locale) })}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-border bg-muted/60 p-3">
          <p className="text-[11px] font-medium text-muted-foreground">{t("emi.choosePeriod")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[3, 6, 9, 12].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMonths(option)}
                className={`rounded border px-2.5 py-1 text-[11px] font-bold ${months === option ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/50"}`}
              >
                {t("emi.months", { count: option })}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[16px] font-bold text-[#174a92]">
            {money(price / months, currency, locale)} <span className="text-xs font-medium text-muted-foreground">{t("emi.perMonth")}</span>
          </p>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
            {t("emi.note")}
          </p>
        </div>
      </details>

      <details className="group overflow-hidden rounded-md border border-border bg-card" aria-labelledby="delivery-heading">
        <summary className="flex h-12 cursor-pointer list-none items-center gap-2 px-3 text-foreground transition hover:bg-muted [&::-webkit-details-marker]:hidden">
          <MapPin className="h-4 w-4 shrink-0 text-[#174a92]" />
          <span id="delivery-heading" className="min-w-0 flex-1 text-[12px] font-bold">{t("delivery.title")}</span>
          <span className="text-[10px] font-medium text-muted-foreground">{t("delivery.checkArea")}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-border bg-muted/60 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="sr-only" htmlFor="delivery-district">{t("delivery.district")}</label>
            <input
              id="delivery-district"
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              placeholder={t("delivery.district")}
              className="h-9 rounded border border-input bg-background px-3 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-ring/30"
            />
            <label className="sr-only" htmlFor="delivery-area">{t("delivery.area")}</label>
            <select
              id="delivery-area"
              value={area}
              onChange={(event) => setArea(event.target.value as AllowedShippingArea)}
              className="h-9 rounded border border-input bg-background px-3 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-ring/30"
            >
              {BANGLADESH_DELIVERY_AREAS.map((option) => (
                <option key={option} value={option}>
                  {option === "Dhaka" ? t("areas.dhaka") : t("areas.outsideDhaka")}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={checkDelivery}
            disabled={loading}
            className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded border border-border bg-card text-[12px] font-bold text-foreground hover:bg-accent disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
            {loading ? t("delivery.checking") : t("delivery.check")}
          </button>
          <div className="mt-2 text-[11px]" aria-live="polite">
            {error ? <p className="text-destructive">{error}</p> : null}
            {quote ? (
              <p className="text-muted-foreground">
                <strong className="text-foreground">
                  {quote.shippingCost === 0 ? t("delivery.free") : t("delivery.cost", { amount: money(quote.shippingCost, currency, locale) })}
                </strong>
                {quote.matchedRate?.estimatedDays ? ` · ${t("delivery.businessDays", { count: quote.matchedRate.estimatedDays })}` : ` · ${t("delivery.confirmedAtCheckout")}`}
              </p>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  );
}
