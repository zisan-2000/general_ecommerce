import { Prisma } from "@/generated/prisma";
import { captureVariantInventoryDailySnapshots } from "@/lib/report-history";

type TransactionClient = Prisma.TransactionClient;
type InventoryClient = Pick<
  Prisma.TransactionClient,
  | "warehouse"
  | "stockLevel"
  | "productVariant"
  | "inventoryLog"
  | "inventoryDailySnapshot"
  | "inventoryWarehouseDailySnapshot"
>;

export function computeAvailableStock(
  levels: Array<{ quantity: number; reserved: number }>,
) {
  return Math.max(
    0,
    levels.reduce(
      (sum, level) => sum + Math.max(0, Number(level.quantity) - Number(level.reserved)),
      0,
    ),
  );
}

export type AvailableStockEditConflictCode =
  | "EXPECTED_AVAILABLE_STOCK_REQUIRED"
  | "AVAILABLE_STOCK_CHANGED"
  | "MULTI_WAREHOUSE_STOCK_EDIT_REQUIRED"
  | "INVALID_INVENTORY_STATE";

export class AvailableStockEditConflictError extends Error {
  constructor(
    public readonly code: AvailableStockEditConflictCode,
    message: string,
  ) {
    super(message);
    this.name = "AvailableStockEditConflictError";
  }
}

export type InventoryDeletionConflictCode =
  | "STOCK_LEVEL_HAS_RESERVATIONS"
  | "STOCK_LEVEL_HAS_INVENTORY"
  | "STOCK_LEVEL_CHANGED"
  | "VARIANT_HAS_INVENTORY"
  | "VARIANT_HAS_RESERVATIONS"
  | "VARIANT_HAS_ORDER_HISTORY"
  | "VARIANT_HAS_INVENTORY_HISTORY"
  | "VARIANT_INVENTORY_CHANGED"
  | "VARIANT_IS_REFERENCED";

export class InventoryDeletionConflictError extends Error {
  constructor(
    public readonly code: InventoryDeletionConflictCode,
    message: string,
  ) {
    super(message);
    this.name = "InventoryDeletionConflictError";
  }
}

export async function getPrimaryWarehouseId(tx: InventoryClient) {
  const warehouse = await tx.warehouse.findFirst({
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    select: { id: true },
  });

  return warehouse?.id ?? null;
}

export async function refreshVariantStock(
  tx: InventoryClient,
  productVariantId: number,
) {
  const levels = await tx.stockLevel.findMany({
    where: { productVariantId },
    select: { quantity: true, reserved: true },
  });

  const stock = computeAvailableStock(levels);
  await tx.productVariant.update({
    where: { id: productVariantId },
    data: { stock },
  });

  return stock;
}

/**
 * A simple product has one optionless default variant, which is the inventory
 * row used by storefront and checkout. Older imports could leave that row
 * inactive; once it has stock, keeping it inactive makes real inventory
 * impossible to sell. This deliberately does not reactivate disabled options
 * on products that have multiple variants.
 */
export async function activateStockedSimpleProductVariant(
  tx: TransactionClient,
  productVariantId: number,
  availableStock: number,
) {
  if (availableStock <= 0) return;

  await tx.$executeRaw`
    UPDATE "ProductVariant" AS variant
    SET "active" = true, "updatedAt" = CURRENT_TIMESTAMP
    WHERE variant."id" = ${productVariantId}
      AND variant."active" = false
      AND variant."isDefault" = true
      AND variant."options" = '{}'::jsonb
      AND NOT EXISTS (
        SELECT 1
        FROM "ProductVariant" AS sibling
        WHERE sibling."productId" = variant."productId"
          AND sibling."id" <> variant."id"
      )
  `;
}

export async function syncVariantWarehouseStock(params: {
  tx: TransactionClient;
  productId: number;
  productVariantId: number;
  quantity: number;
  reason: string;
  warehouseId?: number | null;
}) {
  const { tx, productId, productVariantId, quantity, reason } = params;

  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error("Stock quantity must be a whole number (0 or more)");
  }

  const warehouseId =
    params.warehouseId ?? (await getPrimaryWarehouseId(tx));

  if (!warehouseId) {
    if (quantity === 0) {
      await tx.productVariant.update({
        where: { id: productVariantId },
        data: { stock: 0 },
      });
      return { warehouseId: null, stock: 0 };
    }

    throw new Error(
      "A warehouse is required before adding stock to a physical product",
    );
  }

  const existing = await tx.stockLevel.findUnique({
    where: {
      warehouseId_productVariantId: {
        warehouseId,
        productVariantId,
      },
    },
    select: { quantity: true },
  });

  await tx.stockLevel.upsert({
    where: {
      warehouseId_productVariantId: {
        warehouseId,
        productVariantId,
      },
    },
    create: {
      warehouseId,
      productVariantId,
      quantity,
      reserved: 0,
    },
    update: {
      quantity,
    },
  });

  const stock = await refreshVariantStock(tx, productVariantId);
  const change = quantity - Number(existing?.quantity ?? 0);

  if (change !== 0) {
    await tx.inventoryLog.create({
      data: {
        productId,
        variantId: productVariantId,
        warehouseId,
        change,
        reason,
      },
    });
  }

  await captureVariantInventoryDailySnapshots(tx, productVariantId);

  return { warehouseId, stock };
}

/**
 * Changes the sellable (available) quantity of an existing variant without
 * treating that derived value as physical on-hand inventory. An edit is only
 * unambiguous when the variant has zero or one warehouse stock level.
 */
export async function setVariantAvailableStock(params: {
  tx: TransactionClient;
  productId: number;
  productVariantId: number;
  availableQuantity: number;
  expectedAvailableQuantity?: number | null;
  reason: string;
}) {
  const {
    tx,
    productId,
    productVariantId,
    availableQuantity,
    expectedAvailableQuantity,
    reason,
  } = params;

  if (!Number.isSafeInteger(availableQuantity) || availableQuantity < 0) {
    throw new Error("Available stock must be a whole number (0 or more)");
  }
  if (
    expectedAvailableQuantity !== undefined &&
    expectedAvailableQuantity !== null &&
    (!Number.isSafeInteger(expectedAvailableQuantity) ||
      expectedAvailableQuantity < 0)
  ) {
    throw new Error("Expected available stock must be a whole number (0 or more)");
  }

  // Acquire a row lock before inspecting warehouse levels. This serializes a
  // first legacy-stock initialization with reservations and competing edits.
  await tx.$executeRaw`
    UPDATE "ProductVariant"
    SET "stock" = "stock"
    WHERE "id" = ${productVariantId}
  `;
  const legacyVariant = await tx.productVariant.findUnique({
    where: { id: productVariantId },
    select: { stock: true },
  });
  if (!legacyVariant) {
    throw new Error("Product variant not found");
  }

  const levels = await tx.stockLevel.findMany({
    where: { productVariantId },
    select: { id: true, warehouseId: true, quantity: true, reserved: true },
    orderBy: { id: "asc" },
  });

  if (
    levels.some(
      (level) =>
        !Number.isSafeInteger(level.quantity) ||
        !Number.isSafeInteger(level.reserved) ||
        level.quantity < 0 ||
        level.reserved < 0 ||
        level.reserved > level.quantity,
    )
  ) {
    throw new AvailableStockEditConflictError(
      "INVALID_INVENTORY_STATE",
      "Inventory has an invalid quantity/reservation combination; review it in the Inventory page",
    );
  }

  const legacyAvailable = Math.max(0, Number(legacyVariant.stock));
  const currentAvailable =
    levels.length > 0 ? computeAvailableStock(levels) : legacyAvailable;
  if (
    expectedAvailableQuantity !== undefined &&
    expectedAvailableQuantity !== null &&
    expectedAvailableQuantity !== currentAvailable
  ) {
    throw new AvailableStockEditConflictError(
      "AVAILABLE_STOCK_CHANGED",
      "Available stock changed after this product was loaded; reload and try again",
    );
  }

  if (availableQuantity === currentAvailable) {
    return {
      changed: false,
      warehouseId: levels[0]?.warehouseId ?? null,
      stock: currentAvailable,
    };
  }

  if (expectedAvailableQuantity === undefined || expectedAvailableQuantity === null) {
    throw new AvailableStockEditConflictError(
      "EXPECTED_AVAILABLE_STOCK_REQUIRED",
      "Reload the product before changing available stock",
    );
  }

  if (levels.length > 1) {
    throw new AvailableStockEditConflictError(
      "MULTI_WAREHOUSE_STOCK_EDIT_REQUIRED",
      "Inventory is stored in multiple warehouses; adjust each warehouse from the Inventory page",
    );
  }

  let warehouseId: number | null = levels[0]?.warehouseId ?? null;
  let change = 0;

  if (levels.length === 1) {
    const level = levels[0];
    const nextOnHandQuantity = availableQuantity + level.reserved;
    if (!Number.isSafeInteger(nextOnHandQuantity)) {
      throw new Error("Resulting on-hand stock is too large");
    }
    const updated = await tx.stockLevel.updateMany({
      where: {
        id: level.id,
        quantity: level.quantity,
        reserved: level.reserved,
      },
      data: { quantity: nextOnHandQuantity },
    });
    if (updated.count !== 1) {
      throw new AvailableStockEditConflictError(
        "AVAILABLE_STOCK_CHANGED",
        "Available stock changed during this edit; reload and try again",
      );
    }
    change = nextOnHandQuantity - level.quantity;
  } else {
    warehouseId = await getPrimaryWarehouseId(tx);
    if (!warehouseId) {
      throw new Error(
        "A warehouse is required before adding stock to a physical product",
      );
    }
    await tx.stockLevel.create({
      data: {
        warehouseId,
        productVariantId,
        quantity: availableQuantity,
        reserved: 0,
      },
    });
    // The legacy value is the pre-existing baseline. Record only the explicit
    // administrator adjustment instead of inventing a historical receipt.
    change = availableQuantity - currentAvailable;
  }

  const stock = await refreshVariantStock(tx, productVariantId);
  if (change !== 0 && warehouseId !== null) {
    await tx.inventoryLog.create({
      data: {
        productId,
        variantId: productVariantId,
        warehouseId,
        change,
        reason,
      },
    });
  }
  await captureVariantInventoryDailySnapshots(tx, productVariantId);

  return { changed: true, warehouseId, stock };
}

export async function deleteVariantIfSafe(
  tx: TransactionClient,
  productVariantId: number,
) {
  // Serialize deletion with legacy initialization and direct variant-stock
  // edits before inspecting either inventory representation.
  await tx.$executeRaw`
    UPDATE "ProductVariant"
    SET "stock" = "stock"
    WHERE "id" = ${productVariantId}
  `;
  const variant = await tx.productVariant.findUnique({
    where: { id: productVariantId },
    include: {
      stockLevels: {
        select: {
          id: true,
          quantity: true,
          reserved: true,
          _count: { select: { reservations: true } },
        },
      },
      _count: {
        select: {
          orderItems: true,
          orderBundleComponents: true,
          inventoryLogs: true,
          dailySnapshots: true,
          warehouseDailySnapshots: true,
          cartItems: true,
          bundleGroupOptions: true,
        },
      },
    },
  });
  if (!variant) return null;

  if (variant.stockLevels.length === 0 && Number(variant.stock) > 0) {
    throw new InventoryDeletionConflictError(
      "VARIANT_HAS_INVENTORY",
      "This legacy variant still has stock; reconcile it to zero before deleting it",
    );
  }

  if (
    variant.stockLevels.some(
      (level) => level._count.reservations > 0 || level.reserved > 0,
    )
  ) {
    throw new InventoryDeletionConflictError(
      "VARIANT_HAS_RESERVATIONS",
      "This variant has inventory reservations; release or complete them before deleting it",
    );
  }
  if (variant.stockLevels.some((level) => level.quantity > 0)) {
    throw new InventoryDeletionConflictError(
      "VARIANT_HAS_INVENTORY",
      "This variant still has on-hand inventory; reconcile every warehouse to zero before deleting it",
    );
  }
  if (variant._count.orderItems > 0 || variant._count.orderBundleComponents > 0) {
    throw new InventoryDeletionConflictError(
      "VARIANT_HAS_ORDER_HISTORY",
      "This variant has order history and cannot be deleted; deactivate it instead",
    );
  }
  if (
    variant._count.inventoryLogs > 0 ||
    variant._count.dailySnapshots > 0 ||
    variant._count.warehouseDailySnapshots > 0
  ) {
    throw new InventoryDeletionConflictError(
      "VARIANT_HAS_INVENTORY_HISTORY",
      "This variant has inventory history and cannot be deleted; deactivate it instead",
    );
  }
  if (variant._count.cartItems > 0 || variant._count.bundleGroupOptions > 0) {
    throw new InventoryDeletionConflictError(
      "VARIANT_IS_REFERENCED",
      "This variant is still referenced and cannot be deleted; deactivate it instead",
    );
  }

  const stockLevelIds = variant.stockLevels.map((level) => level.id);
  if (stockLevelIds.length > 0) {
    const deletedLevels = await tx.stockLevel.deleteMany({
      where: {
        id: { in: stockLevelIds },
        productVariantId,
        quantity: 0,
        reserved: 0,
        reservations: { none: {} },
      },
    });
    if (deletedLevels.count !== stockLevelIds.length) {
      throw new InventoryDeletionConflictError(
        "VARIANT_INVENTORY_CHANGED",
        "Variant inventory changed during deletion; reload and try again",
      );
    }
  }
  await tx.productCode.deleteMany({ where: { variantId: productVariantId } });
  const deletedVariant = await tx.productVariant.deleteMany({
    where: { id: productVariantId, stock: variant.stock },
  });
  if (deletedVariant.count !== 1) {
    throw new InventoryDeletionConflictError(
      "VARIANT_INVENTORY_CHANGED",
      "Variant stock changed during deletion; reload and try again",
    );
  }
  return variant;
}

/**
 * Removes an empty warehouse row without deleting reservations or inventory
 * history. The compare-and-delete condition protects the decision from a
 * concurrent quantity/reservation update inside the same transaction.
 */
export async function deleteStockLevelIfEmpty(
  tx: TransactionClient,
  stockLevelId: number,
) {
  const current = await tx.stockLevel.findUnique({
    where: { id: stockLevelId },
    select: {
      id: true,
      productVariantId: true,
      quantity: true,
      reserved: true,
      _count: { select: { reservations: true } },
    },
  });
  if (!current) return null;

  if (current.reserved > 0 || current._count.reservations > 0) {
    throw new InventoryDeletionConflictError(
      "STOCK_LEVEL_HAS_RESERVATIONS",
      "This stock level has reservations; release or complete them before deletion",
    );
  }
  if (current.quantity > 0) {
    throw new InventoryDeletionConflictError(
      "STOCK_LEVEL_HAS_INVENTORY",
      "Adjust this warehouse's on-hand quantity to zero before deleting the stock level",
    );
  }

  const deleted = await tx.stockLevel.deleteMany({
    where: { id: stockLevelId, quantity: 0, reserved: 0 },
  });
  if (deleted.count !== 1) {
    throw new InventoryDeletionConflictError(
      "STOCK_LEVEL_CHANGED",
      "Stock level changed during deletion; reload and try again",
    );
  }

  // Persist the derived zero before this transaction commits so a removed last
  // level cannot expose the variant's old legacy fallback value.
  await refreshVariantStock(tx, current.productVariantId);
  await captureVariantInventoryDailySnapshots(tx, current.productVariantId);
  return current;
}

export async function deductBundleInventory(params: {
  tx: TransactionClient;
  orderId: number;
  bundleId: number;
  warehouseId: number;
  quantity: number;
  reason: string;
}) {
  const { tx, orderId, bundleId, warehouseId, quantity, reason } = params;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Bundle deduction quantity must be greater than 0");
  }

  const updated = await tx.product.updateMany({
    where: {
      id: bundleId,
      type: "BUNDLE",
      bundleWarehouseId: warehouseId,
      bundleStockLimit: { gte: quantity },
    },
    data: { bundleStockLimit: { decrement: quantity } },
  });
  if (updated.count !== 1) {
    throw new Error("Bundle stock changed during checkout. Please try again.");
  }

  await tx.inventoryLog.create({
    data: {
      orderId,
      productId: bundleId,
      variantId: null,
      warehouseId,
      change: -quantity,
      reason,
    },
  });
}

const PREASSEMBLED_BUNDLE_STOCK_MOVEMENT = "PREASSEMBLED_BUNDLE_STOCK";

export async function deductPreassembledBundleInventory(params: {
  tx: TransactionClient;
  orderId: number;
  bundleId: number;
  warehouseId: number;
  quantity: number;
  reason: string;
}) {
  const { tx, orderId, bundleId, warehouseId, quantity, reason } = params;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Bundle deduction quantity must be greater than 0");
  }

  const updated = await tx.$queryRaw<Array<{ id: number }>>(
    Prisma.sql`
      UPDATE "BundleStockLevel"
      SET "quantity" = "quantity" - ${quantity}, "updatedAt" = NOW()
      WHERE "productId" = ${bundleId}
        AND "warehouseId" = ${warehouseId}
        AND "quantity" - "reserved" >= ${quantity}
      RETURNING "id"
    `,
  );
  if (updated.length !== 1) {
    throw new Error("Assembled bundle stock changed during checkout. Please try again.");
  }

  await tx.inventoryLog.create({
    data: {
      orderId,
      productId: bundleId,
      variantId: null,
      warehouseId,
      change: -quantity,
      reason: `${PREASSEMBLED_BUNDLE_STOCK_MOVEMENT}: ${reason}`,
    },
  });
}

export async function reservePreassembledBundleInventory(params: {
  tx: TransactionClient;
  orderId: number;
  bundleId: number;
  warehouseId: number;
  quantity: number;
  reason: string;
  expiresAt?: Date | null;
}) {
  const { tx, orderId, bundleId, warehouseId, quantity, expiresAt } = params;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Bundle reservation quantity must be greater than 0");
  }
  const updated = await tx.$queryRaw<Array<{ id: number }>>(
    Prisma.sql`
      UPDATE "BundleStockLevel"
      SET "reserved" = "reserved" + ${quantity}, "updatedAt" = NOW()
      WHERE "productId" = ${bundleId}
        AND "warehouseId" = ${warehouseId}
        AND "quantity" - "reserved" >= ${quantity}
      RETURNING "id"
    `,
  );
  if (updated.length !== 1) {
    throw new Error("Assembled bundle stock changed during checkout. Please try again.");
  }
  await tx.bundleStockReservation.create({
    data: {
      bundleStockLevelId: updated[0].id,
      orderId,
      quantity,
      expiresAt: expiresAt ?? null,
    },
  });
}

export async function deductVariantInventory(params: {
  tx: TransactionClient;
  orderId?: number | null;
  productId: number;
  productVariantId: number;
  quantity: number;
  reason: string;
  warehouseId?: number | null;
}) {
  const { tx, orderId, productId, productVariantId, quantity, reason } = params;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Deduction quantity must be greater than 0");
  }

  const levels = await tx.stockLevel.findMany({
    where: {
      productVariantId,
      ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
    },
    include: {
      warehouse: {
        select: { id: true, code: true, isDefault: true },
      },
    },
    orderBy: [{ warehouse: { isDefault: "desc" } }, { warehouseId: "asc" }],
  });

  const totalAvailable = computeAvailableStock(levels);
  if (totalAvailable < quantity) {
    throw new Error("Insufficient stock for the selected variant");
  }

  let remaining = quantity;

  for (const level of levels) {
    if (remaining <= 0) break;

    const available = Math.max(0, Number(level.quantity) - Number(level.reserved));
    if (available <= 0) continue;

    const take = Math.min(available, remaining);
    const updated = await tx.stockLevel.updateMany({
      where: {
        id: level.id,
        quantity: {
          gte: Number(level.reserved) + take,
        },
      },
      data: {
        quantity: {
          decrement: take,
        },
      },
    });

    if (updated.count !== 1) {
      throw new Error("Stock changed during checkout. Please try again.");
    }

    await tx.inventoryLog.create({
      data: {
        orderId,
        productId,
        variantId: productVariantId,
        warehouseId: level.warehouseId,
        change: -take,
        reason: `${reason} (${level.warehouse.code})`,
      },
    });

    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error("Unable to allocate inventory across warehouses");
  }

  const stock = await refreshVariantStock(tx, productVariantId);
  await captureVariantInventoryDailySnapshots(tx, productVariantId);
  return { stock };
}

export async function recordPreassembledBundleAssembly(params: {
  tx: TransactionClient;
  bundleId: number;
  warehouseId: number;
  quantity: number;
  reason: string;
}) {
  const { tx, bundleId, warehouseId, quantity, reason } = params;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Assembly quantity must be a whole number greater than 0");
  }
  await tx.bundleStockLevel.upsert({
    where: { productId_warehouseId: { productId: bundleId, warehouseId } },
    create: { productId: bundleId, warehouseId, quantity, reserved: 0 },
    update: { quantity: { increment: quantity } },
  });
  await tx.inventoryLog.create({
    data: {
      productId: bundleId,
      variantId: null,
      warehouseId,
      change: quantity,
      reason: `PREASSEMBLED_BUNDLE_ASSEMBLY: ${reason}`,
    },
  });
}

export async function reserveVariantInventory(params: {
  tx: TransactionClient;
  productId: number;
  productVariantId: number;
  orderId: number;
  userId?: string | null;
  quantity: number;
  reason: string;
  expiresAt?: Date | null;
  warehouseId?: number | null;
}) {
  const {
    tx,
    productVariantId,
    orderId,
    userId,
    quantity,
    reason,
    expiresAt,
  } = params;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Reservation quantity must be greater than 0");
  }

  const levels = await tx.stockLevel.findMany({
    where: {
      productVariantId,
      ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
    },
    include: {
      warehouse: { select: { id: true, code: true, isDefault: true } },
    },
    orderBy: [{ warehouse: { isDefault: "desc" } }, { warehouseId: "asc" }],
  });

  if (computeAvailableStock(levels) < quantity) {
    throw new Error("Insufficient stock for the selected variant");
  }

  let remaining = quantity;
  for (const level of levels) {
    if (remaining <= 0) break;
    const available = Math.max(0, Number(level.quantity) - Number(level.reserved));
    if (available <= 0) continue;

    const take = Math.min(available, remaining);
    const updated = await tx.stockLevel.updateMany({
      where: {
        id: level.id,
        reserved: level.reserved,
        quantity: { gte: Number(level.reserved) + take },
      },
      data: { reserved: { increment: take } },
    });
    if (updated.count !== 1) {
      throw new Error("Stock changed during checkout. Please try again.");
    }

    await tx.inventoryReservation.create({
      data: {
        stockLevelId: level.id,
        orderId,
        userId: userId ?? null,
        quantity: take,
        reason: `${reason} (${level.warehouse.code})`,
        expiresAt: expiresAt ?? null,
      },
    });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error("Unable to reserve inventory across warehouses");
  }

  const stock = await refreshVariantStock(tx, productVariantId);
  await captureVariantInventoryDailySnapshots(tx, productVariantId);
  return { stock };
}

export async function commitOrderInventoryReservations(params: {
  tx: TransactionClient;
  orderId: number;
  reason: string;
}) {
  const { tx, orderId, reason } = params;
  const reservations = await tx.inventoryReservation.findMany({
    where: { orderId },
    include: {
      stockLevel: {
        select: {
          id: true,
          warehouseId: true,
          productVariantId: true,
          variant: { select: { productId: true } },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const touchedVariants = new Set<number>();
  let committedQuantity = 0;
  for (const reservation of reservations) {
    const updated = await tx.stockLevel.updateMany({
      where: {
        id: reservation.stockLevelId,
        reserved: { gte: reservation.quantity },
        quantity: { gte: reservation.quantity },
      },
      data: {
        reserved: { decrement: reservation.quantity },
        quantity: { decrement: reservation.quantity },
      },
    });
    if (updated.count !== 1) {
      throw new Error("Reserved inventory could not be committed");
    }

    await tx.inventoryLog.create({
      data: {
        orderId,
        productId: reservation.stockLevel.variant.productId,
        variantId: reservation.stockLevel.productVariantId,
        warehouseId: reservation.stockLevel.warehouseId,
        change: -reservation.quantity,
        reason,
      },
    });
    await tx.inventoryReservation.delete({ where: { id: reservation.id } });
    touchedVariants.add(reservation.stockLevel.productVariantId);
    committedQuantity += reservation.quantity;
  }

  for (const variantId of touchedVariants) {
    await refreshVariantStock(tx, variantId);
    await captureVariantInventoryDailySnapshots(tx, variantId);
  }
  const bundleReservations = await tx.bundleStockReservation.findMany({
    where: { orderId },
    include: { bundleStockLevel: { select: { productId: true, warehouseId: true } } },
    orderBy: { id: "asc" },
  });
  let committedBundleQuantity = 0;
  for (const reservation of bundleReservations) {
    const updated = await tx.bundleStockLevel.updateMany({
      where: {
        id: reservation.bundleStockLevelId,
        reserved: { gte: reservation.quantity },
        quantity: { gte: reservation.quantity },
      },
      data: {
        reserved: { decrement: reservation.quantity },
        quantity: { decrement: reservation.quantity },
      },
    });
    if (updated.count !== 1) throw new Error("Reserved bundle inventory could not be committed");
    await tx.inventoryLog.create({
      data: {
        orderId,
        productId: reservation.bundleStockLevel.productId,
        variantId: null,
        warehouseId: reservation.bundleStockLevel.warehouseId,
        change: -reservation.quantity,
        reason: `${PREASSEMBLED_BUNDLE_STOCK_MOVEMENT}: ${reason}`,
      },
    });
    await tx.bundleStockReservation.delete({ where: { id: reservation.id } });
    committedBundleQuantity += reservation.quantity;
  }
  return {
    reservationCount: reservations.length + bundleReservations.length,
    committedQuantity,
    committedBundleQuantity,
  };
}

export async function releaseOrderInventoryReservations(params: {
  tx: TransactionClient;
  orderId: number;
}) {
  const { tx, orderId } = params;
  const reservations = await tx.inventoryReservation.findMany({
    where: { orderId },
    select: {
      id: true,
      stockLevelId: true,
      quantity: true,
      stockLevel: { select: { productVariantId: true } },
    },
    orderBy: { id: "asc" },
  });

  const touchedVariants = new Set<number>();
  let releasedQuantity = 0;
  for (const reservation of reservations) {
    const updated = await tx.stockLevel.updateMany({
      where: {
        id: reservation.stockLevelId,
        reserved: { gte: reservation.quantity },
      },
      data: { reserved: { decrement: reservation.quantity } },
    });
    if (updated.count !== 1) {
      throw new Error("Reserved inventory could not be released");
    }
    await tx.inventoryReservation.delete({ where: { id: reservation.id } });
    touchedVariants.add(reservation.stockLevel.productVariantId);
    releasedQuantity += reservation.quantity;
  }

  for (const variantId of touchedVariants) {
    await refreshVariantStock(tx, variantId);
    await captureVariantInventoryDailySnapshots(tx, variantId);
  }
  const bundleReservations = await tx.bundleStockReservation.findMany({
    where: { orderId },
    select: { id: true, bundleStockLevelId: true, quantity: true },
    orderBy: { id: "asc" },
  });
  let releasedBundleQuantity = 0;
  for (const reservation of bundleReservations) {
    const updated = await tx.bundleStockLevel.updateMany({
      where: { id: reservation.bundleStockLevelId, reserved: { gte: reservation.quantity } },
      data: { reserved: { decrement: reservation.quantity } },
    });
    if (updated.count !== 1) throw new Error("Reserved bundle inventory could not be released");
    await tx.bundleStockReservation.delete({ where: { id: reservation.id } });
    releasedBundleQuantity += reservation.quantity;
  }
  return {
    reservationCount: reservations.length + bundleReservations.length,
    releasedQuantity: releasedQuantity + releasedBundleQuantity,
  };
}

export type OrderInventoryMovement = {
  productId: number;
  variantId: number | null;
  warehouseId: number | null;
  change: number;
  productType?: string;
  reason?: string;
};

export type OrderInventoryRestock = {
  productId: number;
  variantId: number;
  warehouseId: number;
  quantity: number;
};

export type OrderBundleInventoryRestock = {
  productId: number;
  warehouseId: number;
  quantity: number;
};

/**
 * Calculates only the outstanding quantity that still needs to be returned.
 * Positive restoration logs offset the original negative deduction logs, which
 * makes retrying a terminal status transition safe and idempotent.
 */
export function buildOrderInventoryRestockPlan(
  movements: OrderInventoryMovement[],
): OrderInventoryRestock[] {
  const netByAllocation = new Map<
    string,
    Omit<OrderInventoryRestock, "quantity"> & { netChange: number }
  >();

  for (const movement of movements) {
    if (
      !Number.isSafeInteger(movement.productId) ||
      !Number.isSafeInteger(movement.variantId) ||
      !Number.isSafeInteger(movement.warehouseId) ||
      !Number.isSafeInteger(movement.change) ||
      movement.variantId === null ||
      movement.warehouseId === null
    ) {
      continue;
    }

    const key = `${movement.productId}:${movement.variantId}:${movement.warehouseId}`;
    const current = netByAllocation.get(key);
    netByAllocation.set(key, {
      productId: movement.productId,
      variantId: movement.variantId,
      warehouseId: movement.warehouseId,
      netChange: (current?.netChange ?? 0) + movement.change,
    });
  }

  return Array.from(netByAllocation.values())
    .filter((allocation) => allocation.netChange < 0)
    .map(({ netChange, ...allocation }) => ({
      ...allocation,
      quantity: -netChange,
    }))
    .sort(
      (left, right) =>
        left.variantId - right.variantId ||
        left.warehouseId - right.warehouseId ||
        left.productId - right.productId,
    );
}

export function buildOrderBundleInventoryRestockPlan(
  movements: OrderInventoryMovement[],
): OrderBundleInventoryRestock[] {
  const netByAllocation = new Map<
    string,
    Omit<OrderBundleInventoryRestock, "quantity"> & { netChange: number }
  >();

  for (const movement of movements) {
    if (
      movement.productType !== "BUNDLE" ||
      movement.reason?.startsWith(`${PREASSEMBLED_BUNDLE_STOCK_MOVEMENT}:`) ||
      movement.variantId !== null ||
      !Number.isSafeInteger(movement.productId) ||
      !Number.isSafeInteger(movement.warehouseId) ||
      movement.warehouseId === null ||
      !Number.isSafeInteger(movement.change)
    ) {
      continue;
    }
    const key = `${movement.productId}:${movement.warehouseId}`;
    const current = netByAllocation.get(key);
    netByAllocation.set(key, {
      productId: movement.productId,
      warehouseId: movement.warehouseId,
      netChange: (current?.netChange ?? 0) + movement.change,
    });
  }

  return Array.from(netByAllocation.values())
    .filter((allocation) => allocation.netChange < 0)
    .map(({ netChange, ...allocation }) => ({
      ...allocation,
      quantity: -netChange,
    }))
    .sort(
      (left, right) =>
        left.productId - right.productId || left.warehouseId - right.warehouseId,
    );
}

export function buildOrderPreassembledBundleRestockPlan(
  movements: OrderInventoryMovement[],
): OrderBundleInventoryRestock[] {
  const netByAllocation = new Map<string, OrderBundleInventoryRestock & { netChange: number }>();
  for (const movement of movements) {
    if (
      movement.productType !== "BUNDLE" ||
      movement.variantId !== null ||
      !movement.reason?.startsWith(`${PREASSEMBLED_BUNDLE_STOCK_MOVEMENT}:`) ||
      !Number.isSafeInteger(movement.productId) ||
      !Number.isSafeInteger(movement.warehouseId) ||
      movement.warehouseId === null ||
      !Number.isSafeInteger(movement.change)
    ) continue;
    const key = `${movement.productId}:${movement.warehouseId}`;
    const current = netByAllocation.get(key);
    netByAllocation.set(key, {
      productId: movement.productId,
      warehouseId: movement.warehouseId,
      quantity: 0,
      netChange: (current?.netChange ?? 0) + movement.change,
    });
  }
  return Array.from(netByAllocation.values())
    .filter((allocation) => allocation.netChange < 0)
    .map(({ netChange, ...allocation }) => ({ ...allocation, quantity: -netChange }));
}

export async function restoreOrderInventory(params: {
  tx: TransactionClient;
  orderId: number;
  reason: string;
}) {
  const { tx, orderId, reason } = params;
  const released = await releaseOrderInventoryReservations({ tx, orderId });
  const movements = await tx.inventoryLog.findMany({
    where: { orderId },
    select: {
      productId: true,
      variantId: true,
      warehouseId: true,
      change: true,
      reason: true,
      product: { select: { type: true } },
    },
    orderBy: { id: "asc" },
  });
  const normalizedMovements = movements.map((movement) => ({
    productId: movement.productId,
    variantId: movement.variantId,
    warehouseId: movement.warehouseId,
    change: movement.change,
    reason: movement.reason,
    productType: movement.product?.type,
  }));
  const restockPlan = buildOrderInventoryRestockPlan(normalizedMovements);
  const bundleRestockPlan = buildOrderBundleInventoryRestockPlan(normalizedMovements);
  const preassembledBundleRestockPlan = buildOrderPreassembledBundleRestockPlan(normalizedMovements);
  const touchedVariants = new Set<number>();
  let restoredQuantity = 0;

  for (const allocation of restockPlan) {
    await tx.stockLevel.upsert({
      where: {
        warehouseId_productVariantId: {
          warehouseId: allocation.warehouseId,
          productVariantId: allocation.variantId,
        },
      },
      create: {
        warehouseId: allocation.warehouseId,
        productVariantId: allocation.variantId,
        quantity: allocation.quantity,
        reserved: 0,
      },
      update: {
        quantity: { increment: allocation.quantity },
      },
    });
    await tx.inventoryLog.create({
      data: {
        orderId,
        productId: allocation.productId,
        variantId: allocation.variantId,
        warehouseId: allocation.warehouseId,
        change: allocation.quantity,
        reason,
      },
    });
    touchedVariants.add(allocation.variantId);
    restoredQuantity += allocation.quantity;
  }

  let restoredBundleQuantity = 0;
  for (const allocation of bundleRestockPlan) {
    const updated = await tx.product.updateMany({
      where: {
        id: allocation.productId,
        type: "BUNDLE",
        bundleWarehouseId: allocation.warehouseId,
        bundleStockLimit: { not: null },
      },
      data: { bundleStockLimit: { increment: allocation.quantity } },
    });
    // The sale cap is optional and can be cleared or moved after checkout.
    // In that case component stock must still be restored, but the historical
    // cap must not be recreated against the administrator's current settings.
    if (updated.count !== 1) continue;
    await tx.inventoryLog.create({
      data: {
        orderId,
        productId: allocation.productId,
        variantId: null,
        warehouseId: allocation.warehouseId,
        change: allocation.quantity,
        reason,
      },
    });
    restoredBundleQuantity += allocation.quantity;
  }

  let restoredPreassembledBundleQuantity = 0;
  for (const allocation of preassembledBundleRestockPlan) {
    await tx.bundleStockLevel.upsert({
      where: {
        productId_warehouseId: {
          productId: allocation.productId,
          warehouseId: allocation.warehouseId,
        },
      },
      create: {
        productId: allocation.productId,
        warehouseId: allocation.warehouseId,
        quantity: allocation.quantity,
        reserved: 0,
      },
      update: { quantity: { increment: allocation.quantity } },
    });
    await tx.inventoryLog.create({
      data: {
        orderId,
        productId: allocation.productId,
        variantId: null,
        warehouseId: allocation.warehouseId,
        change: allocation.quantity,
        reason: `${PREASSEMBLED_BUNDLE_STOCK_MOVEMENT}: ${reason}`,
      },
    });
    restoredPreassembledBundleQuantity += allocation.quantity;
  }

  for (const variantId of touchedVariants) {
    await refreshVariantStock(tx, variantId);
    await captureVariantInventoryDailySnapshots(tx, variantId);
  }

  return {
    releasedReservationCount: released.reservationCount,
    releasedReservationQuantity: released.releasedQuantity,
    restoredAllocationCount: restockPlan.length,
    restoredQuantity,
    restoredBundleAllocationCount: bundleRestockPlan.length,
    restoredBundleQuantity,
    restoredPreassembledBundleQuantity,
  };
}

export async function cleanupExpiredInventoryReservations(params: {
  tx: TransactionClient;
  now?: Date;
  batchSize?: number;
}) {
  const { tx } = params;
  const now = params.now ?? new Date();
  const batchSize = Math.min(250, Math.max(1, params.batchSize ?? 100));
  const expiredVariant = await tx.inventoryReservation.findMany({
    where: {
      orderId: { not: null },
      expiresAt: { not: null, lte: now },
    },
    select: { orderId: true },
    distinct: ["orderId"],
    take: batchSize,
    orderBy: { id: "asc" },
  });
  const expiredBundle = await tx.bundleStockReservation.findMany({
    where: { expiresAt: { not: null, lte: now } },
    select: { orderId: true },
    distinct: ["orderId"],
    take: batchSize,
    orderBy: { id: "asc" },
  });
  const expiredOrders = Array.from(new Set(
    [...expiredVariant, ...expiredBundle]
      .map((row) => row.orderId)
      .filter((orderId): orderId is number => orderId !== null),
  )).slice(0, batchSize);

  let releasedOrders = 0;
  let releasedQuantity = 0;
  for (const orderId of expiredOrders) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        paymentStatus: true,
        payment_method: true,
        couponId: true,
        discount_total: true,
        payments: { select: { status: true } },
      },
    });
    if (
      !order ||
      order.payment_method?.startsWith("EPS:") ||
      order.payment_method?.startsWith("AIBL_WALLET:") ||
      order.paymentStatus === "PAID" ||
      order.payments.some((payment) => payment.status === "CAPTURED")
    ) {
      continue;
    }

    const restored = await restoreOrderInventory({
      tx,
      orderId,
      reason: `Order #${orderId} expired payment inventory restoration`,
    });
    if (
      restored.releasedReservationCount === 0 &&
      restored.restoredBundleQuantity === 0 &&
      restored.restoredQuantity === 0
      && restored.restoredPreassembledBundleQuantity === 0
    ) continue;

    await tx.payment.updateMany({
      where: {
        orderId,
        status: { in: ["INITIATED", "AUTHORIZED"] },
      },
      data: { status: "FAILED" },
    });
    await tx.order.updateMany({
      where: { id: orderId, paymentStatus: "UNPAID" },
      data: { status: "FAILED" },
    });
    if (order.couponId && Number(order.discount_total || 0) > 0) {
      await tx.coupon.updateMany({
        where: { id: order.couponId, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }
    releasedOrders += 1;
    releasedQuantity +=
      restored.releasedReservationQuantity +
      restored.restoredQuantity +
      restored.restoredBundleQuantity +
      restored.restoredPreassembledBundleQuantity;
  }

  return { scannedOrders: expiredOrders.length, releasedOrders, releasedQuantity };
}

export async function receiveVariantInventory(params: {
  tx: TransactionClient;
  productId: number;
  productVariantId: number;
  warehouseId: number;
  quantity: number;
  reason: string;
}) {
  const { tx, productId, productVariantId, warehouseId, quantity, reason } = params;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Receipt quantity must be greater than 0");
  }

  await tx.stockLevel.upsert({
    where: {
      warehouseId_productVariantId: {
        warehouseId,
        productVariantId,
      },
    },
    create: {
      warehouseId,
      productVariantId,
      quantity,
      reserved: 0,
    },
    update: {
      quantity: {
        increment: quantity,
      },
    },
  });

  await tx.inventoryLog.create({
    data: {
      productId,
      variantId: productVariantId,
      warehouseId,
      change: quantity,
      reason,
    },
  });

  const stock = await refreshVariantStock(tx, productVariantId);
  await captureVariantInventoryDailySnapshots(tx, productVariantId);
  return { stock };
}

export async function dispatchVariantInventory(params: {
  tx: TransactionClient;
  productId: number;
  productVariantId: number;
  warehouseId: number;
  quantity: number;
  reason: string;
}) {
  const {
    tx,
    productId,
    productVariantId,
    warehouseId,
    quantity,
    reason,
  } = params;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Dispatch quantity must be greater than 0");
  }

  const sourceLevel = await tx.stockLevel.findUnique({
    where: {
      warehouseId_productVariantId: {
        warehouseId,
        productVariantId,
      },
    },
    select: {
      quantity: true,
      reserved: true,
    },
  });

  const sourceAvailable = Math.max(
    0,
    Number(sourceLevel?.quantity ?? 0) - Number(sourceLevel?.reserved ?? 0),
  );
  if (sourceAvailable < quantity) {
    throw new Error("Insufficient source warehouse stock for transfer");
  }

  const updated = await tx.stockLevel.updateMany({
    where: {
      warehouseId,
      productVariantId,
      quantity: {
        gte: Number(sourceLevel?.reserved ?? 0) + quantity,
      },
    },
    data: {
      quantity: {
        decrement: quantity,
      },
    },
  });

  if (updated.count !== 1) {
    throw new Error("Warehouse stock changed during dispatch. Please try again.");
  }

  await tx.inventoryLog.create({
    data: {
      productId,
      variantId: productVariantId,
      warehouseId,
      change: -quantity,
      reason,
    },
  });

  const stock = await refreshVariantStock(tx, productVariantId);
  await captureVariantInventoryDailySnapshots(tx, productVariantId);
  return { stock };
}
