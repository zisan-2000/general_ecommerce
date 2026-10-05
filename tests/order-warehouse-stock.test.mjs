import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOrderWarehouseStockAvailability,
  canWarehouseFulfillOrder,
  getOrderWarehouseStockAvailability,
} from "../lib/order-warehouse-stock.ts";

function demand(entries, hasUntrackedUnits = false) {
  return {
    requiredUnits: entries.reduce((total, [, quantity]) => total + quantity, 0),
    hasUntrackedUnits,
    byVariant: new Map(entries),
  };
}

test("warehouse fulfilment checks every required variant, not only total units", () => {
  const availability = buildOrderWarehouseStockAvailability({
    warehouseIds: [1, 2],
    demand: demand([
      [101, 2],
      [202, 1],
    ]),
    stockLevels: [
      { warehouseId: 1, variantId: 101, quantity: 3, reserved: 0 },
      { warehouseId: 1, variantId: 202, quantity: 0, reserved: 0 },
      { warehouseId: 2, variantId: 101, quantity: 2, reserved: 0 },
      { warehouseId: 2, variantId: 202, quantity: 1, reserved: 0 },
    ],
    reservations: [],
    movements: [],
  });

  assert.deepEqual(availability, {
    requiresStock: true,
    requiredUnits: 3,
    warehouses: [
      { warehouseId: 1, requiredUnits: 3, availableUnits: 3, canFulfill: false },
      { warehouseId: 2, requiredUnits: 3, availableUnits: 3, canFulfill: true },
    ],
  });
});

test("an order's reservation remains available to that order only", () => {
  const availability = buildOrderWarehouseStockAvailability({
    warehouseIds: [1],
    demand: demand([[101, 3]]),
    stockLevels: [
      { warehouseId: 1, variantId: 101, quantity: 5, reserved: 5 },
    ],
    reservations: [{ warehouseId: 1, variantId: 101, quantity: 3 }],
    movements: [],
  });

  assert.deepEqual(availability.warehouses[0], {
    warehouseId: 1,
    requiredUnits: 3,
    availableUnits: 3,
    canFulfill: true,
  });
});

test("committed checkout deductions are not demanded a second time", () => {
  const availability = buildOrderWarehouseStockAvailability({
    warehouseIds: [1],
    demand: demand([[101, 4]]),
    stockLevels: [
      { warehouseId: 1, variantId: 101, quantity: 1, reserved: 0 },
    ],
    reservations: [],
    movements: [
      { warehouseId: 1, variantId: 101, change: -4 },
      { warehouseId: 1, variantId: 101, change: 1 },
    ],
  });

  assert.deepEqual(availability.warehouses[0], {
    warehouseId: 1,
    requiredUnits: 4,
    availableUnits: 4,
    canFulfill: true,
  });
});

test("digital-only orders do not require warehouse stock", () => {
  const availability = buildOrderWarehouseStockAvailability({
    warehouseIds: [1],
    demand: demand([]),
    stockLevels: [],
    reservations: [],
    movements: [],
  });

  assert.deepEqual(availability, {
    requiresStock: false,
    requiredUnits: 0,
    warehouses: [
      { warehouseId: 1, requiredUnits: 0, availableUnits: 0, canFulfill: true },
    ],
  });
});

function createClient() {
  return {
    orderItem: {
      findMany: async () => [{ variantId: 101, quantity: 2 }],
    },
    warehouse: {
      findMany: async () => [{ id: 1 }, { id: 2 }],
    },
    stockLevel: {
      findMany: async () => [
        { warehouseId: 1, productVariantId: 101, quantity: 2, reserved: 0 },
        { warehouseId: 2, productVariantId: 101, quantity: 1, reserved: 0 },
      ],
    },
    inventoryReservation: { findMany: async () => [] },
    inventoryLog: { findMany: async () => [] },
  };
}

test("database-backed availability and boolean guard share the same rules", async () => {
  const client = createClient();
  const availability = await getOrderWarehouseStockAvailability(client, 50);

  assert.equal(availability.warehouses[0].canFulfill, true);
  assert.equal(availability.warehouses[1].canFulfill, false);
  assert.equal(await canWarehouseFulfillOrder(client, 50, 1), true);
  assert.equal(await canWarehouseFulfillOrder(client, 50, 2), false);
  assert.equal(await canWarehouseFulfillOrder(client, 50, 999), false);
});

test("preassembled shipments use finished-stock allocations and the saved warehouse", () => {
  const availability = buildOrderWarehouseStockAvailability({
    warehouseIds: [1, 2], fulfillmentWarehouseId: 1,
    demand: { requiredUnits: 2, hasUntrackedUnits: false, byVariant: new Map(), byBundle: new Map([[44, 2]]) },
    stockLevels: [], reservations: [], movements: [],
    bundleStockLevels: [{ warehouseId: 1, productId: 44, quantity: 0, reserved: 0 }, { warehouseId: 2, productId: 44, quantity: 100, reserved: 0 }],
    bundleMovements: [{ warehouseId: 1, productId: 44, change: -2 }],
  });
  assert.equal(availability.requiredUnits, 2);
  assert.equal(availability.warehouses[0].canFulfill, true);
  assert.equal(availability.warehouses[1].canFulfill, false);
});

test("preassembled reservations belong only to their order", () => {
  const params = {
    warehouseIds: [1],
    demand: { requiredUnits: 2, hasUntrackedUnits: false, byVariant: new Map(), byBundle: new Map([[44, 2]]) },
    stockLevels: [], reservations: [], movements: [],
    bundleStockLevels: [{ warehouseId: 1, productId: 44, quantity: 3, reserved: 3 }],
  };
  assert.equal(buildOrderWarehouseStockAvailability(params).warehouses[0].canFulfill, false);
  assert.equal(buildOrderWarehouseStockAvailability({ ...params, bundleReservations: [{ warehouseId: 1, productId: 44, quantity: 2 }] }).warehouses[0].canFulfill, true);
});

test("historical assembled-stock logs keep shipment checks correct after a product mode edit", async () => {
  const client = createClient();
  client.order = { findUnique: async () => ({ fulfillmentWarehouseId: 1 }) };
  client.orderItem.findMany = async () => [{ productId: 44, quantity: 2, variantId: null, bundleConfiguration: {}, product: { type: "BUNDLE", bundleFulfillmentMode: "VIRTUAL" } }];
  client.orderBundleComponent = { findMany: async () => [{ variantId: 101, quantityPerBundle: 2, orderItem: { productId: 44, quantity: 2 }, product: { type: "PHYSICAL" } }] };
  client.inventoryLog.findMany = async () => [{ productId: 44, warehouseId: 1, variantId: null, change: -2, reason: "PREASSEMBLED_BUNDLE_STOCK: checkout" }];
  client.bundleStockLevel = { findMany: async () => [{ productId: 44, warehouseId: 1, quantity: 0, reserved: 0 }] };
  const availability = await getOrderWarehouseStockAvailability(client, 50);
  assert.equal(availability.requiredUnits, 2);
  assert.equal(availability.warehouses[0].canFulfill, true);
  assert.equal(availability.warehouses[1].canFulfill, false);
});
