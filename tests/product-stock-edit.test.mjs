// Offline regressions for the actual handler and client data derivation.
// Source is evaluated with in-memory dependencies only: no env files, database or HTTP.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const readSource = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const forbidden = () => { throw new Error("Offline stock test blocked an external dependency"); };
function loadSource(path, imports = {}, globals = {}) {
  const loadedModule = { exports: {} };
  const context = vm.createContext({
    module: loadedModule, exports: loadedModule.exports, Error,
    require: (name) => Object.hasOwn(imports, name) ? imports[name] : forbidden(),
    fetch: forbidden,
    ...globals,
  }, { codeGeneration: { strings: false, wasm: false } });
  new vm.Script(compile(readSource(path)), { filename: path }).runInContext(context);
  return loadedModule.exports;
}

const variants = loadSource("lib/product-variants.ts");
const stockStatus = loadSource("lib/stock-status.ts");
const warehouseStock = loadSource("lib/warehouse-stock.ts");
const clientData = loadSource("lib/storefront-client-data.ts", {
  "@/lib/warehouse-stock": warehouseStock,
});
const inventory = loadSource("lib/inventory.ts", {
  "@/generated/prisma": { Prisma: {} },
  "@/lib/report-history": { captureVariantInventoryDailySnapshots: async () => {} },
});
const routeSource = readSource("app/api/products/[id]/route-core.ts");
const putSource = routeSource.slice(
  routeSource.indexOf("export async function PUT("),
  routeSource.indexOf("export async function PATCH("),
);
const reminderSource = routeSource.slice(
  routeSource.indexOf("function normalizeCartReminderMinutes("),
  routeSource.indexOf("/* =========================", routeSource.indexOf("function normalizeCartReminderMinutes(")),
);

function createEditor({
  existingVariant = null,
  quantity = 0,
  reserved = 0,
  warehouse = true,
  levels = null,
} = {}) {
  const initialLevels = levels ?? (existingVariant
    ? [{ id: 1, warehouseId: 7, productVariantId: 902, quantity, reserved }]
    : []);
  let state = {
    product: { id: 901, name: "Offline product", slug: "offline-product", type: "PHYSICAL",
      sku: "OFFLINE-SKU", basePrice: 100, currency: "BDT", available: true,
      categoryId: 1, attributes: [], variantOptions: [], lowStockThreshold: 10,
      cartReminderMinutes: null },
    variants: existingVariant ? [{ id: 902, productId: 901, sku: "OFFLINE-SKU", price: 100,
      currency: "BDT", stock: Math.max(0, quantity - reserved), options: {}, active: true,
      isDefault: true, ...existingVariant }] : [],
    levels: structuredClone(initialLevels),
    logs: [],
  };
  const audit = { invalidations: 0, transactions: 0 };
  const snapshot = () => structuredClone({ ...state.product, variants: state.variants });
  const tx = {
    product: { update: async ({ data }) => Object.assign(state.product, data) },
    productVariant: {
      findUnique: async ({ where }) => state.variants.find((row) => row.id === where.id) ?? null,
      findMany: async () => state.variants.map((row) => ({ ...row,
        stockLevels: state.levels.filter((level) => level.productVariantId === row.id), orderItems: [] })),
      create: async ({ data }) => { const row = { id: 902, ...data }; state.variants.push(row); return row; },
      update: async ({ where, data }) => Object.assign(state.variants.find((row) => row.id === where.id), data),
      updateMany: async ({ where, data }) => {
        for (const row of state.variants) if (row.id !== where.NOT.id) Object.assign(row, data);
      },
    },
    productVariantOptionValue: { deleteMany: async () => {} },
    productVariantOption: { deleteMany: async () => {} },
    warehouse: { findFirst: async () => warehouse ? { id: 7 } : null },
    stockLevel: {
      findUnique: async () => state.levels[0] ?? null,
      findMany: async ({ where }) => state.levels.filter((row) => row.productVariantId === where.productVariantId),
      create: async ({ data }) => {
        const row = { id: state.levels.length + 1, ...data };
        state.levels.push(row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const row = state.levels.find((item) => item.id === where.id);
        if (!row || row.quantity !== where.quantity || row.reserved !== where.reserved) {
          return { count: 0 };
        }
        Object.assign(row, data);
        return { count: 1 };
      },
      upsert: async ({ create, update }) => {
        if (state.levels.length) Object.assign(state.levels[0], update);
        else state.levels.push({ ...create });
      },
    },
    inventoryLog: { create: async ({ data }) => state.logs.push(data) },
    $executeRaw: async () => 1,
  };
  const prisma = {
    product: { findFirst: async () => snapshot() },
    $transaction: async (work) => {
      audit.transactions++;
      const before = structuredClone(state);
      try { return await work(tx); }
      catch (error) { state = before; throw error; }
    },
  };
  const context = vm.createContext({
    Error, console: { error: () => {} }, fetch: forbidden, prisma, authOptions: {}, productInclude: {},
    getServerSession: async () => ({ user: { id: "offline-admin" } }),
    getAccessContext: async () => ({ userId: "offline-admin", has: (key) => key === "products.manage" }),
    NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) },
    ...variants, ...stockStatus,
    AvailableStockEditConflictError: inventory.AvailableStockEditConflictError,
    setVariantAvailableStock: inventory.setVariantAvailableStock,
    syncVariantWarehouseStock: inventory.syncVariantWarehouseStock,
    gateProductType: async () => null,
    isCategoryEffectivelyActive: async () => true,
    validateCategoryProductAttributes: async () => ({ ok: true, value: [] }),
    ensureVariantCodes: async () => {},
    getVariantColorImageMap: async () => new Map(),
    attachVariantColorImages: (product) => product,
    toProductLogSnapshot: () => ({}), logActivity: async () => {},
    revalidateStorefrontCatalog: () => { audit.invalidations++; },
    evaluatePriceDropAlertsForProduct: async () => {},
  }, { codeGeneration: { strings: false, wasm: false } });
  new vm.Script(compile(reminderSource + putSource.replace("export async", "async"))).runInContext(context);
  return {
    edit: (body) => context.PUT({ json: async () => body }, { params: Promise.resolve({ id: "901" }) }),
    state: () => state, audit,
  };
}

test("stock edit creates a missing default variant and warehouse stock atomically", async () => {
  const editor = createEditor();
  const response = await editor.edit({ stock: 15, variantOptions: [] });
  assert.equal(response.status, 200);
  const state = editor.state();
  assert.equal(state.variants.length, 1);
  assert.equal(state.variants[0].isDefault, true);
  assert.equal(state.variants[0].active, true);
  assert.equal(state.variants[0].stock, 15);
  assert.equal(state.levels[0].quantity, 15);
  assert.equal(state.levels[0].reserved, 0);
  assert.equal(warehouseStock.computeVariantAvailableStock({ ...state.variants[0], stockLevels: state.levels }), 15);
  assert.equal(response.body.variants[0].stock, 15);
  assert.equal(state.logs.length, 1);
  assert.equal(editor.audit.invalidations, 1);
});

test("zero stock creates an unavailable simple variant instead of fake availability", async () => {
  const editor = createEditor();
  assert.equal((await editor.edit({ stock: 0 })).status, 200);
  assert.equal(editor.state().variants[0].stock, 0);
  assert.equal(editor.state().levels[0].quantity, 0);
});

test("price-only edit does not create inventory or discard existing stock", async () => {
  const empty = createEditor();
  assert.equal((await empty.edit({ basePrice: 125 })).status, 200);
  assert.equal(empty.state().variants.length, 0);
  const stocked = createEditor({ existingVariant: {}, quantity: 9, reserved: 2 });
  assert.equal((await stocked.edit({ basePrice: 125 })).status, 200);
  assert.equal(stocked.state().variants[0].stock, 7);
  assert.equal(stocked.state().levels[0].quantity, 9);
});

test("name-only edit with legacy unchanged stock creates no inventory movement", async () => {
  const editor = createEditor({ existingVariant: {}, quantity: 10, reserved: 3 });
  const response = await editor.edit({ name: "Renamed product", stock: 7 });
  assert.equal(response.status, 200);
  assert.equal(editor.state().product.name, "Renamed product");
  assert.equal(editor.state().levels[0].quantity, 10);
  assert.equal(editor.state().levels[0].reserved, 3);
  assert.equal(editor.state().variants[0].stock, 7);
  assert.equal(editor.state().logs.length, 0);
});

test("existing simple product can change available stock from 5 to 20", async () => {
  const editor = createEditor({ existingVariant: {}, quantity: 5, reserved: 0 });
  const response = await editor.edit({ stock: 20, expectedAvailableStock: 5 });
  assert.equal(response.status, 200);
  assert.equal(editor.state().levels[0].quantity, 20);
  assert.equal(editor.state().variants[0].stock, 20);
  assert.equal(editor.state().logs.length, 1);
  assert.equal(editor.state().logs[0].change, 15);
});

test("repeated saves with unchanged available stock do not reduce on-hand stock", async () => {
  const editor = createEditor({ existingVariant: {}, quantity: 10, reserved: 3 });
  assert.equal((await editor.edit({ stock: 7 })).status, 200);
  assert.equal((await editor.edit({ stock: 7 })).status, 200);
  assert.equal(editor.state().levels[0].quantity, 10);
  assert.equal(editor.state().levels[0].reserved, 3);
  assert.equal(editor.state().logs.length, 0);
});

test("explicit available-stock edit preserves reservations and derives on-hand quantity", async () => {
  const editor = createEditor({ existingVariant: {}, quantity: 4, reserved: 3 });
  assert.equal((await editor.edit({ stock: 10, expectedAvailableStock: 1 })).status, 200);
  assert.equal(editor.state().variants.length, 1);
  assert.equal(editor.state().levels[0].reserved, 3);
  assert.equal(editor.state().levels[0].quantity, 13);
  assert.equal(editor.state().variants[0].stock, 10);
});

test("invalid stock is rejected before any transaction", async () => {
  const editor = createEditor();
  assert.equal((await editor.edit({ stock: -1 })).status, 400);
  assert.equal(editor.audit.transactions, 0);
  assert.equal(editor.state().variants.length, 0);
});

test("multi-warehouse aggregate stock cannot be assigned to one warehouse", async () => {
  const levels = [
    { id: 1, warehouseId: 7, productVariantId: 902, quantity: 5, reserved: 2 },
    { id: 2, warehouseId: 8, productVariantId: 902, quantity: 7, reserved: 0 },
  ];
  const editor = createEditor({ existingVariant: { stock: 10 }, levels });
  const response = await editor.edit({ stock: 17, expectedAvailableStock: 10 });
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "MULTI_WAREHOUSE_STOCK_EDIT_REQUIRED");
  assert.deepEqual(editor.state().levels, levels);
  assert.equal(editor.state().logs.length, 0);
  assert.equal(editor.audit.invalidations, 0);
});

test("unchanged multi-warehouse aggregate is a no-op", async () => {
  const levels = [
    { id: 1, warehouseId: 7, productVariantId: 902, quantity: 5, reserved: 2 },
    { id: 2, warehouseId: 8, productVariantId: 902, quantity: 7, reserved: 0 },
  ];
  const editor = createEditor({ existingVariant: { stock: 10 }, levels });
  assert.equal((await editor.edit({ stock: 10 })).status, 200);
  assert.deepEqual(editor.state().levels, levels);
  assert.equal(editor.state().logs.length, 0);
});

test("stale expected stock rejects the whole product update atomically", async () => {
  const editor = createEditor({ existingVariant: {}, quantity: 10, reserved: 3 });
  const response = await editor.edit({
    name: "Must roll back",
    stock: 20,
    expectedAvailableStock: 6,
  });
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "AVAILABLE_STOCK_CHANGED");
  assert.equal(editor.state().product.name, "Offline product");
  assert.equal(editor.state().levels[0].quantity, 10);
  assert.equal(editor.audit.invalidations, 0);
});

test("missing warehouse rolls back the new variant and leaves caches untouched", async () => {
  const editor = createEditor({ warehouse: false });
  assert.equal((await editor.edit({ stock: 5 })).status, 400);
  assert.equal(editor.state().variants.length, 0);
  assert.equal(editor.audit.invalidations, 0);
});

test("admin badge treats a physical product without variants as out of stock", () => {
  const source = readSource("components/management/ProductManager.tsx");
  const helpers = source.slice(source.indexOf("function calculateStock("), source.indexOf("export default function ProductManager("));
  const context = vm.createContext({ ...stockStatus, ...warehouseStock });
  new vm.Script(compile(helpers)).runInContext(context);
  assert.equal(context.getProductInventorySummary({ type: "PHYSICAL", variants: [] }).status, "OUT_OF_STOCK");
  assert.equal(context.getProductInventorySummary({ type: "PHYSICAL", variants: [{ stock: 20, active: true }] }).status, "IN_STOCK");
  const inactiveOnly = context.getProductInventorySummary({
    type: "PHYSICAL",
    variants: [{ stock: 20, active: false }],
  });
  assert.equal(inactiveOnly.totalStock, 20);
  assert.equal(inactiveOnly.sellableStock, 0);
  assert.equal(inactiveOnly.status, "OUT_OF_STOCK");
  const mixed = context.getProductInventorySummary({
    type: "PHYSICAL",
    variants: [
      { stock: 20, active: false },
      { stock: 4, active: true, lowStockThreshold: 2 },
    ],
  });
  assert.equal(mixed.totalStock, 24);
  assert.equal(mixed.sellableStock, 4);
  assert.equal(mixed.status, "IN_STOCK");
  assert.equal(context.getProductInventorySummary({ type: "SERVICE", variants: [] }).status, "IN_STOCK");
});

test("legacy stock 8 with no warehouse rows can be explicitly changed to 12", async () => {
  const editor = createEditor({ existingVariant: { stock: 8 }, levels: [] });
  const response = await editor.edit({ stock: 12, expectedAvailableStock: 8 });
  assert.equal(response.status, 200);
  assert.equal(editor.state().levels.length, 1);
  assert.equal(editor.state().levels[0].quantity, 12);
  assert.equal(editor.state().variants[0].stock, 12);
  assert.equal(editor.state().logs[0].change, 4);
});

test("legacy zero stock initializes one warehouse row only after an explicit edit", async () => {
  const editor = createEditor({ existingVariant: { stock: 0 }, levels: [] });
  assert.equal(
    (await editor.edit({ stock: 15, expectedAvailableStock: 0 })).status,
    200,
  );
  assert.equal(editor.state().levels.length, 1);
  assert.equal(editor.state().levels[0].quantity, 15);
  assert.equal(editor.state().logs[0].change, 15);
});

test("metadata-only legacy edit preserves fallback stock without creating inventory", async () => {
  const editor = createEditor({ existingVariant: { stock: 8 }, levels: [] });
  assert.equal((await editor.edit({ name: "Legacy renamed", stock: 8 })).status, 200);
  assert.equal(editor.state().variants[0].stock, 8);
  assert.equal(editor.state().levels.length, 0);
  assert.equal(editor.state().logs.length, 0);
});

test("repeated legacy stock save does not duplicate the initialized level", async () => {
  const editor = createEditor({ existingVariant: { stock: 8 }, levels: [] });
  assert.equal(
    (await editor.edit({ stock: 12, expectedAvailableStock: 8 })).status,
    200,
  );
  assert.equal(
    (await editor.edit({ stock: 12, expectedAvailableStock: 12 })).status,
    200,
  );
  assert.equal(editor.state().levels.length, 1);
  assert.equal(editor.state().logs.length, 1);
});

test("concurrent legacy initialization serializes and rejects the stale writer", async () => {
  const state = { stock: 8, levels: [], logs: [] };
  let transactionTail = Promise.resolve();
  const runTransaction = async (work) => {
    const previous = transactionTail;
    let release;
    transactionTail = new Promise((resolve) => { release = resolve; });
    await previous;
    const tx = {
      $executeRaw: async () => 1,
      productVariant: {
        findUnique: async () => ({ stock: state.stock }),
        update: async ({ data }) => { state.stock = data.stock; },
      },
      warehouse: { findFirst: async () => ({ id: 7 }) },
      stockLevel: {
        findMany: async () => state.levels,
        create: async ({ data }) => {
          if (state.levels.length) throw new Error("duplicate warehouse level");
          state.levels.push({ id: 1, ...data });
        },
      },
      inventoryLog: { create: async ({ data }) => state.logs.push(data) },
    };
    try { return await work(tx); }
    finally { release(); }
  };
  const edit = (availableQuantity) => runTransaction((tx) =>
    inventory.setVariantAvailableStock({
      tx, productId: 901, productVariantId: 902, availableQuantity,
      expectedAvailableQuantity: 8, reason: "offline concurrent edit",
    }));

  const results = await Promise.allSettled([edit(12), edit(13)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.code, "AVAILABLE_STOCK_CHANGED");
  assert.equal(state.levels.length, 1);
  assert.equal(state.stock, 12);
});

test("legacy stock initialization fails safely when no warehouse exists", async () => {
  const editor = createEditor({
    existingVariant: { stock: 8 },
    levels: [],
    warehouse: false,
  });
  assert.equal(
    (await editor.edit({ stock: 12, expectedAvailableStock: 8 })).status,
    400,
  );
  assert.equal(editor.state().levels.length, 0);
  assert.equal(editor.state().variants[0].stock, 8);
  assert.equal(editor.state().logs.length, 0);
});

function createDeletionTransaction({ quantity = 0, reserved = 0, reservations = 0 } = {}) {
  const state = {
    level: { id: 31, productVariantId: 902, quantity, reserved },
    variantStock: 99,
    snapshots: 0,
  };
  const tx = {
    stockLevel: {
      findUnique: async () => state.level
        ? { ...state.level, _count: { reservations } }
        : null,
      deleteMany: async ({ where }) => {
        if (!state.level || state.level.quantity !== where.quantity || state.level.reserved !== where.reserved) {
          return { count: 0 };
        }
        state.level = null;
        return { count: 1 };
      },
      findMany: async () => state.level ? [state.level] : [],
    },
    productVariant: {
      update: async ({ data }) => { state.variantStock = data.stock; },
    },
  };
  return { tx, state };
}

test("reserved stock-level deletion is rejected without mutation", async () => {
  const { tx, state } = createDeletionTransaction({ reserved: 1, reservations: 1 });
  await assert.rejects(
    inventory.deleteStockLevelIfEmpty(tx, 31),
    (error) => error.code === "STOCK_LEVEL_HAS_RESERVATIONS",
  );
  assert.equal(state.level.reserved, 1);
  assert.equal(state.variantStock, 99);
});

test("positive on-hand stock-level deletion is rejected without mutation", async () => {
  const { tx, state } = createDeletionTransaction({ quantity: 4 });
  await assert.rejects(
    inventory.deleteStockLevelIfEmpty(tx, 31),
    (error) => error.code === "STOCK_LEVEL_HAS_INVENTORY",
  );
  assert.equal(state.level.quantity, 4);
  assert.equal(state.variantStock, 99);
});

test("deleting a zero stock-level clears stale legacy fallback atomically", async () => {
  const { tx, state } = createDeletionTransaction();
  const deleted = await inventory.deleteStockLevelIfEmpty(tx, 31);
  assert.equal(deleted.id, 31);
  assert.equal(state.level, null);
  assert.equal(state.variantStock, 0);
});

function variantDeletionTx(overrides = {}, options = {}) {
  const calls = { stockLevels: 0, productCodes: 0, variants: 0 };
  const variant = {
    id: 902,
    stock: 0,
    stockLevels: [],
    _count: {
      orderItems: 0, orderBundleComponents: 0, inventoryLogs: 0,
      dailySnapshots: 0, warehouseDailySnapshots: 0, cartItems: 0,
      bundleGroupOptions: 0,
    },
    ...overrides,
  };
  return {
    calls,
    tx: {
      $executeRaw: async () => 1,
      productVariant: {
        findUnique: async () => variant,
        deleteMany: async () => {
          calls.variants++;
          return { count: options.variantDeleteCount ?? 1 };
        },
      },
      stockLevel: {
        deleteMany: async () => {
          calls.stockLevels++;
          return {
            count:
              options.stockLevelDeleteCount ?? variant.stockLevels.length,
          };
        },
      },
      productCode: { deleteMany: async () => { calls.productCodes++; } },
    },
  };
}

for (const [name, overrides, code] of [
  ["reservation", { stockLevels: [{ quantity: 0, reserved: 1, _count: { reservations: 1 } }] }, "VARIANT_HAS_RESERVATIONS"],
  ["positive inventory", { stockLevels: [{ quantity: 1, reserved: 0, _count: { reservations: 0 } }] }, "VARIANT_HAS_INVENTORY"],
  ["order history", { _count: { orderItems: 1, orderBundleComponents: 0, inventoryLogs: 0, dailySnapshots: 0, warehouseDailySnapshots: 0, cartItems: 0, bundleGroupOptions: 0 } }, "VARIANT_HAS_ORDER_HISTORY"],
  ["inventory history", { _count: { orderItems: 0, orderBundleComponents: 0, inventoryLogs: 1, dailySnapshots: 0, warehouseDailySnapshots: 0, cartItems: 0, bundleGroupOptions: 0 } }, "VARIANT_HAS_INVENTORY_HISTORY"],
]) {
  test(`variant with ${name} cannot be deleted`, async () => {
    const { tx, calls } = variantDeletionTx(overrides);
    await assert.rejects(
      inventory.deleteVariantIfSafe(tx, 902),
      (error) => error.code === code,
    );
    assert.deepEqual(calls, { stockLevels: 0, productCodes: 0, variants: 0 });
  });
}

test("unreferenced zero-stock variant deletion removes only disposable rows", async () => {
  const { tx, calls } = variantDeletionTx({
    stockLevels: [{ id: 31, quantity: 0, reserved: 0, _count: { reservations: 0 } }],
  });
  const deleted = await inventory.deleteVariantIfSafe(tx, 902);
  assert.equal(deleted.id, 902);
  assert.deepEqual(calls, { stockLevels: 1, productCodes: 1, variants: 1 });
});

test("legacy positive stock without StockLevels protects the variant from deletion", async () => {
  const { tx, calls } = variantDeletionTx({ stock: 8, stockLevels: [] });
  await assert.rejects(
    inventory.deleteVariantIfSafe(tx, 902),
    (error) => error.code === "VARIANT_HAS_INVENTORY",
  );
  assert.deepEqual(calls, { stockLevels: 0, productCodes: 0, variants: 0 });
});

test("concurrent stock-level change stops variant deletion before dependent rows", async () => {
  const { tx, calls } = variantDeletionTx(
    {
      stockLevels: [
        { id: 31, quantity: 0, reserved: 0, _count: { reservations: 0 } },
      ],
    },
    { stockLevelDeleteCount: 0 },
  );
  await assert.rejects(
    inventory.deleteVariantIfSafe(tx, 902),
    (error) => error.code === "VARIANT_INVENTORY_CHANGED",
  );
  assert.deepEqual(calls, { stockLevels: 1, productCodes: 0, variants: 0 });
});

test("dedicated stock and variant deletion routes reject unauthenticated callers", async () => {
  let transactions = 0;
  const response = { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) };
  const authImports = {
    "@/lib/prisma": { prisma: { $transaction: async () => { transactions++; } } },
    "@/lib/auth": { authOptions: {} },
    "@/lib/rbac": { getAccessContext: async () => ({ userId: null, has: () => false }) },
    "next-auth/next": { getServerSession: async () => null },
    "next/server": { NextResponse: response },
    "@/lib/inventory": inventory,
    "@/lib/storefront-catalog-cache": { revalidateStorefrontCatalog: () => {} },
    "@/lib/activity-log": { logActivity: async () => {} },
    "@/lib/stock-status": { normalizeLowStockThreshold: () => 10 },
    "@/lib/product-codes": { ensureVariantCodes: async () => {} },
    "@/generated/prisma": { Prisma: { sql: () => {}, join: () => {} } },
  };
  const stockRoute = loadSource("app/api/stock-levels/[id]/route.ts", authImports);
  const variantRoute = loadSource("app/api/product-variants/[id]/route.ts", authImports);
  assert.equal(
    (await stockRoute.DELETE({}, { params: Promise.resolve({ id: "31" }) })).status,
    401,
  );
  assert.equal(
    (await variantRoute.DELETE({}, { params: Promise.resolve({ id: "902" }) })).status,
    401,
  );
  assert.equal(transactions, 0);
});

test("storefront projections select active variants only", () => {
  for (const path of ["lib/storefront-product.ts", "lib/storefront-home.ts", "lib/storefront-catalog.ts"]) {
    const source = readSource(path);
    assert.match(source, /variants:\s*\{[\s\S]*?where:\s*\{\s*active:\s*true\s*\}/);
  }
});

test("warehouse levels override stale legacy variant stock", () => {
  assert.equal(
    warehouseStock.computeVariantAvailableStock({
      stock: 20,
      stockLevels: [{ quantity: 3, reserved: 3 }],
    }),
    0,
  );
  assert.equal(
    warehouseStock.computeVariantAvailableStock({
      stock: 0,
      stockLevels: [{ quantity: 15, reserved: 2 }],
    }),
    13,
  );
});

test("public product projection exposes available stock without private warehouse rows", () => {
  const storefrontProduct = loadSource("lib/storefront-product.ts", {
    "@/lib/configurable-bundle": {
      configurableBundleVariantOrderBy: [],
      configurableBundleVariantSelect: {},
      getDefaultBundleAvailableQuantity: () => 0,
    },
    "@/lib/warehouse-stock": warehouseStock,
  });
  const projected = storefrontProduct.serializeStorefrontProductInventory({
    id: 901,
    type: "PHYSICAL",
    variants: [
      {
        id: 902,
        stock: 0,
        active: true,
        stockLevels: [{ warehouseId: 7, quantity: 15, reserved: 2 }],
      },
    ],
    bundleItems: [
      {
        id: 51,
        quantity: 1,
        product: {
          id: 903,
          name: "Bundle component",
          variants: [
            {
              stock: 4,
              stockLevels: [
                { warehouseId: 7, quantity: 5, reserved: 1 },
              ],
            },
          ],
        },
      },
    ],
  });
  assert.equal(projected.variants[0].stock, 13);
  assert.equal("stockLevels" in projected.variants[0], false);
  assert.equal(projected.bundleItems[0].product.name, "Bundle component");
  assert.equal("variants" in projected.bundleItems[0].product, false);
});

test("storefront normalization excludes inactive variants and shares projected stock semantics", () => {
  const [product] = clientData.normalizeStorefrontProducts([{
    id: 901, name: "Stocked", slug: "stocked", image: null,
    basePrice: 100, originalPrice: null, currency: "BDT", available: true,
    variants: [
      { id: 1, active: false, stock: 99 },
      { id: 2, active: true, stock: 0, stockLevels: [{ quantity: 8, reserved: 3 }] },
    ],
  }]);
  assert.equal(product.variants.length, 1);
  assert.equal(product.stock, 5);
});

test("storefront availability keeps zero physical stock unavailable and non-inventory products sellable", () => {
  const [physical, digital, service] = clientData.normalizeStorefrontProducts([
    { id: 1, name: "Empty", slug: "empty", available: true, variants: [{ active: true, stock: 0 }] },
    { id: 2, name: "Download", slug: "download", available: true, type: "DIGITAL", variants: [] },
    { id: 3, name: "Consulting", slug: "consulting", available: true, type: "SERVICE", variants: [] },
  ]);
  assert.equal(physical.stock, 0);
  assert.equal(digital.stock, 1);
  assert.equal(service.stock, 1);
});

test("inventory-sensitive client fetches are not retained while metadata remains cacheable", async () => {
  let calls = 0;
  const clientCache = loadSource("lib/client-cache-fetch.ts", {}, {
    fetch: async () => {
      calls++;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ call: calls }),
      };
    },
  });
  const firstStock = await clientCache.cachedFetchJson("/stock", { freshness: "inventory" });
  const secondStock = await clientCache.cachedFetchJson("/stock", { freshness: "inventory" });
  assert.equal(firstStock.call, 1);
  assert.equal(secondStock.call, 2);

  const firstMetadata = await clientCache.cachedFetchJson("/categories", { ttlMs: 60_000 });
  const secondMetadata = await clientCache.cachedFetchJson("/categories", { ttlMs: 60_000 });
  assert.equal(firstMetadata.call, 3);
  assert.equal(secondMetadata.call, 3);
});

test("successful inventory edits invalidate all storefront stock views", () => {
  const source = readSource("lib/storefront-catalog-cache.ts");
  for (const tag of ["storefront-catalog", "storefront-home", "products"]) {
    assert.match(source, new RegExp(`revalidateTag\\(\"${tag}\"`));
  }
});

for (const name of ["FeaturedProducts", "NewArrivals", "BestSelling"]) {
  test(`${name} uses refreshed server stock without remounting`, () => {
    const source = readSource(`components/ecommarce/${name}.tsx`);
    // Exercise the real hooks/data derivation before JSX; keep useState slots across renders.
    const dataSection = source.slice(source.indexOf(`export default function ${name}(`), source.indexOf("  const reviewStats = useMemo("));
    const slots = [];
    let cursor = 0;
    const context = vm.createContext({
      ...clientData,
      useState: (initial) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
        return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
      },
      useMemo: (read) => read(), useCallback: (callback) => callback,
      useEffect: () => {}, useRef: () => ({ current: null }),
      useTranslations: () => (key) => key,
      useStorefrontSettings: () => ({ currency: "BDT" }),
      useWishlist: () => ({}), cachedFetchJson: forbidden, fetch: forbidden,
    }, { codeGeneration: { strings: false, wasm: false } });
    new vm.Script(compile(dataSection.replace("export default function", "function") + "return { items, loading };\n}")).runInContext(context);
    const render = (stock) => {
      cursor = 0;
      const products = [{ id: 901, type: "PHYSICAL", available: true, variants: [{ stock }] }];
      return context[name]({ productsData: products, topSellingData: products, categoriesData: [], reviewsData: [] });
    };
    assert.equal(render(0).items[0].stock, 0);
    assert.equal(render(20).items[0].stock, 20);
    assert.equal(render(0).items[0].stock, 0);
    assert.equal(render(5).loading, false);
  });
}
