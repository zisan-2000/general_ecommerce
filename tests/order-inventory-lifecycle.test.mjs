import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildOrderBundleInventoryRestockPlan,
  buildOrderPreassembledBundleRestockPlan,
  buildOrderInventoryRestockPlan,
  commitOrderInventoryReservations,
  releaseOrderInventoryReservations,
  restoreOrderInventory,
} from "../lib/inventory.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function createInventoryTransaction({
  levels,
  logs,
  reservations = [],
  bundleProducts = [],
}) {
  const state = {
    levels: levels.map((level, index) => ({ id: index + 1, reserved: 0, ...level })),
    logs: logs.map((log, index) => ({ id: index + 1, ...log })),
    reservations: reservations.map((reservation, index) => ({
      id: index + 1,
      ...reservation,
    })),
    bundleProducts: bundleProducts.map((product) => ({ ...product })),
    assembledLevels: [],
    bundleReservations: [],
    variantStock: new Map(),
  };
  const levelFor = (warehouseId, productVariantId) =>
    state.levels.find(
      (level) =>
        level.warehouseId === warehouseId &&
        level.productVariantId === productVariantId,
    );

  const tx = {
    inventoryReservation: {
      findMany: async ({ where }) =>
        state.reservations
          .filter((reservation) => reservation.orderId === where.orderId)
          .map((reservation) => ({
            ...reservation,
            stockLevel: {
              productVariantId: state.levels.find(
                (level) => level.id === reservation.stockLevelId,
              ).productVariantId,
            },
          })),
      delete: async ({ where }) => {
        state.reservations = state.reservations.filter(
          (reservation) => reservation.id !== where.id,
        );
      },
    },
    inventoryLog: {
      findMany: async ({ where }) =>
        state.logs
          .filter((movement) => movement.orderId === where.orderId)
          .map((movement) => ({
            ...movement,
            product:
              movement.product ??
              (state.bundleProducts.some(
                (product) => product.id === movement.productId,
              )
                ? { type: "BUNDLE" }
                : null),
          })),
      create: async ({ data }) => {
        const created = { id: state.logs.length + 1, ...data };
        state.logs.push(created);
        return created;
      },
    },
    stockLevel: {
      findMany: async ({ where }) =>
        state.levels.filter(
          (level) => level.productVariantId === where.productVariantId,
        ),
      updateMany: async ({ where, data }) => {
        const level = state.levels.find((candidate) => candidate.id === where.id);
        if (!level || level.reserved < where.reserved.gte) return { count: 0 };
        level.reserved -= data.reserved.decrement;
        return { count: 1 };
      },
      upsert: async ({ where, create, update }) => {
        const key = where.warehouseId_productVariantId;
        let level = levelFor(key.warehouseId, key.productVariantId);
        if (!level) {
          level = { id: state.levels.length + 1, ...create };
          state.levels.push(level);
        } else {
          level.quantity += update.quantity.increment;
        }
        return level;
      },
    },
    productVariant: {
      update: async ({ where, data }) => {
        state.variantStock.set(where.id, data.stock);
      },
      findUnique: async ({ where }) => {
        const matchingLevels = state.levels.filter(
          (level) => level.productVariantId === where.id,
        );
        if (!matchingLevels.length) return null;
        return {
          id: where.id,
          productId: matchingLevels[0].productId,
          stock: state.variantStock.get(where.id) ?? 0,
          lowStockThreshold: 1,
          stockLevels: matchingLevels,
        };
      },
    },
    inventoryDailySnapshot: { upsert: async () => null },
    inventoryWarehouseDailySnapshot: {
      deleteMany: async () => null,
      upsert: async () => null,
    },
    product: {
      updateMany: async ({ where, data }) => {
        const product = state.bundleProducts.find(
          (candidate) =>
            candidate.id === where.id &&
            candidate.type === where.type &&
            candidate.bundleWarehouseId === where.bundleWarehouseId &&
            candidate.bundleStockLimit !== null,
        );
        if (!product) return { count: 0 };
        product.bundleStockLimit += data.bundleStockLimit.increment;
        return { count: 1 };
      },
    },
    bundleStockLevel: {
      updateMany: async ({ where, data }) => {
        const level = state.assembledLevels.find((candidate) => candidate.id === where.id);
        if (!level || level.reserved < where.reserved.gte) return { count: 0 };
        if (data.reserved?.decrement) level.reserved -= data.reserved.decrement;
        if (data.quantity?.decrement) level.quantity -= data.quantity.decrement;
        return { count: 1 };
      },
      upsert: async ({ where, create, update }) => {
        const key = where.productId_warehouseId;
        let level = state.assembledLevels.find(
          (candidate) => candidate.productId === key.productId && candidate.warehouseId === key.warehouseId,
        );
        if (!level) {
          level = { ...create };
          state.assembledLevels.push(level);
        } else {
          level.quantity += update.quantity.increment;
        }
        return level;
      },
    },
    bundleStockReservation: {
      findMany: async ({ where }) => state.bundleReservations
        .filter((row) => row.orderId === where.orderId)
        .map((row) => ({
          ...row,
          bundleStockLevel: state.assembledLevels.find((level) => level.id === row.bundleStockLevelId),
        })),
      delete: async ({ where }) => {
        state.bundleReservations = state.bundleReservations.filter((row) => row.id !== where.id);
      },
      create: async ({ data }) => {
        const row = { id: state.bundleReservations.length + 1, ...data };
        state.bundleReservations.push(row);
        return row;
      },
    },
  };

  return { state, tx };
}

test("restock plan returns the exact outstanding quantity per warehouse", () => {
  const plan = buildOrderInventoryRestockPlan([
    { productId: 10, variantId: 100, warehouseId: 1, change: -2 },
    { productId: 10, variantId: 100, warehouseId: 1, change: -1 },
    { productId: 10, variantId: 100, warehouseId: 2, change: -4 },
    { productId: 10, variantId: 100, warehouseId: 2, change: 1 },
    { productId: 10, variantId: null, warehouseId: 2, change: -9 },
    { productId: 10, variantId: 100, warehouseId: null, change: -9 },
  ]);

  assert.deepEqual(plan, [
    { productId: 10, variantId: 100, warehouseId: 1, quantity: 3 },
    { productId: 10, variantId: 100, warehouseId: 2, quantity: 3 },
  ]);
});

test("restock plan is retry-safe and only repairs a partial restoration", () => {
  assert.deepEqual(
    buildOrderInventoryRestockPlan([
      { productId: 20, variantId: 200, warehouseId: 3, change: -5 },
      { productId: 20, variantId: 200, warehouseId: 3, change: 5 },
    ]),
    [],
  );

  assert.deepEqual(
    buildOrderInventoryRestockPlan([
      { productId: 20, variantId: 200, warehouseId: 3, change: -5 },
      { productId: 20, variantId: 200, warehouseId: 3, change: 2 },
    ]),
    [{ productId: 20, variantId: 200, warehouseId: 3, quantity: 3 }],
  );
});

test("preassembled SSLCommerz reservation releases without changing on-hand stock", async () => {
  const { state, tx } = createInventoryTransaction({ levels: [], logs: [] });
  state.assembledLevels.push({ id: 10, productId: 44, warehouseId: 2, quantity: 4, reserved: 2 });
  state.bundleReservations.push({ id: 1, orderId: 54, bundleStockLevelId: 10, quantity: 2 });

  const released = await releaseOrderInventoryReservations({ tx, orderId: 54 });

  assert.deepEqual(released, { reservationCount: 1, releasedQuantity: 2 });
  assert.equal(state.assembledLevels[0].quantity, 4);
  assert.equal(state.assembledLevels[0].reserved, 0);
  assert.equal(state.bundleReservations.length, 0);
});

test("preassembled SSLCommerz capture commits reserved stock and logs its deduction", async () => {
  const { state, tx } = createInventoryTransaction({ levels: [], logs: [] });
  state.assembledLevels.push({ id: 10, productId: 44, warehouseId: 2, quantity: 4, reserved: 2 });
  state.bundleReservations.push({ id: 1, orderId: 55, bundleStockLevelId: 10, quantity: 2 });

  const committed = await commitOrderInventoryReservations({
    tx,
    orderId: 55,
    reason: "SSLCommerz capture",
  });

  assert.deepEqual(committed, { reservationCount: 1, committedQuantity: 0, committedBundleQuantity: 2 });
  assert.equal(state.assembledLevels[0].quantity, 2);
  assert.equal(state.assembledLevels[0].reserved, 0);
  assert.equal(state.bundleReservations.length, 0);
  assert.equal(state.logs[0].change, -2);
  assert.match(state.logs[0].reason, /PREASSEMBLED_BUNDLE_STOCK/);
});

test("preassembled bundle cancellation restores finished stock exactly once", async () => {
  const { state, tx } = createInventoryTransaction({
    levels: [],
    bundleProducts: [{ id: 44, type: "BUNDLE", bundleWarehouseId: 2, bundleStockLimit: null }],
    logs: [
      {
        orderId: 52,
        productId: 44,
        variantId: null,
        warehouseId: 2,
        change: -2,
        reason: "PREASSEMBLED_BUNDLE_STOCK: checkout",
      },
    ],
  });
  state.assembledLevels.push({ productId: 44, warehouseId: 2, quantity: 0, reserved: 0 });

  const first = await restoreOrderInventory({ tx, orderId: 52, reason: "Cancelled" });
  const second = await restoreOrderInventory({ tx, orderId: 52, reason: "Cancelled retry" });

  assert.equal(first.restoredPreassembledBundleQuantity, 2);
  assert.equal(second.restoredPreassembledBundleQuantity, 0);
  assert.equal(state.assembledLevels[0].quantity, 2);
});

test("bundle sale-cap restocks net against the original warehouse movement", () => {
  assert.deepEqual(
    buildOrderBundleInventoryRestockPlan([
      { productId: 44, variantId: null, warehouseId: 2, change: -3, productType: "BUNDLE" },
      { productId: 44, variantId: null, warehouseId: 2, change: 1, productType: "BUNDLE" },
      { productId: 10, variantId: null, warehouseId: 2, change: -8, productType: "PHYSICAL" },
      { productId: 44, variantId: 1, warehouseId: 2, change: -4, productType: "BUNDLE" },
    ]),
    [{ productId: 44, warehouseId: 2, quantity: 2 }],
  );
});

test("preassembled bundle movements have an independent retry-safe restock plan", () => {
  assert.deepEqual(buildOrderPreassembledBundleRestockPlan([
    { productId: 44, variantId: null, warehouseId: 2, change: -3, productType: "BUNDLE", reason: "PREASSEMBLED_BUNDLE_STOCK: checkout" },
    { productId: 44, variantId: null, warehouseId: 2, change: 1, productType: "BUNDLE", reason: "PREASSEMBLED_BUNDLE_STOCK: partial restore" },
    { productId: 44, variantId: null, warehouseId: 2, change: -7, productType: "BUNDLE", reason: "bundle sale cap" },
  ]), [{ productId: 44, warehouseId: 2, quantity: 2 }]);
});

test("restoration returns deducted stock to its source warehouses exactly once", async () => {
  const { state, tx } = createInventoryTransaction({
    levels: [
      { warehouseId: 1, productId: 10, productVariantId: 100, quantity: 7 },
      { warehouseId: 2, productId: 10, productVariantId: 100, quantity: 2 },
    ],
    logs: [
      { orderId: 50, productId: 10, variantId: 100, warehouseId: 1, change: -3 },
      { orderId: 50, productId: 10, variantId: 100, warehouseId: 2, change: -4 },
      { orderId: 50, productId: 10, variantId: 100, warehouseId: 2, change: 1 },
    ],
  });

  const first = await restoreOrderInventory({
    tx,
    orderId: 50,
    reason: "Order #50 cancelled inventory restoration",
  });
  const second = await restoreOrderInventory({
    tx,
    orderId: 50,
    reason: "Order #50 cancelled inventory restoration retry",
  });

  assert.equal(first.restoredQuantity, 6);
  assert.equal(second.restoredQuantity, 0);
  assert.deepEqual(
    state.levels.map(({ warehouseId, quantity }) => ({ warehouseId, quantity })),
    [
      { warehouseId: 1, quantity: 10 },
      { warehouseId: 2, quantity: 5 },
    ],
  );
  assert.equal(state.variantStock.get(100), 15);
});

test("cleared bundle sale cap does not block component stock restoration", async () => {
  const { state, tx } = createInventoryTransaction({
    levels: [
      { warehouseId: 2, productId: 10, productVariantId: 100, quantity: 3 },
    ],
    logs: [
      {
        orderId: 70,
        productId: 10,
        variantId: 100,
        warehouseId: 2,
        change: -2,
      },
      {
        orderId: 70,
        productId: 44,
        variantId: null,
        warehouseId: 2,
        change: -1,
      },
    ],
    bundleProducts: [
      {
        id: 44,
        type: "BUNDLE",
        bundleWarehouseId: 2,
        bundleStockLimit: null,
      },
    ],
  });

  const result = await restoreOrderInventory({
    tx,
    orderId: 70,
    reason: "Order #70 cancelled inventory restoration",
  });

  assert.equal(result.restoredQuantity, 2);
  assert.equal(result.restoredBundleQuantity, 0);
  assert.equal(state.levels[0].quantity, 5);
  assert.equal(state.bundleProducts[0].bundleStockLimit, null);
  assert.equal(state.logs.length, 3);
});

test("configured bundle sale cap is restored with its original warehouse", async () => {
  const { state, tx } = createInventoryTransaction({
    levels: [],
    logs: [
      {
        orderId: 71,
        productId: 44,
        variantId: null,
        warehouseId: 2,
        change: -1,
      },
    ],
    bundleProducts: [
      {
        id: 44,
        type: "BUNDLE",
        bundleWarehouseId: 2,
        bundleStockLimit: 4,
      },
    ],
  });

  const result = await restoreOrderInventory({
    tx,
    orderId: 71,
    reason: "Order #71 cancelled inventory restoration",
  });

  assert.equal(result.restoredBundleQuantity, 1);
  assert.equal(state.bundleProducts[0].bundleStockLimit, 5);
});

test("reservation-only cancellation releases stock without increasing on-hand quantity", async () => {
  const { state, tx } = createInventoryTransaction({
    levels: [
      {
        warehouseId: 1,
        productId: 10,
        productVariantId: 100,
        quantity: 10,
        reserved: 4,
      },
    ],
    logs: [],
    reservations: [{ orderId: 60, stockLevelId: 1, quantity: 4 }],
  });

  const result = await restoreOrderInventory({
    tx,
    orderId: 60,
    reason: "Order #60 failed inventory restoration",
  });

  assert.equal(result.releasedReservationQuantity, 4);
  assert.equal(result.restoredQuantity, 0);
  assert.equal(state.levels[0].quantity, 10);
  assert.equal(state.levels[0].reserved, 0);
  assert.equal(state.variantStock.get(100), 10);
});

test("all order terminal-status entry points use the atomic inventory lifecycle", async () => {
  const [
    schema,
    inventory,
    lifecycle,
    checkout,
    orderRoute,
    shipmentRoute,
    deliveryAssignments,
    sslcommerz,
  ] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../lib/inventory.ts"),
    read("../lib/order-inventory-lifecycle.ts"),
    read("../app/api/orders/route-core.ts"),
    read("../app/api/orders/[id]/route.ts"),
    read("../app/api/shipments/[id]/route.ts"),
    read("../lib/delivery-assignments.ts"),
    read("../lib/sslcommerz.ts"),
  ]);

  assert.match(schema, /model InventoryLog \{[\s\S]*orderId\s+Int\?[\s\S]*order\s+Order\?/);
  assert.match(schema, /@@index\(\[orderId, variantId, warehouseId\]\)/);
  assert.match(inventory, /buildOrderInventoryRestockPlan/);
  assert.match(inventory, /where: \{ orderId \}/);
  assert.match(inventory, /quantity: \{ increment: allocation\.quantity \}/);
  assert.match(
    checkout,
    /deductVariantInventory\(\{\s*tx,\s*orderId:\s*o\.id,/,
  );
  assert.match(lifecycle, /FOR UPDATE/);
  assert.match(lifecycle, /OrderStatus\.CANCELLED/);
  assert.match(lifecycle, /OrderStatus\.FAILED/);
  assert.match(lifecycle, /OrderStatus\.RETURNED/);

  for (const source of [orderRoute, shipmentRoute, deliveryAssignments, sslcommerz]) {
    assert.match(source, /transitionOrderStatusWithInventory\(\{/);
  }
  assert.doesNotMatch(orderRoute, /soldCount:\s*Math\.max/);
  assert.doesNotMatch(shipmentRoute, /soldCount:\s*Math\.max/);
});
