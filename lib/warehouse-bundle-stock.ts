import type { Prisma } from "@/generated/prisma";
import type { WarehouseScope } from "@/lib/warehouse-scope";
import { resolveBundleConfiguration, type ResolvableBundle } from "@/lib/configurable-bundle";

export type BundleWarehouse = { id: number; name: string; code: string };
export type WarehouseBundleStockRow = {
  key: string;
  bundleId: number;
  name: string;
  sku: string | null;
  mode: "VIRTUAL" | "PREASSEMBLED";
  active: boolean;
  archived: boolean;
  warehouse: BundleWarehouse;
  quantity: number | null;
  reserved: number | null;
  available: number | null;
  componentCapacity: number | null;
  saleLimit: number | null;
  orderAvailability: number;
  canManage: boolean;
  configurationError: string | null;
};

export type WarehouseBundleStockDetail = {
  row: WarehouseBundleStockRow;
  components: Array<{ productId: number; name: string; variant: string | null; quantity: number; available: number | null }>;
  logs: Array<{ id: number; change: number; reason: string | null; createdAt: string; orderId: number | null; kind: "finished" | "saleLimit" }>;
  reservations: Array<{ id: number; orderId: number; quantity: number; expiresAt: string | null }>;
};

export function warehouseBundleWhere(scope: WarehouseScope): Prisma.ProductWhereInput {
  if (scope.mode === "none") return { id: { in: [] } };
  if (scope.mode === "all") return {};
  return { OR: [
    { bundleWarehouseId: { in: scope.warehouseIds } },
    { assembledStockLevels: { some: { warehouseId: { in: scope.warehouseIds } } } },
  ] };
}

type StockBundle = ResolvableBundle & {
  sku: string | null;
  available: boolean;
  deleted?: boolean;
  bundleWarehouse: BundleWarehouse | null;
  assembledStockLevels: Array<{ warehouseId: number; quantity: number; reserved: number; warehouse: BundleWarehouse }>;
};

export function buildWarehouseBundleRows(bundle: StockBundle, scope: WarehouseScope) {
  if (scope.mode === "none") return [];
  const warehouses = new Map<number, BundleWarehouse>();
  if (bundle.bundleWarehouse) warehouses.set(bundle.bundleWarehouse.id, bundle.bundleWarehouse);
  // Retain visibility of stock outside the current fulfillment warehouse, too.
  for (const level of bundle.assembledStockLevels) warehouses.set(level.warehouseId, level.warehouse);
  return Array.from(warehouses.values())
    .filter((warehouse) => scope.mode === "all" || scope.warehouseIds.includes(warehouse.id))
    .map((warehouse): WarehouseBundleStockRow => {
      const isFulfillmentWarehouse = warehouse.id === bundle.bundleWarehouseId;
      const mode = bundle.bundleFulfillmentMode ?? "VIRTUAL";
      const level = bundle.assembledStockLevels.find((row) => row.warehouseId === warehouse.id);
      const quantity = mode === "PREASSEMBLED" || level ? level?.quantity ?? 0 : null;
      const reserved = quantity === null ? null : level?.reserved ?? 0;
      const available = quantity === null ? null : Math.max(0, quantity - (reserved ?? 0));
      let componentCapacity: number | null = null;
      let orderAvailability = 0;
      let configurationError: string | null = null;
      if (isFulfillmentWarehouse && !bundle.deleted) {
        try {
          const components = resolveBundleConfiguration({
            bundle: { ...bundle, bundleFulfillmentMode: "VIRTUAL", bundleStockLimit: null },
            strictWarehouseStock: true,
          });
          componentCapacity = components.availableQuantity;
          orderAvailability = bundle.available ? resolveBundleConfiguration({ bundle, strictWarehouseStock: true }).availableQuantity : 0;
        } catch (error) {
          configurationError = error instanceof Error ? error.message : "Invalid bundle configuration";
        }
      }
      return {
        key: `${bundle.id}:${warehouse.id}`, bundleId: bundle.id, name: bundle.name, sku: bundle.sku,
        mode, active: bundle.available && !bundle.deleted, archived: Boolean(bundle.deleted), warehouse, quantity, reserved, available, componentCapacity,
        saleLimit: isFulfillmentWarehouse ? bundle.bundleStockLimit : null,
        orderAvailability, canManage: isFulfillmentWarehouse && mode === "PREASSEMBLED",
        configurationError,
      };
    });
}

export function bundleMovementKind(reason: string | null): "finished" | "saleLimit" {
  return reason?.startsWith("PREASSEMBLED_BUNDLE_") ? "finished" : "saleLimit";
}
