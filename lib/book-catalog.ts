import "server-only";

import { unstable_cache } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getEffectiveStorefrontCategoryIds } from "@/lib/category-navigation-server";
import { resolveCompatibleBookMetadata } from "@/lib/book-metadata";
import { getDisabledStorefrontProductTypes } from "@/lib/store-feature-gates-server";
import type { FeatureControlledProductType } from "@/lib/store-features";
import { catalogProductSelect, serializeCatalogProduct } from "@/lib/storefront-catalog";

const bookProductSelect = {
  ...catalogProductSelect,
  writerId: true,
  publisherId: true,
  writer: { select: { id: true, name: true, image: true, deleted: true } },
  publisher: { select: { id: true, name: true, image: true, deleted: true } },
  bookMetadata: {
    select: {
      writerId: true,
      publisherId: true,
      writer: { select: { id: true, name: true, image: true, deleted: true } },
      publisher: { select: { id: true, name: true, image: true, deleted: true } },
    },
  },
} as const satisfies Prisma.ProductSelect;

type RawBookProduct = Prisma.ProductGetPayload<{ select: typeof bookProductSelect }>;

function activeParty<T extends { deleted: boolean }>(party: T | null) {
  return party && !party.deleted ? party : null;
}

const readBookCatalog = unstable_cache(
  async (serializedDisabledTypes: string) => {
    const disabledTypes = JSON.parse(serializedDisabledTypes) as FeatureControlledProductType[];
    const activeCategoryIds = await getEffectiveStorefrontCategoryIds();
    const rows = await prisma.product.findMany({
      where: {
        deleted: false,
        available: true,
        categoryId: { in: activeCategoryIds },
        ...(disabledTypes.length ? { type: { notIn: disabledTypes } } : {}),
        OR: [
          { bookMetadata: { isNot: null } },
          { writerId: { not: null } },
          { publisherId: { not: null } },
        ],
      },
      orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: bookProductSelect,
    });

    return rows.flatMap((row: RawBookProduct) => {
      const effective = resolveCompatibleBookMetadata({
        legacy: { writerId: row.writerId, publisherId: row.publisherId },
        metadata: row.bookMetadata,
      });
      if (effective.writerId === null && effective.publisherId === null) return [];
      const metadataWriter = activeParty(row.bookMetadata?.writer ?? null);
      const metadataPublisher = activeParty(row.bookMetadata?.publisher ?? null);
      const legacyWriter = activeParty(row.writer);
      const legacyPublisher = activeParty(row.publisher);
      const writer = metadataWriter ?? legacyWriter;
      const publisher = metadataPublisher ?? legacyPublisher;
      return [{
        product: serializeCatalogProduct(row),
        writer: writer ? { id: writer.id, name: writer.name, image: writer.image } : null,
        publisher: publisher ? { id: publisher.id, name: publisher.name, image: publisher.image } : null,
      }];
    });
  },
  ["storefront-book-catalog-v1"],
  { revalidate: 60, tags: ["storefront-catalog", "storefront-books", "products"] },
);

export async function getStorefrontBooks() {
  const disabledTypes = await getDisabledStorefrontProductTypes();
  return readBookCatalog(JSON.stringify(disabledTypes));
}

export type StorefrontBook = Awaited<ReturnType<typeof getStorefrontBooks>>[number];
