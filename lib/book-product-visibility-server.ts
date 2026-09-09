import type { Prisma } from "@/generated/prisma";

export const BOOK_PRODUCT_IDENTITY_WHERE = {
  OR: [
    { bookMetadata: { isNot: null } },
    { writerId: { not: null } },
    { publisherId: { not: null } },
  ],
} as const satisfies Prisma.ProductWhereInput;

export async function getBookProductVisibilityWhere(): Promise<Prisma.ProductWhereInput> {
  const { isFeatureEnabled } = await import("@/lib/store-features-server");
  return (await isFeatureEnabled("BOOKS"))
    ? {}
    : { NOT: BOOK_PRODUCT_IDENTITY_WHERE };
}
