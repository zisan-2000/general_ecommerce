import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BookPartyGrid from "@/components/ecommarce/books/BookPartyGrid";
import { getStorefrontBooks } from "@/lib/book-catalog";
import { isFeatureEnabled } from "@/lib/store-features-server";

export const metadata: Metadata = { title: "Publishers", description: "Browse books by publisher." };

export default async function PublishersPage() {
  if (!(await isFeatureEnabled("BOOKS"))) notFound();
  const books = await getStorefrontBooks();
  const publishers = new Map<number, { id: number; name: string; image: string | null; bookCount: number }>();
  for (const book of books) {
    if (!book.publisher) continue;
    const current = publishers.get(book.publisher.id);
    publishers.set(book.publisher.id, { ...book.publisher, bookCount: (current?.bookCount ?? 0) + 1 });
  }
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container px-3 py-8 sm:px-6">
        <div className="mb-8"><p className="text-sm font-semibold uppercase tracking-widest text-primary">Book collection</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Publishers</h1></div>
        <BookPartyGrid parties={[...publishers.values()].sort((a, b) => a.name.localeCompare(b.name))} basePath="/ecommerce/publishers" emptyLabel="No publishers with available books were found." />
      </div>
    </main>
  );
}
