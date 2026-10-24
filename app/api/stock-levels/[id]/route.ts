import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import {
  InventoryDeletionConflictError,
  deleteStockLevelIfEmpty,
} from "@/lib/inventory";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import { getAccessContext } from "@/lib/rbac";
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
   DELETE STOCK LEVEL
========================= */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await prisma.stockLevel.findUnique({
      where: { id },
      include: {
        warehouse: true,
        variant: {
          include: { product: { select: { id: true, type: true } } },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Stock level not found" },
        { status: 404 },
      );
    }

    if (!access.can("inventory.manage", existing.warehouseId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleted = await prisma.$transaction((tx) =>
      deleteStockLevelIfEmpty(tx, id),
    );
    if (!deleted) {
      return NextResponse.json(
        { error: "Stock level changed after it was loaded; reload and try again" },
        { status: 409 },
      );
    }

    revalidateStorefrontCatalog();
    const change = 0;

    await logActivity({
      action: "delete_stock_level",
      entity: "stock_level",
      entityId: existing.id,
      access,
      request: req,
      metadata: {
        message: `Stock level deleted for variant #${existing.productVariantId} in warehouse ${existing.warehouse.code}`,
        warehouseCode: existing.warehouse.code,
        stockChange: change,
      },
      before: toStockLevelLogSnapshot(existing),
    });

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("DELETE STOCK LEVEL ERROR:", error);
    if (error instanceof InventoryDeletionConflictError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 409 },
      );
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        {
          error:
            "This stock level gained a reservation or reference during deletion; reload and try again",
          code: "STOCK_LEVEL_CHANGED",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to delete stock level" },
      { status: 500 },
    );
  }
}
