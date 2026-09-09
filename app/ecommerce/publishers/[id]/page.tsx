import { notFound } from "next/navigation";
import CatalogProductGrid from "@/components/ecommarce/catalog/CatalogProductGrid";
import { getStorefrontBooks } from "@/lib/book-catalog";
import { isFeatureEnabled } from "@/lib/store-features-server";

export default async function PublisherPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isFeatureEnabled("BOOKS"))) notFound();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const [books, compareEnabled] = await Promise.all([getStorefrontBooks(), isFeatureEnabled("COMPARE")]);
  const published = books.filter((book) => book.publisher?.id === id);
  const publisher = published[0]?.publisher;
  if (!publisher) notFound();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container px-3 py-8 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Publisher</p>
        <h1 className="mb-8 mt-2 text-3xl font-bold sm:text-4xl">{publisher.name}</h1>
        <CatalogProductGrid products={published.map((book) => book.product)} compareEnabled={compareEnabled} />
      </div>
    </main>
  );
}
