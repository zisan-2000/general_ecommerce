import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ManagedPolicyPage from "@/components/ecommarce/ManagedPolicyPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("StorefrontSupport.shipping");
  return { title: t("metadata.title"), description: t("metadata.description"), alternates: { canonical: "/ecommerce/shipping" } };
}

export default function Page() {
  return <ManagedPolicyPage kind="shipping" />;
}
