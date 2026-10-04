import Link from "next/link";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { type PolicyKind } from "@/lib/policy-content";
import ManagedFAQ from "@/components/ecommarce/ManagedFAQ";
import ProductRichText from "@/components/ecommarce/product-detail/ProductRichText";
import { getSiteSettingsForSeo } from "@/lib/seo";

export default async function ManagedPolicyPage({ kind }: { kind: PolicyKind }) {
  await connection();
  const [locale, settings] = await Promise.all([getLocale(), getSiteSettingsForSeo()]);
  const t = await getTranslations("ManagedPolicies");
  const title = kind === "sitemap" ? (await getTranslations("StorefrontShell.footer"))("links.sitemap")
    : (await getTranslations(`StorefrontSupport.${kind}`))("title");
  // Do not fall back to another language or bundled content after a deletion.
  const records = await prisma.storePolicyContent.findMany({
    where: { kind, locale, isPublished: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (kind === "faq") return <ManagedFAQ entries={records.map(record => ({ id: record.id, question: record.title, answer: record.content, category: record.category }))} />;
  const updatedAt = records.reduce<Date | null>((latest, item) => !latest || item.updatedAt > latest ? item.updatedAt : latest, null);
  const formatDate = (date: Date, timeZone = settings.timezone) => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone }).format(date);
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"><div className="container mx-auto max-w-4xl px-4 py-16 text-center"><h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>{updatedAt && <p className="mt-4 text-sm opacity-85">{t("updated")} {formatDate(updatedAt)}</p>}</div></section>
      <section className="container mx-auto max-w-4xl space-y-6 px-4 py-12">
        {!records.length && <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">{t("empty")}</p>}
        {records.map(record => <article key={record.id} className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {record.category && <p className="mb-2 text-sm font-medium text-primary">{record.category}</p>}
          <h2 className="text-xl font-semibold">{kind === "sitemap" && record.linkUrl ? <Link href={record.linkUrl} className="text-primary hover:underline">{record.title}</Link> : record.title}</h2>
          {record.effectiveDate && <p className="mt-2 text-xs text-muted-foreground">{t("effective")} {formatDate(record.effectiveDate, "UTC")}</p>}
          {record.content && (
            <ProductRichText
              content={record.content}
              className="mt-4 break-words text-sm leading-7 text-muted-foreground"
            />
          )}
        </article>)}
        <Link href="/ecommerce/contact" className="inline-block text-sm font-medium text-primary hover:underline">{t("contact")}</Link>
      </section>
    </main>
  );
}
