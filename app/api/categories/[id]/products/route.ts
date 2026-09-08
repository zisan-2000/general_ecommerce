import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDisabledStorefrontProductTypes } from "@/lib/store-feature-gates-server";
import {
  getCategoryDescendantIds,
  getEffectivelyActiveCategoryIds,
} from "@/lib/category-navigation";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const numericId = Number(id);
    const isNumeric = !Number.isNaN(numericId) && String(numericId) === id;

    const categories = await prisma.category.findMany({
      where: { deleted: false },
      select: { id: true, name: true, slug: true, parentId: true, isActive: true },
    });
    const category = categories.find((item) =>
      isNumeric ? item.id === numericId : item.slug === id,
    );
    const activeCategoryIds = getEffectivelyActiveCategoryIds(categories);

    if (!category || !activeCategoryIds.has(category.id)) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const categoryIds = getCategoryDescendantIds(
      categories,
      category.id,
      activeCategoryIds,
    );
    const disabledTypes = await getDisabledStorefrontProductTypes();

    const products = await prisma.product.findMany({
      where: {
        deleted: false,
        available: true,
        ...(disabledTypes.length ? { type: { notIn: disabledTypes } } : {}),
        categoryId: { in: categoryIds },
      },
      orderBy: { id: "desc" },
      include: {
        category: true,
        brand: true,
        variants: true,
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    });

    // Calculate rating averages for each product
    const productsWithRatings = await Promise.all(
      products.map(async (product) => {
        const ratingAggregation = await prisma.review.aggregate({
          _avg: { rating: true },
          where: { productId: product.id },
        });

        return {
          ...product,
          ratingAvg: ratingAggregation._avg.rating || 0,
          ratingCount: product._count.reviews,
        };
      })
    );

    return NextResponse.json({
      category,
      categoryIds,
      total: productsWithRatings.length,
      products: productsWithRatings,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load category products" },
      { status: 500 },
    );
  }
}
