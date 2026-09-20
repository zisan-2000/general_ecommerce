import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Boxes,
  Headphones,
  PackageCheck,
  ShoppingBag,
  ShieldCheck,
  Truck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSiteSettingsForSeo } from "@/lib/seo";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, t] = await Promise.all([
    getSiteSettingsForSeo(),
    getTranslations("StorefrontSupport.about"),
  ]);
  return {
    title: t("metadata.title"),
    description: t("metadata.description", { site: settings.siteTitle }),
    alternates: { canonical: "/ecommerce/about" },
  };
}

const capabilities = [
  { icon: ShoppingBag, key: "catalog" },
  { icon: BadgeCheck, key: "verified" },
  { icon: Boxes, key: "inventory" },
  { icon: ShieldCheck, key: "secure" },
  { icon: Truck, key: "delivery" },
  { icon: Headphones, key: "support" },
] as const;

export default async function AboutPage() {
  const [settings, t] = await Promise.all([
    getSiteSettingsForSeo(),
    getTranslations("StorefrontSupport.about"),
  ]);
  const features = [
    { icon: PackageCheck, key: "genuine" },
    { icon: Wrench, key: "guidance" },
    { icon: Truck, key: "coverage" },
    { icon: ShieldCheck, key: "checkout" },
  ] as const;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto grid gap-10 px-4 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-24">
          <div className="max-w-3xl">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-primary-foreground/75">
              {t("eyebrow", { site: settings.siteTitle })}
            </p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-primary-foreground/85 sm:text-base">
              {t("subtitle", { tagline: settings.storeTagline })}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link href="/ecommerce/products">{t("explore")}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link href="/ecommerce/contact">{t("contact")}</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-4 backdrop-blur-sm">
            {features.map((feature) => (
              <div
                key={feature.key}
                className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-4"
              >
                <feature.icon className="mb-3 h-6 w-6" aria-hidden />
                <p className="text-sm font-semibold">
                  {t(`features.${feature.key}Title`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-14 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
            {t("values.eyebrow")}
          </p>
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
            {t("values.title")}
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
            {t("values.description")}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((capability) => (
            <article
              key={capability.key}
              className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <capability.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-base font-bold">
                {t(`values.${capability.key}Title`)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(`values.${capability.key}Description`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/35">
        <div className="container mx-auto grid gap-8 px-4 py-14 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
              {t("commitment.eyebrow")}
            </p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
              {t("commitment.title")}
            </h2>
          </div>
          <div className="space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
            <p>
              {t("commitment.first")}
            </p>
            <p>
              {t("commitment.second")}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
