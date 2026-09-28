import { WAREHOUSE_PRODUCTS } from "./constants";
import type { TxClient, WarehouseSeedContext } from "./types";

export async function seedWarehouseBinLayout(
  prisma: TxClient,
  ctx: WarehouseSeedContext,
): Promise<WarehouseSeedContext> {
  const warehouseKeys = Object.keys(ctx.warehouses);

  for (let index = 0; index < warehouseKeys.length; index += 1) {
    const warehouseKey = warehouseKeys[index];
    const warehouseId = ctx.warehouses[warehouseKey];
    const zoneCode = `Z-${String(index + 1).padStart(2, "0")}`;
    const aisleCode = `A-${String(index + 1).padStart(2, "0")}`;
    const binCode = `B-${String(index + 1).padStart(2, "0")}`;

    const zone = await prisma.warehouseZone.upsert({
      where: {
        warehouseId_code: {
          warehouseId,
          code: zoneCode,
        },
      },
      update: {
        name: `${warehouseKey.toUpperCase()} Main Zone`,
        description: `Seeded active zone for ${warehouseKey}`,
        isActive: true,
      },
      create: {
        warehouseId,
        code: zoneCode,
        name: `${warehouseKey.toUpperCase()} Main Zone`,
        description: `Seeded active zone for ${warehouseKey}`,
        isActive: true,
      },
      select: { id: true },
    });
    ctx.zones[warehouseKey] = zone.id;

    const aisle = await prisma.warehouseAisle.upsert({
      where: {
        zoneId_code: {
          zoneId: zone.id,
          code: aisleCode,
        },
      },
      update: {
        warehouseId,
        name: `${warehouseKey.toUpperCase()} Aisle ${index + 1}`,
        description: "Seeded aisle for warehouse layout",
        isActive: true,
      },
      create: {
        warehouseId,
        zoneId: zone.id,
        code: aisleCode,
        name: `${warehouseKey.toUpperCase()} Aisle ${index + 1}`,
        description: "Seeded aisle for warehouse layout",
        isActive: true,
      },
      select: { id: true },
    });
    ctx.aisles[warehouseKey] = aisle.id;

    const bin = await prisma.warehouseBin.upsert({
      where: {
        aisleId_code: {
          aisleId: aisle.id,
          code: binCode,
        },
      },
      update: {
        warehouseId,
        zoneId: zone.id,
        name: `${warehouseKey.toUpperCase()} Bin ${index + 1}`,
        description: "Seeded picking bin",
        isActive: true,
      },
      create: {
        warehouseId,
        zoneId: zone.id,
        aisleId: aisle.id,
        code: binCode,
        name: `${warehouseKey.toUpperCase()} Bin ${index + 1}`,
        description: "Seeded picking bin",
        isActive: true,
      },
      select: { id: true },
    });
    ctx.bins[warehouseKey] = bin.id;

    const product = WAREHOUSE_PRODUCTS[index];
    const variantId = ctx.variants[product.key];
    if (variantId) {
      await prisma.stockBinLevel.upsert({
        where: {
          binId_productVariantId: {
            binId: bin.id,
            productVariantId: variantId,
          },
        },
        update: {
          warehouseId,
          quantity: product.stock,
          reserved: Math.floor(product.stock * 0.08),
        },
        create: {
          warehouseId,
          binId: bin.id,
          productVariantId: variantId,
          quantity: product.stock,
          reserved: Math.floor(product.stock * 0.08),
        },
      });
    }
  }

  return ctx;
}
