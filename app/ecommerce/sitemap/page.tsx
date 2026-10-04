import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ManagedPolicyPage from "@/components/ecommarce/ManagedPolicyPage";

export async function generateMetadata(): Promise<Metadata> {
  const title = (await getTranslations("StorefrontShell.footer"))("links.sitemap");
  return { title, alternates: { canonical: "/ecommerce/sitemap" } };
}

export default function Page() {
  return <ManagedPolicyPage kind="sitemap" />;
}
