import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ManagedPolicyPage from "@/components/ecommarce/ManagedPolicyPage";
import { getSiteSettingsForSeo } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [t, settings] = await Promise.all([getTranslations("StorefrontSupport.terms"), getSiteSettingsForSeo()]);
  return { title: t("metadata.title"), description: t("metadata.description", { site: settings.siteTitle }), alternates: { canonical: "/ecommerce/terms" } };
}

export default function Page() {
  return <ManagedPolicyPage kind="terms" />;
}
