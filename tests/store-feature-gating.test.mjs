import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("dedicated optional-module pages and APIs fail closed through the central gate", async () => {
  const sources = await Promise.all([
    read("app/ecommerce/pc-builder/page.tsx"),
    read("app/ecommerce/compare/page.tsx"),
    read("app/admin/operations/products/bundles/layout.tsx"),
    read("app/api/pc-builder/catalog/route.ts"),
    read("app/api/pc-builder/validate/route.ts"),
    read("app/api/pc-builder/builds/route.ts"),
    read("app/api/compare/products/route.ts"),
    read("app/api/admin/products/bundles/route.ts"),
    read("app/api/digital-assets/route.ts"),
    read("app/api/service-slots/route.ts"),
  ]);

  for (const source of sources) {
    assert.match(source, /(?:gateStoreFeature|isFeatureEnabled)\(/);
  }
});

test("storefront discovery surfaces exclude disabled product types", async () => {
  const sources = await Promise.all([
    read("lib/storefront-home.ts"),
    read("lib/storefront-catalog.ts"),
    read("lib/storefront-product-detail.ts"),
    read("lib/storefront-flash-sale.ts"),
    read("lib/search/server.ts"),
    read("app/api/products/route-core.ts"),
    read("app/api/products/top-selling/route.ts"),
    read("app/api/categories/[id]/products/route.ts"),
    read("app/api/wishlist/route.ts"),
    read("app/sitemap.ts"),
  ]);

  for (const source of sources) {
    assert.match(source, /getDisabledStorefrontProductTypes|disabledProductTypes/);
  }
});

test("new product management, cart and checkout mutations enforce product module flags", async () => {
  const [createRoute, productRoute, cartRoute, cartItemRoute, orderRoute] =
    await Promise.all([
      read("app/api/products/route.ts"),
      read("app/api/products/[id]/route-core.ts"),
      read("app/api/cart/route-core.ts"),
      read("app/api/cart/[id]/route-core.ts"),
      read("app/api/orders/route-core.ts"),
    ]);

  assert.match(createRoute, /gateProductType\(body\.type/);
  assert.ok((productRoute.match(/gateProductType\(/g) ?? []).length >= 3);
  assert.match(cartRoute, /gateProductType\(product\.type\)/);
  assert.match(cartItemRoute, /gateProductType\(cartItem\.product\.type\)/);
  assert.match(orderRoute, /gateProductType\(product\.type\)/);
});

test("historical order reads stay available while only order creation is gated", async () => {
  const orderRoute = await read("app/api/orders/route-core.ts");
  const getStart = orderRoute.indexOf("export async function GET");
  const postStart = orderRoute.indexOf("export async function POST");
  assert.ok(getStart >= 0 && postStart > getStart);
  assert.doesNotMatch(orderRoute.slice(getStart, postStart), /gateProductType\(/);
  assert.match(orderRoute.slice(postStart), /gateProductType\(/);
});

test("navigation and product actions consume resolved visibility without querying feature rows", async () => {
  const [layout, header, grid, purchasePanel, manager, featureSettings] = await Promise.all([
    read("app/ecommerce/layout.tsx"),
    read("components/ecommarce/header.tsx"),
    read("components/ecommarce/catalog/CatalogProductGrid.tsx"),
    read("components/ecommarce/product-detail/ProductPurchasePanel.tsx"),
    read("components/management/ProductManager.tsx"),
    read("app/admin/settings/features/page.tsx"),
  ]);

  assert.match(layout, /getStoreFeatureRegistry\(\)/);
  assert.match(header, /visibleShopActions/);
  assert.match(grid, /compareEnabled/);
  assert.match(purchasePanel, /compareEnabled/);
  assert.match(manager, /Existing product data remains read-only/);
  assert.match(featureSettings, /role="switch"/);
  assert.match(featureSettings, /Existing order and audit history stays readable/);
  for (const source of [header, grid, purchasePanel, manager, featureSettings]) {
    assert.doesNotMatch(source, /prisma\.storeFeature/);
  }
});
