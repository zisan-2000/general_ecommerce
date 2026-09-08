import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectivelyActiveCategoryIds } from "@/lib/category-navigation";

const readEffectiveStorefrontCategoryIds = unstable_cache(
  async () => {
    const categories = await prisma.category.findMany({
      where: { deleted: false },
      select: { id: true, parentId: true, isActive: true },
    });
    return Array.from(getEffectivelyActiveCategoryIds(categories));
  },
  ["effective-storefront-category-ids-v1"],
  { revalidate: 300, tags: ["categories", "storefront-catalog"] },
);

export async function getEffectiveStorefrontCategoryIds() {
  return readEffectiveStorefrontCategoryIds();
}

export async function getEffectiveStorefrontCategoryIdSet() {
  return new Set(await readEffectiveStorefrontCategoryIds());
}

export async function isCategoryEffectivelyActive(categoryId: number) {
  return (await getEffectiveStorefrontCategoryIdSet()).has(categoryId);
}
