import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getDefaultBundleAvailableQuantity,
  haveSameBundleGroupDefinitions,
  resolveBundleConfiguration,
  validateBundleAdminGroups,
} from "../lib/configurable-bundle.ts";

test("sale-cap/price edits preserve identical group definitions and existing cart IDs", () => {
  const original = [{
    id: 71, name: "Shirts", selectionType: "FIXED", pricingMode: "AUTOMATIC", required: true,
    minSelect: 1, maxSelect: 1, defaultQuantity: 2, minQuantity: 2, maxQuantity: 2,
    allowQuantityChange: false, sortOrder: 0,
    options: [{ id: 91, productId: 10, variantId: 20, isDefault: true, priceAdjustment: "0.00", sortOrder: 0 }],
  }];
  const prepared = structuredClone(original);
  delete prepared[0].id;
  delete prepared[0].options[0].id;
  prepared[0].options[0].priceAdjustment = 0;
  assert.equal(haveSameBundleGroupDefinitions(original, prepared), true);
  prepared[0].defaultQuantity = prepared[0].minQuantity = prepared[0].maxQuantity = 3;
  assert.equal(haveSameBundleGroupDefinitions(original, prepared), false);
  prepared[0].defaultQuantity = prepared[0].minQuantity = prepared[0].maxQuantity = 2;
  prepared[0].options[0].variantId = 21;
  assert.equal(haveSameBundleGroupDefinitions(original, prepared), false);
});

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
    stockLevels: [{ warehouseId: 1, quantity: stock, reserved: 0 }],
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

function group({ id, name, selectionType, options, required = true, minSelect = 1, pricingMode = "MANUAL" }) {
  return {
    id,
    name,
    selectionType,
    pricingMode,
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
    bundleWarehouseId: 1,
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
  assert.equal(getDefaultBundleAvailableQuantity(fixture()), resolved.availableQuantity);
});

test("default storefront availability uses the configured default variants and warehouse", () => {
  const bundle = fixture();
  bundle.bundleStockLimit = null;
  assert.equal(getDefaultBundleAvailableQuantity(bundle), 8);

  bundle.bundleWarehouseId = 2;
  assert.equal(getDefaultBundleAvailableQuantity(bundle), 0);
});

test("warehouse selection limits bundle stock to that warehouse and is required at checkout", () => {
  const elsewhere = fixture();
  elsewhere.bundleWarehouseId = 2;
  const result = resolveBundleConfiguration({ bundle: elsewhere, strictWarehouseStock: true });
  assert.equal(result.warehouseId, 2);
  assert.equal(result.availableQuantity, 0);

  const unassigned = fixture();
  unassigned.bundleWarehouseId = null;
  assert.throws(
    () => resolveBundleConfiguration({ bundle: unassigned, strictWarehouseStock: true }),
    /fulfillment warehouse is not configured/,
  );
});

test("preassembled availability is based on finished warehouse stock, not component stock", () => {
  const bundle = fixture();
  bundle.bundleFulfillmentMode = "PREASSEMBLED";
  bundle.bundleGroups = bundle.bundleGroups.filter((item) => item.options.some((choice) => choice.isDefault)).map((item) => ({
    ...item,
    selectionType: "FIXED",
    required: true,
    allowQuantityChange: false,
    minQuantity: item.defaultQuantity,
    maxQuantity: item.defaultQuantity,
    options: item.options.filter((choice) => choice.isDefault),
  }));
  bundle.assembledStockLevels = [{ warehouseId: 1, quantity: 6, reserved: 2 }];
  bundle.bundleStockLimit = 5;
  assert.equal(getDefaultBundleAvailableQuantity(bundle), 4);

  bundle.assembledStockLevels[0].quantity = 1;
  assert.equal(getDefaultBundleAvailableQuantity(bundle), 0);

  bundle.assembledStockLevels[0].warehouseId = 2;
  bundle.assembledStockLevels[0].quantity = 20;
  bundle.assembledStockLevels[0].reserved = 0;
  assert.equal(getDefaultBundleAvailableQuantity(bundle), 0);
});

test("selectable compositions cannot be treated as preassembled stock", () => {
  const bundle = fixture();
  bundle.bundleFulfillmentMode = "PREASSEMBLED";
  assert.throws(
    () => resolveBundleConfiguration({ bundle, strictWarehouseStock: true }),
    /fixed, non-editable physical composition/,
  );
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

test("automatic pricing uses actual component price differences when manual adjustments are zero", () => {
  const bundle = fixture();
  bundle.bundleGroups = bundle.bundleGroups.map((item) => ({
    ...item,
    pricingMode: "AUTOMATIC",
    options: item.options.map((choice) => ({ ...choice, priceAdjustment: 0 })),
  }));
  const configured = resolveBundleConfiguration({
    bundle,
    selections: [
      { groupId: 1, optionId: 12 },
      { groupId: 2, optionId: 21 },
      { groupId: 3, optionId: 32 },
      { groupId: 4, optionId: null, omitted: true },
    ],
    strictWarehouseStock: true,
  });
  assert.equal(configured.finalPrice, 1180);

  const withOptional = resolveBundleConfiguration({
    bundle,
    selections: [{ groupId: 4, optionId: 41 }],
    strictWarehouseStock: true,
  });
  assert.equal(withOptional.finalPrice, 1120);
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
    {
      name: "Required selector",
      selectionType: "PRODUCT_SELECT",
      required: false,
      minSelect: 0,
      options: [{ productId: 4, variantId: 40, isDefault: false }],
    },
  ]);
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join("\n"), /optional and cannot be required/);
  assert.match(invalid.errors.join("\n"), /same product/);
  assert.match(invalid.errors.join("\n"), /must be required/);
});

test("admin bundle details distinguish component availability from the optional sale cap", async () => {
  const [api, detailPage, form, messagesEn, messagesBn] = await Promise.all([
    readFile(new URL("../app/api/admin/products/bundles/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/operations/products/bundles/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/admin/products/bundles/BundleFormModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../messages/en.json", import.meta.url), "utf8"),
    readFile(new URL("../messages/bn.json", import.meta.url), "utf8"),
  ]);

  assert.match(api, /componentCapacity/);
  assert.match(api, /saleLimit:\s*bundle\.bundleStockLimit/);
  assert.match(api, /effectiveStock:\s*getDefaultBundleAvailableQuantity/);
  assert.match(detailPage, /bundle\._availability\.componentCapacity/);
  assert.match(detailPage, /bundle\._availability\.saleLimit\s*===\s*null/);
  assert.match(detailPage, /bundle\._availability\.effectiveStock/);
  assert.match(form, /formData\.bundleStockLimit\s*===\s*""/);
  assert.match(form, /t\("availability\.effectiveStock"\)/);
  assert.equal(
    JSON.parse(messagesEn).AdminBundles.detail.availability.effectiveStock,
    "Currently sellable",
  );
  assert.equal(
    JSON.parse(messagesBn).AdminBundles.detail.availability.effectiveStock,
    "বর্তমানে বিক্রয়যোগ্য",
  );
});

test("cart, order, warehouse, admin and storefront retain the configurable-bundle contract", async () => {
  const [cart, order, warehouse, adminCreate, adminUpdate, shipment, categoryPicker, catalogSearch, customerConfigurator, messagesEn, messagesBn] = await Promise.all([
    readFile(new URL("../app/api/cart/route-core.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/orders/route-core.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/order-warehouse-stock.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/products/bundles/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/products/bundles/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/shipments/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/admin/products/bundles/ConfigurableBundleGroupBuilder.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/products/bundles/search-products/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/ecommarce/product-detail/BundleConfigurator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../messages/en.json", import.meta.url), "utf8"),
    readFile(new URL("../messages/bn.json", import.meta.url), "utf8"),
  ]);

  assert.match(cart, /bundleConfiguration/);
  assert.match(cart, /configurationKey/);
  assert.match(order, /bundleComponents/);
  assert.match(order, /assertWarehouseDemandAvailable/);
  assert.match(warehouse, /orderBundleComponent/);
  assert.match(shipment, /bundleComponents/);
  assert.match(adminCreate, /requireProductManager/);
  assert.doesNotMatch(adminCreate, /Please select a valid warehouse/);
  assert.match(adminUpdate, /requireProductManager/);
  assert.match(categoryPicker, /categoryIds: categoryId/);
  assert.match(categoryPicker, /AdminBundles\.builder\.catalog/);
  assert.match(categoryPicker, /t\("categoryLabel"\)/);
  assert.match(categoryPicker, /t\("pricingModes\.AUTOMATIC"\)/);
  assert.match(categoryPicker, /t\("retry"\)/);
  assert.match(categoryPicker, /t\("actions\.moveUp"/);
  assert.equal(JSON.parse(messagesEn).AdminBundles.builder.catalog.categoryLabel, "Product category");
  assert.equal(JSON.parse(messagesBn).AdminBundles.builder.catalog.categoryLabel, "পণ্যের ক্যাটাগরি");
  assert.match(catalogSearch, /effectiveCategoryIds/);
  assert.match(catalogSearch, /category\.parentId/);
  assert.match(catalogSearch, /stockLevels/);
  assert.match(catalogSearch, /reserved/);
  assert.match(customerConfigurator, /calculateConfiguredBundlePricing/);
  assert.match(customerConfigurator, /t\("ready"\)/);
  assert.match(customerConfigurator, /selectionLimitReached/);
});
