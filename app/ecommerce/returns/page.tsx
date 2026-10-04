import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ManagedPolicyPage from "@/components/ecommarce/ManagedPolicyPage";

export async function generateMetadata(): Promise<Metadata> {
  const title = (await getTranslations("StorefrontSupport.returns"))("title");
  return { title, alternates: { canonical: "/ecommerce/returns" } };
}

export default function Page() {
  return <ManagedPolicyPage kind="returns" />;
}
