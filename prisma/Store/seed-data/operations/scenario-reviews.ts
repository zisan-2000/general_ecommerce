import { daysAgo } from "./helpers";
import type { OperationsSeedContext, TxClient } from "./types";

const REVIEWS = [
  { userKey: "customerA", productKey: "runningShoe", rating: 5, comment: "Comfortable and good quality.", feature: true, daysAgo: 8 },
  { userKey: "customerB", productKey: "leatherBag", rating: 4, comment: "Nice finishing and useful for daily use.", feature: true, daysAgo: 7 },
  { userKey: "customerC", productKey: "denimJacket", rating: 5, comment: "Size and fabric both are perfect.", feature: false, daysAgo: 6 },
  { userKey: "customerA", productKey: "smartWatch", rating: 4, comment: "Battery backup is decent.", feature: false, daysAgo: 5 },
  { userKey: "customerB", productKey: "deskLamp", rating: 5, comment: "Great value for home office.", feature: true, daysAgo: 4 },
] as const;

export async function seedOperationsReviews(
  prisma: TxClient,
  ctx: OperationsSeedContext,
): Promise<void> {
  for (const review of REVIEWS) {
    const where = {
      userId: ctx.users[review.userKey],
      productId: ctx.products[review.productKey],
    };

    const existing = await prisma.review.findFirst({
      where,
      select: { id: true },
    });

    if (existing) {
      await prisma.review.update({
        where: { id: existing.id },
        data: {
          rating: review.rating,
          comment: review.comment,
          feature: review.feature,
          createdAt: daysAgo(review.daysAgo),
        },
      });
    } else {
      await prisma.review.create({
        data: {
          ...where,
          rating: review.rating,
          comment: review.comment,
          feature: review.feature,
          createdAt: daysAgo(review.daysAgo),
        },
      });
    }

    const aggregate = await prisma.review.aggregate({
      where: { productId: ctx.products[review.productKey] },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.product.update({
      where: { id: ctx.products[review.productKey] },
      data: {
        ratingAvg: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count.rating,
      },
    });
  }
}
