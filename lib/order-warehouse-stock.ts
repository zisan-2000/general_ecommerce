import type { Prisma } from "@/generated/prisma";

type OrderWarehouseStockClient = Pick<
  Prisma.TransactionClient,
  | "orderItem"
  | "warehouse"
  | "stockLevel"
  | "inventoryReservation"
  | "inventoryLog"
> & {
  orderBundleComponent?: Prisma.TransactionClient["orderBundleComponent"];
  order?: Prisma.TransactionClient["order"];
  bundleStockLevel?: Prisma.TransactionClient["bundleStockLevel"];
  bundleStockReservation?: Prisma.TransactionClient["bundleStockReservation"];
};

type WarehouseDemand = {
  requiredUnits: number;
  hasUntrackedUnits: boolean;
  byVariant: Map<number, number>;
  byBundle?: Map<number, number>;
};

type WarehouseStockInput = {
  warehouseId: number;
  variantId: number;
  quantity: number;
  reserved: number;
};

type OrderReservationInput = {
  warehouseId: number;
  variantId: number;
  quantity: number;
};

type OrderMovementInput = {
  warehouseId: number | null;
  variantId: number | null;
  change: number;
};

export type WarehouseStockAvailability = {
  warehouseId: number;
  requiredUnits: number;
  availableUnits: number;
  canFulfill: boolean;
};

export type OrderWarehouseStockAvailability = {
  requiresStock: boolean;
  requiredUnits: number;
  warehouses: WarehouseStockAvailability[];
};

function allocationKey(warehouseId: number, variantId: number) {
  return `${warehouseId}:${variantId}`;
}

export function buildOrderWarehouseStockAvailability(params: {
  warehouseIds: number[];
  demand: WarehouseDemand;
  stockLevels: WarehouseStockInput[];
  reservations: OrderReservationInput[];
  movements: OrderMovementInput[];
  fulfillmentWarehouseId?: number | null;
  bundleStockLevels?: Array<{ warehouseId: number; productId: number; quantity: number; reserved: number }>;
  bundleReservations?: Array<{ warehouseId: number; productId: number; quantity: number }>;
  bundleMovements?: Array<{ warehouseId: number; productId: number; change: number }>;
}): OrderWarehouseStockAvailability {
  const { warehouseIds, demand, stockLevels, reservations, movements } = params;

  if (demand.requiredUnits === 0) {
    return {
      requiresStock: false,
      requiredUnits: 0,
      warehouses: warehouseIds.map((warehouseId) => ({
        warehouseId,
        requiredUnits: 0,
        availableUnits: 0,
        canFulfill: !params.fulfillmentWarehouseId || warehouseId === params.fulfillmentWarehouseId,
      })),
    };
  }

  const levelsByAllocation = new Map<string, WarehouseStockInput>();
  for (const level of stockLevels) {
    levelsByAllocation.set(
      allocationKey(level.warehouseId, level.variantId),
      level,
    );
  }

  const ownReservations = new Map<string, number>();
  for (const reservation of reservations) {
    const key = allocationKey(reservation.warehouseId, reservation.variantId);
    ownReservations.set(key, (ownReservations.get(key) ?? 0) + reservation.quantity);
  }

  const netMovements = new Map<string, number>();
  for (const movement of movements) {
    if (movement.warehouseId === null || movement.variantId === null) continue;
    const key = allocationKey(movement.warehouseId, movement.variantId);
    netMovements.set(key, (netMovements.get(key) ?? 0) + movement.change);
  }

  const bundleLevels = new Map((params.bundleStockLevels ?? []).map((level) => [allocationKey(level.warehouseId, level.productId), level]));
  const bundleReserved = new Map<string, number>();
  for (const reservation of params.bundleReservations ?? []) {
    const key = allocationKey(reservation.warehouseId, reservation.productId);
    bundleReserved.set(key, (bundleReserved.get(key) ?? 0) + reservation.quantity);
  }
  const bundleNetMovements = new Map<string, number>();
  for (const movement of params.bundleMovements ?? []) {
    const key = allocationKey(movement.warehouseId, movement.productId);
    bundleNetMovements.set(key, (bundleNetMovements.get(key) ?? 0) + movement.change);
  }

  return {
    requiresStock: true,
    requiredUnits: demand.requiredUnits,
    warehouses: warehouseIds.map((warehouseId) => {
      let availableUnits = 0;
      let canFulfill = !demand.hasUntrackedUnits;
      if (params.fulfillmentWarehouseId && warehouseId !== params.fulfillmentWarehouseId) canFulfill = false;

      for (const [variantId, requiredUnits] of demand.byVariant) {
        const key = allocationKey(warehouseId, variantId);
        const level = levelsByAllocation.get(key);
        const quantity = Math.max(0, Number(level?.quantity ?? 0));
        const reserved = Math.max(0, Number(level?.reserved ?? 0));
        const ownReserved = Math.min(
          reserved,
          Math.max(0, Number(ownReservations.get(key) ?? 0)),
        );

        // The order may already own inventory through either a live reservation
        // or a committed checkout deduction. Include only that order's allocation
        // so assigning a shipment does not demand the same stock a second time.
        const availableIncludingOwnReservation = Math.max(
          0,
          quantity - Math.max(0, reserved - ownReserved),
        );
        const committedAllocation = Math.max(
          0,
          -(netMovements.get(key) ?? 0),
        );
        const availableForOrder =
          availableIncludingOwnReservation + committedAllocation;

        availableUnits += availableForOrder;
        if (availableForOrder < requiredUnits) canFulfill = false;
      }

      for (const [productId, requiredUnits] of demand.byBundle ?? []) {
        const key = allocationKey(warehouseId, productId);
        const level = bundleLevels.get(key);
        const quantity = Math.max(0, Number(level?.quantity ?? 0));
        const reserved = Math.max(0, Number(level?.reserved ?? 0));
        const ownReserved = Math.min(reserved, Math.max(0, bundleReserved.get(key) ?? 0));
        const committed = Math.max(0, -(bundleNetMovements.get(key) ?? 0));
        const available = Math.max(0, quantity - Math.max(0, reserved - ownReserved)) + committed;
        availableUnits += available;
        if (available < requiredUnits) canFulfill = false;
      }

      return {
        warehouseId,
        requiredUnits: demand.requiredUnits,
        availableUnits,
        canFulfill,
      };
    }),
  };
}

export async function getOrderWarehouseStockAvailability(
  client: OrderWarehouseStockClient,
  orderId: number,
): Promise<OrderWarehouseStockAvailability> {
  const bundleComponentsPromise = client.orderBundleComponent
    ? client.orderBundleComponent.findMany({
        where: { orderItem: { orderId } },
        select: {
          variantId: true,
          quantityPerBundle: true,
          orderItem: { select: { quantity: true, productId: true } },
          product: { select: { type: true } },
        },
      })
    : Promise.resolve([]);
  const [items, bundleComponents, warehouses, order, allMovements, allBundleReservations] = await Promise.all([
    client.orderItem.findMany({
      where: {
        orderId,
        product: { type: { in: ["PHYSICAL", "BUNDLE"] } },
      },
      select: {
        variantId: true, quantity: true, productId: true, bundleConfiguration: true,
        product: { select: { type: true, bundleFulfillmentMode: true } },
      },
    }),
    bundleComponentsPromise,
    client.warehouse.findMany({
      select: { id: true },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    }),
    client.order?.findUnique({ where: { id: orderId }, select: { fulfillmentWarehouseId: true } }) ?? Promise.resolve(null),
    client.inventoryLog.findMany({
      where: { orderId, warehouseId: { not: null } },
      select: { warehouseId: true, productId: true, variantId: true, change: true, reason: true },
    }),
    client.bundleStockReservation?.findMany({
      where: { orderId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { quantity: true, bundleStockLevel: { select: { productId: true, warehouseId: true } } },
    }) ?? Promise.resolve([]),
  ]);

  const demand: WarehouseDemand = {
    requiredUnits: 0,
    hasUntrackedUnits: false,
    byVariant: new Map(),
    byBundle: new Map(),
  };

  const historicalPreassembledIds = new Set([
    ...allMovements.filter((movement) => movement.reason?.startsWith("PREASSEMBLED_BUNDLE_STOCK:")).map((movement) => movement.productId),
    ...allBundleReservations.map((reservation) => reservation.bundleStockLevel.productId),
  ]);
  const preassembledIds = new Set<number>();

  for (const item of items) {
    if (item.product?.type === "BUNDLE") {
      const snapshot = item.bundleConfiguration;
      const savedMode = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
        ? snapshot.bundleFulfillmentMode : undefined;
      const preassembled = savedMode === "PREASSEMBLED" ||
        (savedMode !== "VIRTUAL" && (historicalPreassembledIds.has(item.productId) || item.product.bundleFulfillmentMode === "PREASSEMBLED"));
      if (preassembled) {
        const quantity = Math.max(0, Number(item.quantity));
        preassembledIds.add(item.productId);
        demand.requiredUnits += quantity;
        demand.byBundle!.set(item.productId, (demand.byBundle!.get(item.productId) ?? 0) + quantity);
      }
      continue;
    }
    const quantity = Math.max(0, Number(item.quantity));
    demand.requiredUnits += quantity;
    if (item.variantId === null) {
      demand.hasUntrackedUnits ||= quantity > 0;
      continue;
    }
    demand.byVariant.set(
      item.variantId,
      (demand.byVariant.get(item.variantId) ?? 0) + quantity,
    );
  }
  for (const component of bundleComponents) {
    if (preassembledIds.has(component.orderItem.productId)) continue;
    if (component.product.type !== "PHYSICAL") continue;
    const quantity = Math.max(
      0,
      Number(component.quantityPerBundle) * Number(component.orderItem.quantity),
    );
    demand.requiredUnits += quantity;
    if (component.variantId === null) {
      demand.hasUntrackedUnits ||= quantity > 0;
      continue;
    }
    demand.byVariant.set(
      component.variantId,
      (demand.byVariant.get(component.variantId) ?? 0) + quantity,
    );
  }

  const warehouseIds = warehouses.map((warehouse) => warehouse.id);
  const variantIds = [...demand.byVariant.keys()];
  const now = new Date();
  const [levels, reservations, bundleLevels] = await Promise.all([
    variantIds.length ? client.stockLevel.findMany({
      where: { productVariantId: { in: variantIds } },
      select: {
        warehouseId: true,
        productVariantId: true,
        quantity: true,
        reserved: true,
      },
    }) : Promise.resolve([]),
    variantIds.length ? client.inventoryReservation.findMany({
      where: {
        orderId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        stockLevel: { productVariantId: { in: variantIds } },
      },
      select: {
        quantity: true,
        stockLevel: {
          select: { warehouseId: true, productVariantId: true },
        },
      },
    }) : Promise.resolve([]),
    demand.byBundle!.size && client.bundleStockLevel ? client.bundleStockLevel.findMany({
      where: { productId: { in: [...demand.byBundle!.keys()] } },
      select: { productId: true, warehouseId: true, quantity: true, reserved: true },
    }) : Promise.resolve([]),
  ]);

  return buildOrderWarehouseStockAvailability({
    warehouseIds,
    demand,
    fulfillmentWarehouseId: order?.fulfillmentWarehouseId,
    bundleStockLevels: bundleLevels,
    bundleReservations: allBundleReservations.map((reservation) => ({
      warehouseId: reservation.bundleStockLevel.warehouseId,
      productId: reservation.bundleStockLevel.productId,
      quantity: reservation.quantity,
    })),
    bundleMovements: allMovements.filter((movement) =>
      movement.warehouseId !== null && movement.reason?.startsWith("PREASSEMBLED_BUNDLE_STOCK:"),
    ).map((movement) => ({ warehouseId: movement.warehouseId!, productId: movement.productId, change: movement.change })),
    stockLevels: levels.map((level) => ({
      warehouseId: level.warehouseId,
      variantId: level.productVariantId,
      quantity: level.quantity,
      reserved: level.reserved,
    })),
    reservations: reservations.map((reservation) => ({
      warehouseId: reservation.stockLevel.warehouseId,
      variantId: reservation.stockLevel.productVariantId,
      quantity: reservation.quantity,
    })),
    movements: allMovements,
  });
}

export async function canWarehouseFulfillOrder(
  client: OrderWarehouseStockClient,
  orderId: number,
  warehouseId: number,
) {
  const availability = await getOrderWarehouseStockAvailability(client, orderId);
  if (!availability.requiresStock) return true;

  return (
    availability.warehouses.find(
      (warehouse) => warehouse.warehouseId === warehouseId,
    )?.canFulfill ?? false
  );
}
