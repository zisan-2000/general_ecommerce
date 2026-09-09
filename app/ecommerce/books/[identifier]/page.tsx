import { notFound, permanentRedirect } from "next/navigation";
import { getStorefrontBooks } from "@/lib/book-catalog";
import { isFeatureEnabled } from "@/lib/store-features-server";

type LegacyProductPageProps = {
  params: Promise<{ identifier: string }>;
};

export default async function LegacyProductPage({
  params,
}: LegacyProductPageProps) {
  if (!(await isFeatureEnabled("BOOKS"))) notFound();
  const { identifier } = await params;
  const normalized = decodeURIComponent(identifier).trim();
  const numericId = /^\d+$/.test(normalized) ? Number(normalized) : null;

  const books = await getStorefrontBooks();
  const product = books.find((book) =>
    numericId
      ? book.product.id === numericId
      : book.product.slug === normalized.toLowerCase(),
  )?.product;

  if (!product) notFound();
  permanentRedirect(`/ecommerce/products/${product.id}`);
}

