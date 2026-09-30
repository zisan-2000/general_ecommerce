import "server-only";

import { compressedCache } from "@/lib/compressed-cache";
import { storefrontPage, STOREFRONT_PAGE_SIZE } from "@/lib/storefront-pagination";
import { getEffectiveStorefrontCategoryIds } from "@/lib/category-navigation-server";
import { prisma } from "@/lib/prisma";
import {
  serializeStorefrontHomeProduct,
  storefrontHomeProductSelect,
} from "@/lib/storefront-home";
import { getDisabledStorefrontProductTypes } from "@/lib/store-feature-gates-server";
import type { FeatureControlledProductType } from "@/lib/store-features";
import type { Prisma } from "@/generated/prisma";
import { getBookProductVisibilityWhere } from "@/lib/book-product-visibility-server";

const readActiveFlashSales = compressedCache(
  async (serializedDisabledTypes: string, serializedBookVisibility: string, requestedPage: number) => {
    const now = new Date();
    const disabledTypes = JSON.parse(
      serializedDisabledTypes,
    ) as FeatureControlledProductType[];
    const bookVisibility = JSON.parse(serializedBookVisibility) as Prisma.ProductWhereInput;
    const activeCategoryIds = await getEffectiveStorefrontCategoryIds();
    const where: Prisma.ProductWhereInput = {
        categoryId: { in: activeCategoryIds },
        deleted: false,
        available: true,
        ...(disabledTypes.length ? { type: { notIn: disabledTypes } } : {}),
        ...bookVisibility,
        flashSaleEnabled: true,
        flashSalePrice: { not: null },
        flashSaleStartsAt: { lte: now },
        flashSaleEndsAt: { gt: now },
    };
    const total = await prisma.product.count({ where });
    const page = Math.min(storefrontPage(requestedPage), Math.max(1, Math.ceil(total / STOREFRONT_PAGE_SIZE)));
    const products = await prisma.product.findMany({
      where,
      skip: (page - 1) * STOREFRONT_PAGE_SIZE,
      orderBy: [{ flashSaleSortOrder: "asc" }, { flashSaleEndsAt: "asc" }, { id: "asc" }],
      take: STOREFRONT_PAGE_SIZE,
      select: storefrontHomeProductSelect,
    });
    return { page, total, products: products
      .map((product) => serializeStorefrontHomeProduct(product, now))
      .filter((product) => product.flashSale.active) };
  },
  ["storefront-flash-sales-paged-v2"],
  { revalidate: 30, tags: ["flash-sales", "products"] },
);

export async function getActiveFlashSaleProducts(page = 1) {
  const [disabledTypes, bookVisibility] = await Promise.all([
    getDisabledStorefrontProductTypes(),
    getBookProductVisibilityWhere(),
  ]);
  return readActiveFlashSales(JSON.stringify(disabledTypes), JSON.stringify(bookVisibility), storefrontPage(page));
}
