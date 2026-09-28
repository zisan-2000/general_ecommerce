import { WAREHOUSE_COURIERS } from "./constants";
import type { TxClient, WarehouseSeedContext } from "./types";

export async function seedWarehouseShippingRates(
  prisma: TxClient,
  ctx: WarehouseSeedContext,
): Promise<WarehouseSeedContext> {
  for (const courier of WAREHOUSE_COURIERS) {
    const record = await prisma.courier.upsert({
      where: { name: courier.name },
      update: {
        type: courier.type as any,
        baseUrl: courier.baseUrl,
        isActive: true,
      },
      create: {
        name: courier.name,
        type: courier.type as any,
        baseUrl: courier.baseUrl,
        isActive: true,
      },
      select: { id: true },
    });
    ctx.couriers[courier.key] = record.id;
  }

  const rateRows = [
    { key: "dhaka", area: "Tejgaon", district: "Dhaka", courierKey: "steadfast", cost: 80, freeMin: 2500, days: 1, type: "SAME_CITY" },
    { key: "ctg", area: "Agrabad", district: "Chattogram", courierKey: "redx", cost: 120, freeMin: 3500, days: 2, type: "REGIONAL" },
    { key: "sylhet", area: "Zindabazar", district: "Sylhet", courierKey: "pathao", cost: 130, freeMin: 3800, days: 3, type: "REGIONAL" },
    { key: "khulna", area: "Khalishpur", district: "Khulna", courierKey: "custom", cost: 140, freeMin: 4200, days: 3, type: "REGIONAL" },
    { key: "rajshahi", area: "Shaheb Bazar", district: "Rajshahi", courierKey: "express", cost: 150, freeMin: 4500, days: 4, type: "OUTSIDE_CITY" },
  ];

  for (const [index, rate] of rateRows.entries()) {
    const existing = await prisma.shippingRate.findFirst({
      where: {
        warehouseId: ctx.warehouses[rate.key],
        courierId: ctx.couriers[rate.courierKey],
        area: rate.area,
        district: rate.district,
      },
      select: { id: true },
    });

    const data = {
      country: "BD",
      area: rate.area,
      district: rate.district,
      baseCost: rate.cost.toFixed(2),
      freeMinOrder: rate.freeMin.toFixed(2),
      weightSlabs: [
        { upToKg: 1, cost: rate.cost },
        { upToKg: 3, cost: rate.cost + 30 },
        { upToKg: 5, cost: rate.cost + 70 },
      ],
      deliveryType: rate.type,
      estimatedDays: rate.days,
      priority: index + 1,
      isActive: true,
      courierId: ctx.couriers[rate.courierKey],
      warehouseId: ctx.warehouses[rate.key],
    };

    const row = existing
      ? await prisma.shippingRate.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.shippingRate.create({ data, select: { id: true } });

    ctx.shippingRates[rate.key] = row.id;
  }

  return ctx;
}
