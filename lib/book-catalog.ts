import "server-only";

import { compressedCache } from "@/lib/compressed-cache";
import { storefrontPage, STOREFRONT_PAGE_SIZE } from "@/lib/storefront-pagination";
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

type BookOptions = { page?: number; writerId?: number; publisherId?: number; identifier?: string };

async function bookWhere(disabledTypes: FeatureControlledProductType[], options: BookOptions = {}): Promise<Prisma.ProductWhereInput> {
  const activeCategoryIds = await getEffectiveStorefrontCategoryIds();
  const and: Prisma.ProductWhereInput[] = [];
  if (options.writerId) and.push({ OR: [
    { bookMetadata: { writer: { id: options.writerId, deleted: false } } },
    { AND: [{ OR: [{ bookMetadata: { is: null } }, { bookMetadata: { writer: { is: null } } }, { bookMetadata: { writer: { deleted: true } } }] }, { writer: { id: options.writerId, deleted: false } }] },
  ] });
  if (options.publisherId) and.push({ OR: [
    { bookMetadata: { publisher: { id: options.publisherId, deleted: false } } },
    { AND: [{ OR: [{ bookMetadata: { is: null } }, { bookMetadata: { publisher: { is: null } } }, { bookMetadata: { publisher: { deleted: true } } }] }, { publisher: { id: options.publisherId, deleted: false } }] },
  ] });
  return {
    deleted: false, available: true, categoryId: { in: activeCategoryIds },
    ...(disabledTypes.length ? { type: { notIn: disabledTypes } } : {}),
    OR: [
      { bookMetadata: { writerId: { not: null } } }, { bookMetadata: { publisherId: { not: null } } },
      { writerId: { not: null } }, { publisherId: { not: null } },
    ],
    ...(and.length ? { AND: and } : {}),
    ...(options.identifier ? (/^\d+$/.test(options.identifier) ? { id: Number(options.identifier) } : { slug: options.identifier.toLowerCase() }) : {}),
  };
}

const readBookCatalog = compressedCache(
  async (serializedDisabledTypes: string, serializedOptions: string) => {
    const disabledTypes = JSON.parse(serializedDisabledTypes) as FeatureControlledProductType[];
    const options = JSON.parse(serializedOptions) as BookOptions;
    const where = await bookWhere(disabledTypes, options);
    const total = await prisma.product.count({ where });
    const page = Math.min(storefrontPage(options.page), Math.max(1, Math.ceil(total / STOREFRONT_PAGE_SIZE)));
    const rows = await prisma.product.findMany({
      where,
      orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * STOREFRONT_PAGE_SIZE,
      take: STOREFRONT_PAGE_SIZE,
      select: bookProductSelect,
    });

    const books = rows.flatMap((row: RawBookProduct) => {
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
    return { books, page, total };
  },
  ["storefront-book-catalog-paged-v2"],
  { revalidate: 60, tags: ["storefront-catalog", "storefront-books", "products"] },
);

export async function getStorefrontBooks(options: BookOptions = {}) {
  const disabledTypes = await getDisabledStorefrontProductTypes();
  return readBookCatalog(JSON.stringify(disabledTypes), JSON.stringify(options));
}

export type StorefrontBook = Awaited<ReturnType<typeof getStorefrontBooks>>["books"][number];

// Directory pages only need party metadata, never full product/variant graphs.
export async function getStorefrontBookDirectory() {
  const where = await bookWhere(await getDisabledStorefrontProductTypes());
  const rows = await prisma.product.findMany({ where, select: {
    writer: bookProductSelect.writer, publisher: bookProductSelect.publisher,
    bookMetadata: bookProductSelect.bookMetadata,
  } });
  return rows.map((row) => ({
    writer: activeParty(row.bookMetadata?.writer ?? null) ?? activeParty(row.writer),
    publisher: activeParty(row.bookMetadata?.publisher ?? null) ?? activeParty(row.publisher),
  }));
}
