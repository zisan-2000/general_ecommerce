import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function ProductNotFound() {
  const t = await getTranslations("StorefrontProduct.notFound");
  return (
    <main className="container flex min-h-[60vh] items-center justify-center px-4 py-16 text-center">
      <div className="max-w-lg rounded-3xl border bg-card p-8 shadow-sm">
        <PackageSearch className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-2xl font-black">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("description")}</p>
        <Link href="/ecommerce/products" className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-5 font-bold text-primary-foreground">{t("browse")}</Link>
      </div>
    </main>
  );
}
