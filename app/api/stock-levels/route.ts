import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import {
  activateStockedSimpleProductVariant,
  AvailableStockEditConflictError,
  refreshVariantStock,
} from "@/lib/inventory";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import { getAccessContext } from "@/lib/rbac";
import { captureVariantInventoryDailySnapshots } from "@/lib/report-history";
import { resolveWarehouseScope } from "@/lib/warehouse-scope";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

function toStockLevelLogSnapshot(stockLevel: {
  id: number;
  warehouseId: number;
  productVariantId: number;
  quantity: unknown;
  reserved: unknown;
}) {
  return {
    id: stockLevel.id,
    warehouseId: stockLevel.warehouseId,
    productVariantId: stockLevel.productVariantId,
    quantity: Number(stockLevel.quantity),
    reserved: Number(stockLevel.reserved),
  };
}

/* =========================
   GET STOCK LEVELS
   Query: ?productVariantId=1 or ?productId=1
========================= */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(
      session?.user as { id?: string; role?: string } | undefined,
    );
    if (!access.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!access.has("inventory.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const variantIdParam = url.searchParams.get("productVariantId");
    const productIdParam = url.searchParams.get("productId");
    const warehouseIdParam = url.searchParams.get("warehouseId");

    const productVariantId = variantIdParam ? Number(variantIdParam) : null;
    const productId = productIdParam ? Number(productIdParam) : null;
    const requestedWarehouseId = warehouseIdParam ? Number(warehouseIdParam) : null;
    const warehouseScope = resolveWarehouseScope(access, "inventory.manage", requestedWarehouseId);

    if (warehouseScope.mode === "none") {
      return NextResponse.json([], { status: 200 });
    }

    const warehouseWhere =
      warehouseScope.mode === "assigned"
        ? { warehouseId: { in: warehouseScope.warehouseIds } }
        : {};

    if (productVariantId && !Number.isNaN(productVariantId)) {
      const levels = await prisma.stockLevel.findMany({
        where: { productVariantId, ...warehouseWhere },
        orderBy: { id: "desc" },
        include: { warehouse: true },
      });
      return NextResponse.json(levels);
    }

    if (productId && !Number.isNaN(productId)) {
      const variants = await prisma.productVariant.findMany({
        where: { productId },
        orderBy: { id: "desc" },
        include: {
          stockLevels: {
            where: warehouseWhere,
            include: { warehouse: true },
            orderBy: { id: "desc" },
          },
        },
      });
      return NextResponse.json(variants);
    }

    const levels = await prisma.stockLevel.findMany({
      where: warehouseWhere,
      orderBy: { id: "desc" },
      include: { warehouse: true, variant: true },
    });
    return NextResponse.json(levels);
  } catch (error) {
    console.error("GET STOCK LEVELS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock levels" },
      { status: 500 },
    );
  }
}

/* =========================
   UPSERT STOCK LEVEL
========================= */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(
      session?.user as { id?: string; role?: string } | undefined,
    );
    if (!access.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!access.has("inventory.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const warehouseId = Number(body.warehouseId);
    const productVariantId = Number(body.productVariantId);
    const quantity = Number(body.quantity);
    const expectedQuantity =
      body.expectedQuantity !== undefined && body.expectedQuantity !== null
        ? Number(body.expectedQuantity)
        : null;
    const expectedReserved =
      body.expectedReserved !== undefined && body.expectedReserved !== null
        ? Number(body.expectedReserved)
        : null;

    if (!warehouseId || Number.isNaN(warehouseId)) {
      return NextResponse.json(
        { error: "warehouseId is required" },
        { status: 400 },
      );
    }
    if (!productVariantId || Number.isNaN(productVariantId)) {
      return NextResponse.json(
        { error: "productVariantId is required" },
        { status: 400 },
      );
    }
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      return NextResponse.json(
        { error: "Quantity must be a whole number (0 or more)" },
        { status: 400 },
      );
    }
    if (
      (expectedQuantity !== null &&
        (!Number.isSafeInteger(expectedQuantity) || expectedQuantity < 0)) ||
      (expectedReserved !== null &&
        (!Number.isSafeInteger(expectedReserved) || expectedReserved < 0))
    ) {
      return NextResponse.json(
        { error: "Expected inventory values must be whole numbers (0 or more)" },
        { status: 400 },
      );
    }

    if (!access.can("inventory.manage", warehouseId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const variant = await prisma.productVariant.findUnique({
      where: { id: productVariantId },
      include: { product: { select: { id: true, type: true } } },
    });

    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    if (variant.product.type !== "PHYSICAL") {
      return NextResponse.json(
        { error: "Stock levels are only available for PHYSICAL products" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.stockLevel.findUnique({
        where: {
          warehouseId_productVariantId: { warehouseId, productVariantId },
        },
      });
      const currentQuantity = Number(existing?.quantity ?? 0);
      const currentReserved = Number(existing?.reserved ?? 0);

      if (
        quantity !== currentQuantity &&
        (expectedQuantity === null || expectedReserved === null)
      ) {
        throw new AvailableStockEditConflictError(
          "EXPECTED_AVAILABLE_STOCK_REQUIRED",
          "Reload warehouse inventory before changing its quantity",
        );
      }

      if (
        (expectedQuantity !== null && expectedQuantity !== currentQuantity) ||
        (expectedReserved !== null && expectedReserved !== currentReserved)
      ) {
        throw new AvailableStockEditConflictError(
          "AVAILABLE_STOCK_CHANGED",
          "Warehouse inventory changed after it was loaded; reload and try again",
        );
      }
      if (quantity < currentReserved) {
        throw new AvailableStockEditConflictError(
          "INVALID_INVENTORY_STATE",
          "On-hand quantity cannot be lower than the reserved quantity",
        );
      }

      if (existing) {
        const changed = await tx.stockLevel.updateMany({
          where: {
            id: existing.id,
            quantity: existing.quantity,
            reserved: existing.reserved,
          },
          data: { quantity },
        });
        if (changed.count !== 1) {
          throw new AvailableStockEditConflictError(
            "AVAILABLE_STOCK_CHANGED",
            "Warehouse inventory changed during this edit; reload and try again",
          );
        }
      } else {
        await tx.stockLevel.create({
          data: { warehouseId, productVariantId, quantity, reserved: 0 },
        });
      }

      const updated = await tx.stockLevel.findUniqueOrThrow({
        where: {
          warehouseId_productVariantId: { warehouseId, productVariantId },
        },
        include: { warehouse: true },
      });
      const change = quantity - currentQuantity;

      const availableStock = await refreshVariantStock(tx, productVariantId);
      await activateStockedSimpleProductVariant(
        tx,
        productVariantId,
        availableStock,
      );
      await captureVariantInventoryDailySnapshots(tx, productVariantId);
      if (change !== 0) {
        await tx.inventoryLog.create({
          data: {
            productId: variant.product.id,
            variantId: productVariantId,
            warehouseId,
            change,
            reason: `Admin stock level adjustment (${updated.warehouse.code})`,
          },
        });
      }

      return { existing, updated, change };
    });
    const { existing, updated, change } = result;
    revalidateStorefrontCatalog();

    await logActivity({
      action: existing ? "update_stock_level" : "create_stock_level",
      entity: "stock_level",
      entityId: updated.id,
      access,
      request: req,
      metadata: {
        message: existing
          ? `Stock updated for variant #${productVariantId} in warehouse ${updated.warehouse.code}`
          : `Stock created for variant #${productVariantId} in warehouse ${updated.warehouse.code}`,
        warehouseCode: updated.warehouse.code,
        stockChange: change,
      },
      before: existing ? toStockLevelLogSnapshot(existing) : null,
      after: toStockLevelLogSnapshot(updated),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST STOCK LEVEL ERROR:", error);
    if (error instanceof AvailableStockEditConflictError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to save stock level" },
      { status: 500 },
    );
  }
}
