import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildWarehouseBundleRows, bundleMovementKind, warehouseBundleWhere } from "../lib/warehouse-bundle-stock.ts";
import { resolveWarehouseScope } from "../lib/warehouse-scope.ts";

const all = { mode: "all", warehouseIds: [] };
const assigned = { mode: "assigned", warehouseIds: [1] };
const none = { mode: "none", warehouseIds: [] };
const warehouses = [{ id: 1, name: "Warehouse A", code: "A" }, { id: 2, name: "Warehouse B", code: "B" }];

function fixture(mode = "PREASSEMBLED") {
  const products = [10, 20].map((id, index) => {
    const variant = { id: id + 1, productId: id, sku: `COMPONENT-${id}`, price: 100,
      currency: "BDT", options: {}, stock: 1000, active: true, isDefault: true,
      stockLevels: [{ warehouseId: 1, quantity: index ? 4 : 10, reserved: 0 },
        { warehouseId: 2, quantity: 100, reserved: 0 }] };
    const product = { id, name: index ? "Mug" : "Shirt", type: "PHYSICAL", available: true,
      deleted: false, basePrice: 100, variants: [variant] };
    const quantity = index ? 1 : 2;
    return { id, name: product.name, selectionType: "FIXED", pricingMode: "AUTOMATIC", required: true,
      minSelect: 1, maxSelect: 1, defaultQuantity: quantity, minQuantity: quantity, maxQuantity: quantity,
      allowQuantityChange: false, sortOrder: index,
      options: [{ id, productId: id, variantId: variant.id, isDefault: true, priceAdjustment: 0,
        sortOrder: index, product, variant }] };
  });
  return { id: 50, name: "Shirt and mug bundle", sku: "BUNDLE-50", basePrice: 250,
    currency: "BDT", available: true, bundleStockLimit: null, bundleWarehouseId: 1,
    bundleWarehouse: warehouses[0], bundleFulfillmentMode: mode, bundleGroups: products,
    assembledStockLevels: mode === "VIRTUAL" ? [] : [{ warehouseId: 1, quantity: 3, reserved: 1, warehouse: warehouses[0] }] };
}

test("finished quantity, reserved, available and component capacity are separate", () => {
  const [row] = buildWarehouseBundleRows(fixture(), all);
  assert.deepEqual([row.quantity, row.reserved, row.available, row.componentCapacity, row.orderAvailability], [3, 1, 2, 4, 2]);
  assert.equal(row.canManage, true);
});

test("virtual bundles have no fictitious finished stock and use only the fulfillment warehouse", () => {
  const [row] = buildWarehouseBundleRows(fixture("VIRTUAL"), all);
  assert.deepEqual([row.quantity, row.reserved, row.available], [null, null, null]);
  assert.equal(row.componentCapacity, 4);
  assert.equal(row.orderAvailability, 4);
  assert.equal(row.canManage, false);
});

test("sale limit restricts sellability without changing physical balances, including zero and null", () => {
  for (const mode of ["PREASSEMBLED", "VIRTUAL"]) {
    const bundle = fixture(mode);
    for (const cap of [0, 1, 20, null]) {
      bundle.bundleStockLimit = cap;
      const [row] = buildWarehouseBundleRows(bundle, all);
      assert.equal(row.orderAvailability, Math.min(mode === "VIRTUAL" ? 4 : 2, cap ?? Infinity));
      assert.equal(row.quantity, mode === "VIRTUAL" ? null : 3);
      assert.equal(row.saleLimit, cap);
    }
  }
});

test("unassembled and inactive bundles remain visible without sellable stock", () => {
  const bundle = fixture();
  bundle.assembledStockLevels = [];
  assert.equal(buildWarehouseBundleRows(bundle, all)[0].quantity, 0);
  bundle.assembledStockLevels = fixture().assembledStockLevels;
  bundle.available = false;
  const [row] = buildWarehouseBundleRows(bundle, all);
  assert.equal(row.orderAvailability, 0);
  assert.equal(row.quantity, 3);
  assert.equal(row.canManage, true);
});

test("archived bundles retain physical visibility and stock-out but cannot be assembled or sold", () => {
  const bundle = fixture();
  bundle.deleted = true;
  const [row] = buildWarehouseBundleRows(bundle, all);
  assert.equal(row.archived, true);
  assert.equal(row.active, false);
  assert.equal(row.quantity, 3);
  assert.equal(row.reserved, 1);
  assert.equal(row.orderAvailability, 0);
  assert.equal(row.componentCapacity, null);
  assert.equal(row.canManage, true);
});

test("assigned staff never receive other warehouse rows and no-scope receives no stock", () => {
  const bundle = fixture();
  bundle.assembledStockLevels.push({ warehouseId: 2, quantity: 7, reserved: 2, warehouse: warehouses[1] });
  assert.deepEqual(buildWarehouseBundleRows(bundle, assigned).map((row) => row.warehouse.id), [1]);
  assert.deepEqual(buildWarehouseBundleRows(bundle, none), []);
  const other = buildWarehouseBundleRows(bundle, { mode: "assigned", warehouseIds: [2] });
  assert.deepEqual([other[0].quantity, other[0].reserved, other[0].available], [7, 2, 5]);
  assert.equal(other[0].canManage, false);
  assert.equal(other[0].orderAvailability, 0);
  assert.equal(other[0].componentCapacity, null);
});

test("out-of-scope warehouse queries cannot silently become all-warehouse queries", () => {
  const access = { isSuperAdmin: false, hasGlobal: () => false, warehouseIds: [1], can: (_permission, id) => id === 1 };
  assert.deepEqual(resolveWarehouseScope(access, "inventory.manage", 2), none);
  assert.deepEqual(warehouseBundleWhere(none), { id: { in: [] } });
  assert.deepEqual(warehouseBundleWhere(assigned), { OR: [
    { bundleWarehouseId: { in: [1] } }, { assembledStockLevels: { some: { warehouseId: { in: [1] } } } },
  ] });
});

test("invalid configuration shows a warning while preserving finished-stock visibility and stock-out", () => {
  const bundle = fixture();
  bundle.bundleGroups[0].options[0].product.available = false;
  const [row] = buildWarehouseBundleRows(bundle, all);
  assert.equal(row.quantity, 3);
  assert.equal(row.orderAvailability, 0);
  assert.ok(row.configurationError);
  assert.equal(row.componentCapacity, null);
  assert.equal(row.canManage, true);
});

test("finished stock movements are not mixed with optional sale-limit movements", () => {
  for (const reason of ["PREASSEMBLED_BUNDLE_ASSEMBLY: ref", "PREASSEMBLED_BUNDLE_STOCK: sale", "PREASSEMBLED_BUNDLE_ADJUSTMENT_OUT: damaged"]) {
    assert.equal(bundleMovementKind(reason), "finished");
  }
  assert.equal(bundleMovementKind("Bundle sale limit updated"), "saleLimit");
  assert.equal(bundleMovementKind(null), "saleLimit");
});

test("warehouse panel uses guarded assembly and stock-out APIs, not direct quantity overwrites", async () => {
  const panel = await readFile(new URL("../components/admin/warehouse/BundleStockManagement.tsx", import.meta.url), "utf8");
  assert.match(panel, /\/api\/admin\/warehouse\/bundle-stock/);
  assert.match(panel, /warehouseId: row.warehouse.id/);
  assert.doesNotMatch(panel, /fetch\(["'`]\/api\/stock-levels/);
  for (const path of ["assembly", "adjustment"]) {
    const source = await readFile(new URL(`../app/api/admin/products/bundles/[id]/${path}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /expectedWarehouseId !== bundle.bundleWarehouseId/);
    assert.match(source, /access.can\("inventory.manage", bundle.bundleWarehouseId\)/);
  }
});

test("all supported locales include every warehouse bundle label", async () => {
  const english = JSON.parse(await readFile(new URL("../messages/en.json", import.meta.url), "utf8")).AdminWarehouseBundleStock;
  for (const locale of ["bn", "ar", "zh", "ne", "id"]) {
    const messages = JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    assert.deepEqual(Object.keys(messages.AdminWarehouseBundleStock).sort(), Object.keys(english).sort());
  }
});
