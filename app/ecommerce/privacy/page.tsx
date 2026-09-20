import { CreditCard, Eye, Lock, Shield, User } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

const collectedGroups = [
  { icon: User, key: "personal", items: ["nameEmail", "phone", "address"] },
  { icon: CreditCard, key: "order", items: ["preferences", "history", "payment"] },
  { icon: Eye, key: "usage", items: ["browsing", "wishlist", "pageViews"] },
  { icon: Shield, key: "notStored", items: ["bank", "card", "password"] },
] as const;

const usageGroups = [
  { key: "essential", items: ["processing", "account", "support", "recommendations"] },
  { key: "permission", items: ["marketing", "offers", "notifications", "surveys"] },
] as const;

export default async function PrivacyPolicyPage() {
  const t = await getTranslations("StorefrontSupport.privacy");
  const overview = [
    { icon: Lock, key: "security" },
    { icon: Eye, key: "transparency" },
    { icon: User, key: "control" },
  ] as const;
  const rights = [
    { icon: Eye, key: "access" },
    { icon: User, key: "update" },
  ] as const;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-gradient-to-r from-primary to-primary/80 py-16 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-background/20">
            <Shield className="h-8 w-8" aria-hidden />
          </div>
          <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
          <p className="mt-4 text-lg text-primary-foreground/90">{t("subtitle")}</p>
        </div>
      </section>

      <section className="bg-background py-12">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="grid gap-6 md:grid-cols-3">
            {overview.map((item) => (
              <article key={item.key} className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
                <item.icon className="mx-auto h-8 w-8 text-primary" aria-hidden />
                <h2 className="mt-3 font-semibold">{t(`overview.${item.key}Title`)}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t(`overview.${item.key}Description`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-card py-12">
        <div className="container mx-auto max-w-4xl px-4">
          <h2 className="text-center text-2xl font-bold">{t("collect.title")}</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            {collectedGroups.map((group) => (
              <article key={group.key} className="flex items-start gap-4">
                <group.icon className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden />
                <div>
                  <h3 className="font-semibold">{t(`collect.${group.key}.title`)}</h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {group.items.map((item) => (
                      <li key={item}>• {t(`collect.${group.key}.${item}`)}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/30 py-12">
        <div className="container mx-auto max-w-4xl px-4">
          <h2 className="text-center text-2xl font-bold">{t("usage.title")}</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            {usageGroups.map((group) => (
              <article key={group.key} className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-semibold text-primary">{t(`usage.${group.key}.title`)}</h3>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span>{t(`usage.${group.key}.${item}`)}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-card py-12">
        <div className="container mx-auto max-w-4xl px-4">
          <h2 className="text-center text-2xl font-bold">{t("rights.title")}</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {rights.map((right) => (
              <article key={right.key} className="rounded-xl border border-border bg-background p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <right.icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="mt-3 font-semibold">{t(`rights.${right.key}Title`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(`rights.${right.key}Description`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-primary to-primary/80 py-12 text-primary-foreground">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold">{t("cta.title")}</h2>
          <p className="mt-4 opacity-90">{t("cta.description")}</p>
          <Button asChild className="mt-6 bg-background text-foreground hover:bg-background/90">
            <Link href="/ecommerce/contact">{t("cta.action")}</Link>
          </Button>
          <p className="mt-8 border-t border-primary-foreground/20 pt-6 text-sm opacity-80">
            <strong>{t("cta.lastUpdated")}</strong> {t("cta.date")}
            <br />
            {t("cta.updateNote")}
          </p>
        </div>
      </section>
    </main>
  );
}
