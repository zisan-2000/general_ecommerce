import { MANAGEMENT_COUPONS } from "./constants";
import { daysFromNow, decimal } from "./helpers";
import type { ManagementSeedContext, TxClient } from "./types";

export async function seedManagementCoupons(
  prisma: TxClient,
  ctx: ManagementSeedContext,
): Promise<ManagementSeedContext> {
  for (const item of MANAGEMENT_COUPONS) {
    const record = await prisma.coupon.upsert({
      where: { code: item.code },
      update: {
        discountType: item.discountType,
        discountValue: decimal(item.discountValue),
        minOrderValue: decimal(item.minOrderValue),
        maxDiscount: decimal(item.maxDiscount),
        usageLimit: item.usageLimit,
        usedCount: item.usedCount,
        isValid: item.isValid,
        expiresAt: daysFromNow(item.expiresInDays),
      },
      create: {
        code: item.code,
        discountType: item.discountType,
        discountValue: decimal(item.discountValue),
        minOrderValue: decimal(item.minOrderValue),
        maxDiscount: decimal(item.maxDiscount),
        usageLimit: item.usageLimit,
        usedCount: item.usedCount,
        isValid: item.isValid,
        expiresAt: daysFromNow(item.expiresInDays),
      },
      select: { id: true },
    });

    ctx.coupons[item.key] = record.id;
  }

  return ctx;
}
