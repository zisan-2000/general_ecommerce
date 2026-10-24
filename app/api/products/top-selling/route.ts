import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicJson } from "@/lib/public-cache";
import {
  serializeStorefrontHomeProduct,
  storefrontHomeProductSelect,
} from "@/lib/storefront-home";
import { getDisabledStorefrontProductTypes } from "@/lib/store-feature-gates-server";
import { getEffectiveStorefrontCategoryIds } from "@/lib/category-navigation-server";
import { getBookProductVisibilityWhere } from "@/lib/book-product-visibility-server";

export async function GET() {
  try {
    const [disabledTypes, activeCategoryIds, bookVisibility] = await Promise.all([
      getDisabledStorefrontProductTypes(),
      getEffectiveStorefrontCategoryIds(),
      getBookProductVisibilityWhere(),
    ]);
    const top = await prisma.product.findMany({
      where: {
        deleted: false,
        available: true,
        categoryId: { in: activeCategoryIds },
        OR: [{ bestSelling: true }, { soldCount: { gt: 0 } }],
        ...(disabledTypes.length ? { type: { notIn: disabledTypes } } : {}),
        ...bookVisibility,
      },
      orderBy: {
        bestSelling: "desc",
        soldCount: "desc",
      },
      take: 10,
      select: {
        ...storefrontHomeProductSelect,
        brand: { select: { name: true } },
      },
    });

    return publicJson(
      top.map((product) => {
        const serialized = serializeStorefrontHomeProduct(product);
        return {
          ...serialized,
          // Preserve the legacy endpoint field while sharing the same payload
          // semantics used by server-preloaded homepage products.
          price: serialized.basePrice,
        };
      }),
      { maxAge: 0, staleWhileRevalidate: 0 },
    );
  } catch (error) {
    console.error('Error fetching top selling products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top selling products' },
      { status: 500 }
    );
  }
}
