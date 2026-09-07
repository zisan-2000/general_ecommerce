import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getProductAvailableStock,
  parseStorefrontProductId,
} from "../lib/product-purchase.ts";
import {
  normalizeCompareProductIds,
  toggleCompareProductId,
} from "../lib/product-compare.ts";
import { parseCatalogFilters } from "../lib/storefront-catalog.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function expectRouteHandlers(source, handlers, label) {
  for (const handler of handlers) {
    assert.match(
      source,
      new RegExp(`export async function ${handler}\\b`),
      `${label} must retain its ${handler} handler`,
    );
  }
}

test("Prisma keeps the generic commerce core and every supported product type", async () => {
  const schema = await read("prisma/schema.prisma");

  for (const model of [
    "Category",
    "Product",
    "ProductVariant",
    "ProductBundleItem",
    "Attribute",
    "AttributeValue",
    "ProductAttribute",
    "CartItem",
    "Order",
    "OrderItem",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }

  assert.match(
    schema,
    /enum ProductType\s*\{[\s\S]*?PHYSICAL[\s\S]*?DIGITAL[\s\S]*?SERVICE[\s\S]*?BUNDLE[\s\S]*?\}/,
  );
  assert.match(schema, /parent\s+Category\?\s+@relation\("CategoryToCategory"/);
  assert.match(schema, /children\s+Category\[\]\s+@relation\("CategoryToCategory"\)/);
  assert.match(schema, /bundleItems\s+ProductBundleItem\[\]/);
  assert.match(schema, /includedInBundles\s+ProductBundleItem\[\]/);
});

test("product, variant and category CRUD contracts remain available", async () => {
  const [products, product, variants, variant, categories, category] =
    await Promise.all([
      read("app/api/products/route-core.ts"),
      read("app/api/products/[id]/route-core.ts"),
      read("app/api/product-variants/route.ts"),
      read("app/api/product-variants/[id]/route.ts"),
      read("app/api/categories/route.ts"),
      read("app/api/categories/[id]/route.ts"),
    ]);

  expectRouteHandlers(products, ["GET", "POST"], "product collection");
  expectRouteHandlers(product, ["GET", "PUT", "PATCH", "DELETE"], "product item");
  expectRouteHandlers(variants, ["GET", "POST"], "variant collection");
  expectRouteHandlers(variant, ["PUT", "DELETE"], "variant item");
  expectRouteHandlers(categories, ["GET", "POST"], "category collection");
  expectRouteHandlers(category, ["GET", "PUT", "DELETE"], "category item");

  assert.match(product, /data:\s*\{\s*deleted:\s*true\s*\}/);
  assert.match(category, /data:\s*\{\s*deleted:\s*true\s*\}/);
});

test("catalog search and filters keep normalized, bounded input", () => {
  const filters = parseCatalogFilters({
    q: "  universal   product  ",
    category: "Office-Supplies",
    brand: ["Acme,acme", "North-Star"],
    minPrice: "5000",
    maxPrice: "1000",
    inStock: "1",
    page: "-10",
    perPage: "999",
  });

  assert.equal(filters.q, "universal product");
  assert.equal(filters.category, "office-supplies");
  assert.deepEqual(filters.brands, ["acme", "north-star"]);
  assert.equal(filters.minPrice, 1000);
  assert.equal(filters.maxPrice, 5000);
  assert.equal(filters.inStock, true);
  assert.equal(filters.page, 1);
  assert.equal(filters.perPage, 24);
});

test("cart, Buy Now and checkout retain one connected order flow", async () => {
  const [cart, cartItem, purchasePanel, checkout] = await Promise.all([
    read("app/api/cart/route-core.ts"),
    read("app/api/cart/[id]/route-core.ts"),
    read("components/ecommarce/product-detail/ProductPurchasePanel.tsx"),
    read("app/ecommerce/checkout/page.tsx"),
  ]);

  expectRouteHandlers(cart, ["GET", "POST", "DELETE"], "cart collection");
  expectRouteHandlers(cartItem, ["PATCH", "DELETE"], "cart item");
  assert.match(purchasePanel, /const buyNow = async \(\) =>/);
  assert.match(
    purchasePanel,
    /if \(await addSelectedProduct\(\)\) router\.push\("\/ecommerce\/checkout"\)/,
  );
  assert.match(checkout, /fetch\("\/api\/orders",\s*\{\s*method:\s*"POST"/);
  assert.match(checkout, /setStep\("confirm"\)/);
  assert.match(checkout, /clearCart\(\)/);
});

test("order creation stays idempotent and performs inventory work atomically", async () => {
  const [orderRoute, idempotency, inventoryLifecycle] = await Promise.all([
    read("app/api/orders/route-core.ts"),
    read("lib/order-idempotency.ts"),
    read("lib/order-inventory-lifecycle.ts"),
  ]);

  expectRouteHandlers(orderRoute, ["GET", "POST"], "order collection");
  assert.match(orderRoute, /buildOrderIdempotencyContext/);
  assert.match(orderRoute, /acquireOrderIdempotencyLock\(tx, idempotency\)/);
  assert.match(orderRoute, /await (?:reserve|deduct)VariantInventory\(/);
  assert.match(orderRoute, /prisma\.\$transaction|\$transaction\(async \(tx\)/);
  assert.match(idempotency, /mode:\s*"client"\s*\|\s*"automatic"/);
  assert.match(inventoryLifecycle, /restoreOrderInventory/);
  assert.match(inventoryLifecycle, /INVENTORY_RELEASE_STATUSES/);
});

test("flash sale, compare and PC Builder extension points remain operational", async () => {
  const [flashSale, flashSaleRoute, compareRoute, pcBuilderPage, pcBuilderRoute] =
    await Promise.all([
      read("lib/flash-sale.ts"),
      read("app/api/admin/flash-sales/route.ts"),
      read("app/api/compare/products/route.ts"),
      read("app/ecommerce/pc-builder/page.tsx"),
      read("app/api/pc-builder/validate/route.ts"),
    ]);

  assert.match(flashSale, /export function resolveFlashSalePricing/);
  assert.match(flashSaleRoute, /flashSaleEnabled/);
  assert.match(compareRoute, /export async function GET/);
  assert.match(pcBuilderPage, /PcBuilderClient/);
  assert.match(pcBuilderRoute, /export async function POST/);

  assert.deepEqual(normalizeCompareProductIds([1, "1", 2, 3, 4, 5]), [1, 2, 3, 4]);
  assert.equal(toggleCompareProductId([1, 2, 3, 4], 5).limitReached, true);
});

test("physical, digital, service and bundle purchase rules are explicit", () => {
  const physicalVariant = {
    id: 1,
    sku: "PHYSICAL-1",
    price: 100,
    stock: 7,
    options: {},
    colorImage: null,
    isDefault: true,
    active: true,
  };

  assert.equal(parseStorefrontProductId("42"), 42);
  assert.equal(
    getProductAvailableStock({
      type: "PHYSICAL",
      bundleStockLimit: null,
      variants: [physicalVariant],
    }),
    7,
  );
  assert.equal(
    getProductAvailableStock({ type: "DIGITAL", bundleStockLimit: null, variants: [] }),
    99,
  );
  assert.equal(
    getProductAvailableStock({ type: "SERVICE", bundleStockLimit: null, variants: [] }),
    99,
  );
  assert.equal(
    getProductAvailableStock({ type: "BUNDLE", bundleStockLimit: 3, variants: [] }),
    3,
  );
});

test("book data is preserved while legacy public routes remain dormant", async () => {
  const [schema, books, book, authors] = await Promise.all([
    read("prisma/schema.prisma"),
    read("app/ecommerce/books/page.tsx"),
    read("app/ecommerce/books/[identifier]/page.tsx"),
    read("app/ecommerce/authors/page.tsx"),
  ]);

  assert.match(schema, /model Writer\s*\{/);
  assert.match(schema, /model Publisher\s*\{/);
  assert.match(schema, /writerId\s+Int\?/);
  assert.match(schema, /publisherId\s+Int\?/);
  assert.match(books, /permanentRedirect\("\/ecommerce\/products"\)/);
  assert.match(book, /permanentRedirect\(`\/ecommerce\/products\/\$\{product\.id\}`\)/);
  assert.match(authors, /permanentRedirect\("\/ecommerce\/brands"\)/);
});

test("the Phase 1 release command keeps every required regression suite wired", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const scripts = packageJson.scripts;

  for (const required of [
    "test:phase1",
    "test:phase2",
    "test:flash-sale",
    "test:pc-builder",
    "test:search",
    "test:order-inventory",
    "test:order-idempotency",
    "test:universal-baseline",
    "validate:schema",
    "verify:universal-phase1",
  ]) {
    assert.equal(typeof scripts[required], "string", `missing npm script: ${required}`);
  }

  for (const gate of [
    "test:universal-baseline",
    "test:products",
    "test:order-idempotency",
    "validate:schema",
    "lint",
    "typecheck",
  ]) {
    assert.ok(
      scripts["verify:universal-phase1"].includes(gate),
      `Phase 1 verification must include ${gate}`,
    );
  }
});

