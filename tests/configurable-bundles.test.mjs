import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  resolveBundleConfiguration,
  validateBundleAdminGroups,
} from "../lib/configurable-bundle.ts";

function variant(id, productId, stock, sku, price) {
  return {
    id,
    productId,
    sku,
    price,
    currency: "BDT",
    stock,
    options: { Size: sku },
    active: true,
    isDefault: sku.endsWith("1L") || sku.endsWith("500G") || sku.includes("KEYA"),
    stockLevels: [{ quantity: stock, reserved: 0 }],
  };
}

function option(id, product, selectedVariant, priceAdjustment, isDefault) {
  return {
    id,
    productId: product.id,
    variantId: selectedVariant?.id ?? null,
    isDefault,
    priceAdjustment,
    sortOrder: id,
    product,
    variant: selectedVariant,
  };
}

function product(id, name, variants) {
  return {
    id,
    name,
    type: "PHYSICAL",
    available: true,
    deleted: false,
    basePrice: variants[0].price,
    variants,
  };
}

function group({ id, name, selectionType, options, required = true, minSelect = 1 }) {
  return {
    id,
    name,
    selectionType,
    required,
    minSelect,
    maxSelect: 1,
    defaultQuantity: 1,
    minQuantity: 1,
    maxQuantity: 3,
    allowQuantityChange: false,
    sortOrder: id,
    options,
  };
}

function fixture() {
  const oil1 = variant(101, 10, 20, "OIL-1L", 180);
  const oil2 = variant(102, 10, 3, "OIL-2L", 340);
  const honeyVariant = variant(201, 20, 8, "HONEY-500G", 250);
  const keyaVariant = variant(301, 30, 10, "SOAP-KEYA", 60);
  const luxVariant = variant(401, 40, 4, "SOAP-LUX", 80);
  const shampooVariant = variant(501, 50, 2, "SHAMPOO", 120);
  const oil = product(10, "Soybean Oil", [oil1, oil2]);
  const honey = product(20, "Honey", [honeyVariant]);
  const keya = product(30, "Keya Soap", [keyaVariant]);
  const lux = product(40, "Lux Soap", [luxVariant]);
  const shampoo = product(50, "Shampoo", [shampooVariant]);

  return {
    id: 44,
    name: "Family Essentials Bundle",
    basePrice: 1000,
    currency: "BDT",
    bundleStockLimit: 5,
    bundleGroups: [
      group({
        id: 1,
        name: "Oil size",
        selectionType: "VARIANT_SELECT",
        options: [option(11, oil, oil1, 0, true), option(12, oil, oil2, 150, false)],
      }),
      group({
        id: 2,
        name: "Honey",
        selectionType: "FIXED",
        options: [option(21, honey, honeyVariant, 0, true)],
      }),
      group({
        id: 3,
        name: "Soap",
        selectionType: "PRODUCT_SELECT",
        options: [option(31, keya, keyaVariant, 0, true), option(32, lux, luxVariant, 20, false)],
      }),
      group({
        id: 4,
        name: "Extra shampoo",
        selectionType: "OPTIONAL",
        required: false,
        minSelect: 0,
        options: [option(41, shampoo, shampooVariant, 75, false)],
      }),
    ],
  };
}

test("default configuration uses defaults, base price, global limit and child inventory", () => {
  const resolved = resolveBundleConfiguration({
    bundle: fixture(),
    strictWarehouseStock: true,
  });

  assert.equal(resolved.finalPrice, 1000);
  assert.equal(resolved.availableQuantity, 5);
  assert.deepEqual(resolved.components.map((component) => component.variantId), [101, 201, 301]);
  assert.equal(resolved.components.some((component) => component.productName === "Shampoo"), false);
});

test("variant and product choices change price and configuration-specific stock", () => {
  const resolved = resolveBundleConfiguration({
    bundle: fixture(),
    selections: [
      { groupId: 1, optionId: 12 },
      { groupId: 2, optionId: 21 },
      { groupId: 3, optionId: 32 },
      { groupId: 4, optionId: null, omitted: true },
    ],
    strictWarehouseStock: true,
  });

  assert.equal(resolved.finalPrice, 1170);
  assert.equal(resolved.availableQuantity, 3);
  assert.deepEqual(resolved.components.map((component) => component.variantId), [102, 201, 401]);
});

test("optional choices can be selected or explicitly omitted, other groups cannot", () => {
  const selected = resolveBundleConfiguration({
    bundle: fixture(),
    selections: [{ groupId: 4, optionId: 41 }],
    strictWarehouseStock: true,
  });
  assert.equal(selected.finalPrice, 1075);
  assert.equal(selected.availableQuantity, 2);

  assert.throws(
    () => resolveBundleConfiguration({
      bundle: fixture(),
      selections: [{ groupId: 3, optionId: null, omitted: true }],
      strictWarehouseStock: true,
    }),
    /cannot be omitted/,
  );
});

test("fixed choices and malformed or unknown choices are rejected", () => {
  assert.throws(
    () => resolveBundleConfiguration({ bundle: fixture(), selections: [{ groupId: 2, optionId: 31 }] }),
    /fixed and cannot be changed/,
  );
  assert.throws(
    () => resolveBundleConfiguration({ bundle: fixture(), selections: [{ groupId: 999, optionId: 31 }] }),
    /unknown group/,
  );
  assert.throws(
    () => resolveBundleConfiguration({ bundle: fixture(), selections: [{ groupId: "bad", optionId: 31 }] }),
    /malformed/,
  );
});

test("repeated use of one child variant is aggregated for capacity", () => {
  const bundle = fixture();
  const honeyOption = bundle.bundleGroups[1].options[0];
  bundle.bundleGroups.push(
    group({
      id: 5,
      name: "Second honey",
      selectionType: "FIXED",
      options: [{ ...honeyOption, id: 51 }],
    }),
  );
  const resolved = resolveBundleConfiguration({ bundle, strictWarehouseStock: true });
  assert.equal(resolved.availableQuantity, 4);
});

test("admin validation enforces group semantics and variant-selector product identity", () => {
  const valid = validateBundleAdminGroups([
    {
      name: "Fixed",
      selectionType: "FIXED",
      required: true,
      options: [{ productId: 1, variantId: 10, isDefault: true }],
    },
    {
      name: "Size",
      selectionType: "VARIANT_SELECT",
      required: true,
      options: [
        { productId: 2, variantId: 20, isDefault: true },
        { productId: 2, variantId: 21, isDefault: false },
      ],
    },
  ]);
  assert.equal(valid.valid, true);

  const invalid = validateBundleAdminGroups([
    {
      name: "Optional but required",
      selectionType: "OPTIONAL",
      required: true,
      minSelect: 0,
      options: [{ productId: 1, isDefault: false }],
    },
    {
      name: "Mixed variants",
      selectionType: "VARIANT_SELECT",
      required: true,
      options: [
        { productId: 2, variantId: 20, isDefault: true },
        { productId: 3, variantId: 30, isDefault: false },
      ],
    },
  ]);
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join("\n"), /optional and cannot be required/);
  assert.match(invalid.errors.join("\n"), /same product/);
});

test("cart, order, warehouse and admin routes retain the configurable-bundle contract", async () => {
  const [cart, order, warehouse, adminCreate, adminUpdate, shipment, categoryPicker, catalogSearch] = await Promise.all([
    readFile(new URL("../app/api/cart/route-core.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/orders/route-core.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/order-warehouse-stock.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/products/bundles/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/products/bundles/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/shipments/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/admin/products/bundles/ConfigurableBundleGroupBuilder.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/products/bundles/search-products/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(cart, /bundleConfiguration/);
  assert.match(cart, /configurationKey/);
  assert.match(order, /bundleComponents/);
  assert.match(order, /assertWarehouseDemandAvailable/);
  assert.match(warehouse, /orderBundleComponent/);
  assert.match(shipment, /bundleComponents/);
  assert.match(adminCreate, /requireProductManager/);
  assert.match(adminUpdate, /requireProductManager/);
  assert.match(categoryPicker, /categoryIds: selectedCategoryId/);
  assert.match(categoryPicker, /Catalog category/);
  assert.match(catalogSearch, /effectiveCategoryIds/);
  assert.match(catalogSearch, /category\.parentId/);
});
