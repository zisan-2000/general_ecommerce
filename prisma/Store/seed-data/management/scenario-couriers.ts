import { MANAGEMENT_COURIERS } from "./constants";
import type { ManagementSeedContext, TxClient } from "./types";

export async function seedManagementCouriers(
  prisma: TxClient,
  ctx: ManagementSeedContext,
): Promise<ManagementSeedContext> {
  for (const item of MANAGEMENT_COURIERS) {
    const record = await prisma.courier.upsert({
      where: { name: item.name },
      update: {
        type: item.type as any,
        baseUrl: item.baseUrl,
        isActive: true,
      },
      create: {
        name: item.name,
        type: item.type as any,
        baseUrl: item.baseUrl,
        apiKey: `demo-${item.key}-api-key`,
        secretKey: `demo-${item.key}-secret`,
        clientId: `demo-${item.key}-client`,
        isActive: true,
      },
      select: { id: true },
    });

    ctx.couriers[item.key] = record.id;
  }

  return ctx;
}
