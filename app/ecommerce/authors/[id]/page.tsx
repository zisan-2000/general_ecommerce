import { notFound } from "next/navigation";
import CatalogProductGrid from "@/components/ecommarce/catalog/CatalogProductGrid";
import { getStorefrontBooks } from "@/lib/book-catalog";
import { isFeatureEnabled } from "@/lib/store-features-server";

export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isFeatureEnabled("AUTHORS"))) notFound();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const books = await getStorefrontBooks();
  const authored = books.filter((book) => book.writer?.id === id);
  const author = authored[0]?.writer;
  if (!author) notFound();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container px-3 py-8 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Author</p>
        <h1 className="mb-8 mt-2 text-3xl font-bold sm:text-4xl">{author.name}</h1>
        <CatalogProductGrid products={authored.map((book) => book.product)} />
      </div>
    </main>
  );
}
