import type { Metadata } from "next";
import ContactPageClient from "./ContactPageClient";
import { getSiteSettingsForSeo } from "@/lib/seo";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, t] = await Promise.all([
    getSiteSettingsForSeo(),
    getTranslations("StorefrontSupport.contact"),
  ]);
  return {
    title: t("metadata.title"),
    description: t("metadata.description", { site: settings.siteTitle }),
    alternates: { canonical: "/ecommerce/contact" },
  };
}

type ContactPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const [settings, query, t] = await Promise.all([
    getSiteSettingsForSeo(),
    searchParams,
    getTranslations("StorefrontSupport.contact"),
  ]);
  const rawSubject = Array.isArray(query.subject)
    ? query.subject[0]
    : query.subject;
  const normalizedSubject = String(rawSubject || "").trim().slice(0, 120);
  const subjectLabels: Record<string, string> = {
    "corporate-sales": t("subjects.corporate"),
    "service-booking": t("subjects.service"),
  };
  const initialSubject = subjectLabels[normalizedSubject.toLowerCase()] || normalizedSubject;

  return (
    <ContactPageClient
      siteTitle={settings.siteTitle}
      contactEmail={settings.contactEmail}
      contactNumber={settings.contactNumber}
      address={settings.address}
      initialSubject={initialSubject}
    />
  );
}
