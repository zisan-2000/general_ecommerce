import { MANAGEMENT_BRANDS } from "./constants";
import type { ManagementSeedContext, TxClient } from "./types";

export async function seedManagementBrands(
  prisma: TxClient,
  ctx: ManagementSeedContext,
): Promise<ManagementSeedContext> {
  for (const item of MANAGEMENT_BRANDS) {
    const existing = await prisma.brand.findFirst({
      where: {
        OR: [{ slug: item.slug }, { name: item.name }],
      },
      select: { id: true },
    });

    const record = existing
      ? await prisma.brand.update({
          where: { id: existing.id },
          data: {
            name: item.name,
            slug: item.slug,
            deleted: false,
          },
          select: { id: true },
        })
      : await prisma.brand.create({
          data: {
            name: item.name,
            slug: item.slug,
            deleted: false,
          },
          select: { id: true },
        });

    ctx.brands[item.key] = record.id;
  }

  return ctx;
}
