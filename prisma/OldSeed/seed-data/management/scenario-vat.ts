import { MANAGEMENT_VAT_CLASSES } from "./constants";
import { daysAgo } from "./helpers";
import type { ManagementSeedContext, TxClient } from "./types";

export async function seedManagementVat(
  prisma: TxClient,
  ctx: ManagementSeedContext,
): Promise<ManagementSeedContext> {
  for (const item of MANAGEMENT_VAT_CLASSES) {
    const vatClass = await prisma.vatClass.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        description: item.description,
      },
      create: {
        code: item.code,
        name: item.name,
        description: item.description,
      },
      select: { id: true },
    });

    ctx.vatClasses[item.key] = vatClass.id;

    const existingRate = await prisma.vatRate.findFirst({
      where: {
        VatClassId: vatClass.id,
        countryCode: "BD",
        regionCode: null,
      },
      select: { id: true },
    });

    const data = {
      VatClassId: vatClass.id,
      countryCode: "BD",
      regionCode: null,
      rate: item.rate.toFixed(4),
      inclusive: item.inclusive,
      startDate: daysAgo(120),
      endDate: null,
    };

    if (existingRate) {
      await prisma.vatRate.update({
        where: { id: existingRate.id },
        data,
      });
    } else {
      await prisma.vatRate.create({ data });
    }
  }

  return ctx;
}
