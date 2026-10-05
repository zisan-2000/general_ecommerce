import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma } from "@/generated/prisma";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { resolveWarehouseScope } from "@/lib/warehouse-scope";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";
import { configurableBundleGroupSelect, resolveBundleConfiguration } from "@/lib/configurable-bundle";
import { buildWarehouseBundleRows, bundleMovementKind, warehouseBundleWhere } from "@/lib/warehouse-bundle-stock";

const headers = { "Cache-Control": "private, no-store" };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });

function positiveInteger(value: string | null, fallback?: number) {
  if (value === null) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(session?.user);
    if (!access.userId) return json({ error: "Unauthorized" }, 401);
    if (!access.has("inventory.manage")) return json({ error: "Forbidden" }, 403);
    const gate = await gateStoreFeature("BUNDLES", 403);
    if (gate) return gate;

    const params = new URL(request.url).searchParams;
    const warehouseId = positiveInteger(params.get("warehouseId"));
    const bundleId = positiveInteger(params.get("bundleId"));
    const page = positiveInteger(params.get("page"), 1);
    const limit = positiveInteger(params.get("limit"), 20);
    if (!page || page > 1_000_000 || !limit || (params.has("warehouseId") && !warehouseId) || (params.has("bundleId") && !bundleId)) {
      return json({ error: "Invalid pagination, warehouse or bundle id" }, 400);
    }
    const scope = resolveWarehouseScope(access, "inventory.manage", warehouseId);
    if (warehouseId && scope.mode === "none") return json({ error: "Forbidden" }, 403);
    const permittedScope = resolveWarehouseScope(access, "inventory.manage");
    const warehouseWhere: Prisma.WarehouseWhereInput = permittedScope.mode === "all"
      ? {} : { id: { in: permittedScope.warehouseIds } };
    const levelWhere = scope.mode === "all" ? {} : { warehouseId: { in: scope.warehouseIds } };
    const search = params.get("search")?.trim().slice(0, 200);
    const where: Prisma.ProductWhereInput = {
      type: "BUNDLE",
      AND: [{ OR: [
        { deleted: false },
        { assembledStockLevels: { some: { ...levelWhere, OR: [{ quantity: { gt: 0 } }, { reserved: { gt: 0 } }] } } },
      ] }, warehouseBundleWhere(scope), ...(search ? [{ OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { sku: { contains: search, mode: "insensitive" as const } },
      ] }] : [])],
      ...(bundleId ? { id: bundleId } : {}),
    };
    const select = {
      id: true, name: true, sku: true, basePrice: true, currency: true, available: true, deleted: true,
      bundleStockLimit: true, bundleWarehouseId: true, bundleFulfillmentMode: true,
      bundleWarehouse: { select: { id: true, name: true, code: true } },
      assembledStockLevels: { where: levelWhere, select: {
        warehouseId: true, quantity: true, reserved: true,
        warehouse: { select: { id: true, name: true, code: true } },
      } },
      bundleGroups: { orderBy: { sortOrder: "asc" as const }, select: configurableBundleGroupSelect },
    } satisfies Prisma.ProductSelect;

    if (bundleId) {
      if (!warehouseId) return json({ error: "Select a warehouse for bundle stock details" }, 400);
      const bundle = await prisma.product.findFirst({ where, select });
      if (!bundle) return json({ error: "Bundle stock not found" }, 404);
      const row = buildWarehouseBundleRows(bundle, scope).find((item) => item.warehouse.id === warehouseId);
      if (!row) return json({ error: "Bundle stock not found" }, 404);
      const [logs, reservations] = await Promise.all([
        prisma.inventoryLog.findMany({
          where: { productId: bundleId, warehouseId, variantId: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200,
          select: { id: true, change: true, reason: true, createdAt: true, orderId: true },
        }),
        prisma.bundleStockReservation.findMany({
          where: { bundleStockLevel: { productId: bundleId, warehouseId } },
          orderBy: { id: "desc" }, select: { id: true, orderId: true, quantity: true, expiresAt: true },
        }),
      ]);
      let components: Array<{ productId: number; name: string; variant: string | null; quantity: number; available: number | null }> = [];
      if (!bundle.deleted && bundle.bundleWarehouseId === warehouseId && !row.configurationError) {
        components = resolveBundleConfiguration({
          bundle: { ...bundle, bundleFulfillmentMode: "VIRTUAL", bundleStockLimit: null }, strictWarehouseStock: true,
        }).components.map((item) => ({ productId: item.productId, name: item.productName,
          variant: item.variantLabel, quantity: item.quantity, available: item.availableStock }));
      }
      return json({ row, components, logs: logs.map((log) => ({ ...log,
        createdAt: log.createdAt.toISOString(), kind: bundleMovementKind(log.reason),
      })), reservations: reservations.map((hold) => ({ ...hold, expiresAt: hold.expiresAt?.toISOString() ?? null })) });
    }

    const pageSize = Math.min(limit, 50);
    const [bundles, total, warehouses] = await Promise.all([
      prisma.product.findMany({ where, select, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: "desc" } }),
      prisma.product.count({ where }),
      prisma.warehouse.findMany({ where: warehouseWhere, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    ]);
    return json({ rows: bundles.flatMap((bundle) => buildWarehouseBundleRows(bundle, scope)), warehouses,
      pagination: { page, limit: pageSize, total, pages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error("Warehouse bundle stock error:", error);
    return json({ error: "Failed to load warehouse bundle stock" }, 500);
  }
}
