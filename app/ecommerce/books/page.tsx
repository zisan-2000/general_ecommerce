import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CatalogProductGrid from "@/components/ecommarce/catalog/CatalogProductGrid";
import { getStorefrontBooks } from "@/lib/book-catalog";
import { isFeatureEnabled } from "@/lib/store-features-server";

export const metadata: Metadata = {
  title: "Books",
  description: "Browse available books by writer and publisher.",
};

export default async function BooksPage() {
  if (!(await isFeatureEnabled("BOOKS"))) notFound();
  const books = await getStorefrontBooks();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container px-3 py-8 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Book collection</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Books</h1>
          <p className="mt-3 text-muted-foreground">Explore books connected to the store’s configured writers and publishers.</p>
        </div>
        {books.length ? (
          <CatalogProductGrid products={books.map((book) => book.product)} />
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">No books are available yet.</div>
        )}
      </div>
    </main>
  );
}

