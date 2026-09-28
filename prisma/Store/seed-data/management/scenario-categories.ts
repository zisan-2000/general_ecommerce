import { MANAGEMENT_CATEGORIES } from "./constants";
import type { ManagementSeedContext, TxClient } from "./types";

export async function seedManagementCategories(
  prisma: TxClient,
  ctx: ManagementSeedContext,
): Promise<ManagementSeedContext> {
  for (const item of MANAGEMENT_CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        image: item.image,
        deleted: false,
      },
      create: {
        name: item.name,
        slug: item.slug,
        image: item.image,
        deleted: false,
      },
      select: { id: true },
    });

    ctx.categories[item.key] = record.id;
  }

  return ctx;
}
