import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  CreditCard,
  FileText,
  PackageCheck,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { getSiteSettingsForSeo } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, t] = await Promise.all([
    getSiteSettingsForSeo(),
    getTranslations("StorefrontSupport.terms"),
  ]);
  return {
    title: t("metadata.title"),
    description: t("metadata.description", { site: settings.siteTitle }),
    alternates: { canonical: "/ecommerce/terms" },
  };
}

const sections = [
  { icon: ShoppingCart, key: "orders" },
  { icon: CreditCard, key: "pricing" },
  { icon: PackageCheck, key: "delivery" },
  { icon: Wrench, key: "warranty" },
  { icon: BadgeCheck, key: "digital" },
  { icon: ShieldCheck, key: "accounts" },
  { icon: Scale, key: "returns" },
] as const;

export default async function TermsPage() {
  const [settings, t] = await Promise.all([
    getSiteSettingsForSeo(),
    getTranslations("StorefrontSupport.terms"),
  ]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-muted/40">
        <div className="container mx-auto max-w-5xl px-4 py-14 sm:py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="mt-5 text-3xl font-bold sm:text-4xl">{t("title")}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            {t("intro", { site: settings.siteTitle })}
          </p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            {t("effectiveDate")}
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-2xl border border-border bg-card p-5 text-sm leading-7 text-muted-foreground sm:p-6">
          {t("agreement")}
        </div>

        <div className="mt-8 space-y-4">
          {sections.map((section, index) => (
            <article key={section.key} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <section.icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    {index + 1}. {t(`sections.${section.key}.title`)}
                  </h2>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                    <p>{t(`sections.${section.key}.first`)}</p>
                    <p>{t(`sections.${section.key}.second`)}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <h2 className="text-lg font-bold">{t("changes.title")}</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("changes.description")}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild size="sm">
              <Link href="/ecommerce/contact">{t("changes.contact")}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/ecommerce/returns">{t("changes.returns")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
