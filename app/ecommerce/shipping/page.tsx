import type { Metadata } from "next";
import Link from "next/link";
import {
  Box,
  CheckCircle2,
  Clock3,
  Headphones,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("StorefrontSupport.shipping");
  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
    alternates: { canonical: "/ecommerce/shipping" },
  };
}

const steps = [
  { icon: PackageCheck, key: "confirmation" },
  { icon: Box, key: "packing" },
  { icon: Truck, key: "handover" },
  { icon: MapPin, key: "delivery" },
] as const;

const guidance = ["address", "estimate", "handling", "delays", "damage", "retain"] as const;

export default async function ShippingPolicyPage() {
  const t = await getTranslations("StorefrontSupport.shipping");
  const overview = [
    { icon: Clock3, key: "estimate" },
    { icon: ShieldCheck, key: "protection" },
    { icon: Headphones, key: "support" },
  ] as const;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto max-w-6xl px-4 py-16 text-center sm:py-20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/15">
            <Truck className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="mt-5 text-3xl font-bold sm:text-4xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-primary-foreground/85 sm:text-base">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {overview.map((item) => (
            <article
              key={item.key}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <item.icon className="h-6 w-6 text-primary" aria-hidden />
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t(`overview.${item.key}Title`)}
              </p>
              <h2 className="mt-1 text-lg font-bold">{t(`overview.${item.key}Value`)}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(`overview.${item.key}Note`)}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-14">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
              {t("process.eyebrow")}
            </p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
              {t("process.title")}
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <article
                key={step.key}
                className="relative rounded-2xl border border-border bg-card p-6"
              >
                <span className="absolute right-5 top-5 text-xs font-bold text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-5 font-bold">{t(`process.${step.key}Title`)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t(`process.${step.key}Description`)}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-8 rounded-2xl border border-border bg-muted/35 p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
              {t("guidance.eyebrow")}
            </p>
            <h2 className="mt-3 text-2xl font-bold">{t("guidance.title")}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {t("guidance.description")}
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {guidance.map((item) => (
              <li
                key={item}
                className="flex gap-3 rounded-xl border border-border bg-card p-4 text-sm leading-6"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{t(`guidance.items.${item}`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold">{t("cta.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("cta.description")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="sm">
              <Link href="/ecommerce/contact">{t("cta.contact")}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/ecommerce/user/orders">{t("cta.orders")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
