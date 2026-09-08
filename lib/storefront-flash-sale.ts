import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  serializeStorefrontHomeProduct,
  storefrontHomeProductSelect,
} from "@/lib/storefront-home";
import { getDisabledStorefrontProductTypes } from "@/lib/store-feature-gates-server";
import type { FeatureControlledProductType } from "@/lib/store-features";

const readActiveFlashSales = unstable_cache(
  async (serializedDisabledTypes: string) => {
    const now = new Date();
    const disabledTypes = JSON.parse(
      serializedDisabledTypes,
    ) as FeatureControlledProductType[];
    const products = await prisma.product.findMany({
      where: {
        deleted: false,
        available: true,
        ...(disabledTypes.length ? { type: { notIn: disabledTypes } } : {}),
        flashSaleEnabled: true,
        flashSalePrice: { not: null },
        flashSaleStartsAt: { lte: now },
        flashSaleEndsAt: { gt: now },
      },
      orderBy: [{ flashSaleSortOrder: "asc" }, { flashSaleEndsAt: "asc" }],
      take: 100,
      select: storefrontHomeProductSelect,
    });
    return products
      .map((product) => serializeStorefrontHomeProduct(product, now))
      .filter((product) => product.flashSale.active);
  },
  ["storefront-flash-sales-v1"],
  { revalidate: 30, tags: ["flash-sales", "products"] },
);

export async function getActiveFlashSaleProducts() {
  const disabledTypes = await getDisabledStorefrontProductTypes();
  return readActiveFlashSales(JSON.stringify(disabledTypes));
}
