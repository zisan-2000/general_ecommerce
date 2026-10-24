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
function loadSource(path, imports = {}) {
  const loadedModule = { exports: {} };
  const context = vm.createContext({
    module: loadedModule, exports: loadedModule.exports, Error,
    require: (name) => Object.hasOwn(imports, name) ? imports[name] : forbidden(),
    fetch: forbidden,
  }, { codeGeneration: { strings: false, wasm: false } });
  new vm.Script(compile(readSource(path)), { filename: path }).runInContext(context);
  return loadedModule.exports;
}

const variants = loadSource("lib/product-variants.ts");
const stockStatus = loadSource("lib/stock-status.ts");
const clientData = loadSource("lib/storefront-client-data.ts");
const warehouseStock = loadSource("lib/warehouse-stock.ts");
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
