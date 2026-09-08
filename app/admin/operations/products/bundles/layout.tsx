import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/store-features-server";

export default async function BundlesLayout({ children }: { children: ReactNode }) {
  if (!(await isFeatureEnabled("BUNDLES"))) notFound();
  return children;
}
