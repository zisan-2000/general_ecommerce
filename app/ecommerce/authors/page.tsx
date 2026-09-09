import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BookPartyGrid from "@/components/ecommarce/books/BookPartyGrid";
import { getStorefrontBooks } from "@/lib/book-catalog";
import { isFeatureEnabled } from "@/lib/store-features-server";

export const metadata: Metadata = { title: "Authors", description: "Browse books by author." };

export default async function AuthorsPage() {
  if (!(await isFeatureEnabled("AUTHORS"))) notFound();
  const books = await getStorefrontBooks();
  const authors = new Map<number, { id: number; name: string; image: string | null; bookCount: number }>();
  for (const book of books) {
    if (!book.writer) continue;
    const current = authors.get(book.writer.id);
    authors.set(book.writer.id, { ...book.writer, bookCount: (current?.bookCount ?? 0) + 1 });
  }
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container px-3 py-8 sm:px-6">
        <div className="mb-8"><p className="text-sm font-semibold uppercase tracking-widest text-primary">Book collection</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Authors</h1></div>
        <BookPartyGrid parties={[...authors.values()].sort((a, b) => a.name.localeCompare(b.name))} basePath="/ecommerce/authors" emptyLabel="No authors with available books were found." />
      </div>
    </main>
  );
}
