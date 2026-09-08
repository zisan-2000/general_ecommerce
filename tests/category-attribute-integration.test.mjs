import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  validateCategoryProductAttributePolicy,
  validateTypedProductAttributeData,
} from "../lib/attribute-schema.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const definitions = [
  { id: 1, name: "Weight", type: "NUMBER", unit: "kg", values: [] },
  {
    id: 2,
    name: "Color",
    type: "COLOR",
    unit: null,
    values: [{ id: 20, value: "Blue" }, { id: 21, value: "Black" }],
  },
  {
    id: 3,
    name: "Material",
    type: "MULTI_SELECT",
    unit: null,
    values: [{ id: 30, value: "Cotton" }, { id: 31, value: "Linen" }],
  },
];

const mappings = definitions.map((attribute, index) => ({
  attributeId: attribute.id,
  isRequired: attribute.id === 1,
  isFilterable: true,
  isVariant: attribute.id === 2,
  sortOrder: index,
  attribute,
}));

test("configured categories reject missing required and unassigned attributes", () => {
  const missing = validateCategoryProductAttributePolicy({
    productAttributes: [],
    definitions,
    mappings,
  });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /Weight is required/);

  const unassigned = validateCategoryProductAttributePolicy({
    productAttributes: [{ attributeId: 99, value: "x" }],
    definitions: [...definitions, { id: 99, name: "Hidden", type: "TEXT", values: [] }],
    mappings,
  });
  assert.equal(unassigned.ok, false);
  assert.match(unassigned.error, /not assigned/);
});

test("typed validation canonicalizes numbers, booleans, choices and multi-select", () => {
  assert.equal(validateTypedProductAttributeData(definitions[0], "heavy").ok, false);
  assert.deepEqual(validateTypedProductAttributeData(definitions[1], "blue"), {
    ok: true,
    value: {
      value: "Blue",
      valueText: null,
      valueNumber: null,
      valueBoolean: null,
      attributeValueId: 20,
    },
  });
  assert.equal(validateTypedProductAttributeData(definitions[1], "Red").ok, false);
  assert.deepEqual(
    validateTypedProductAttributeData(definitions[2], '["cotton","Linen"]'),
    {
      ok: true,
      value: {
        value: "Cotton, Linen",
        valueText: '["Cotton","Linen"]',
        valueNumber: null,
        valueBoolean: null,
        attributeValueId: null,
      },
    },
  );
});

test("only category-approved attributes may drive variants", () => {
  const accepted = validateCategoryProductAttributePolicy({
    productAttributes: [{ attributeId: 1, value: "1.5" }],
    definitions,
    mappings,
    variantOptions: [{ name: "Color", values: ["Blue", "Black"] }],
  });
  assert.equal(accepted.ok, true);

  const rejected = validateCategoryProductAttributePolicy({
    productAttributes: [{ attributeId: 1, value: "1.5" }],
    definitions,
    mappings,
    variantOptions: [{ name: "Material", values: ["Cotton"] }],
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /not a variant attribute/);
});

test("unconfigured legacy categories retain compatibility behavior", () => {
  const result = validateCategoryProductAttributePolicy({
    productAttributes: [{ attributeId: 2, value: "Legacy custom color" }],
    definitions,
    mappings: [],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value[0].value, "Legacy custom color");
  assert.equal(result.value[0].attributeValueId, null);
});

test("product forms and mutation routes consume the category policy", async () => {
  const [addModal, relationsModal, createRoute, updateRoute, productRoute, directRoute] = await Promise.all([
    read("components/management/ProductAddModal.tsx"),
    read("components/management/ProductRelationsModal.tsx"),
    read("app/api/products/route-core.ts"),
    read("app/api/products/[id]/route-core.ts"),
    read("app/api/products/[id]/route.ts"),
    read("app/api/product-attributes/route.ts"),
  ]);
  assert.match(addModal, /Category Specifications/);
  assert.match(addModal, /categoryAttributeMappings/);
  assert.match(addModal, /validateCategoryProductAttributePolicy/);
  assert.match(addModal, /variantAttributeOptions/);
  assert.match(relationsModal, /availableAttributes/);
  assert.match(createRoute, /validateCategoryProductAttributes/);
  assert.match(updateRoute, /validateCategoryProductAttributes/);
  assert.match(productRoute, /Cannot activate this product/);
  assert.match(productRoute, /validateCategoryProductAttributes/);
  assert.match(directRoute, /validateSingleCategoryProductAttribute/);
});

test("catalog facets require filterable mappings and query typed columns", async () => {
  const catalog = await read("lib/storefront-catalog.ts");
  assert.match(catalog, /isFilterable:\s*true/);
  assert.match(catalog, /valueNumber/);
  assert.match(catalog, /valueBoolean/);
  assert.match(catalog, /attributeValueId/);
  assert.match(catalog, /valueText/);
  assert.match(catalog, /parseMultiSelectValue/);
  assert.match(catalog, /productVariantOption\.findMany/);
  assert.match(catalog, /variantOptions/);
  assert.doesNotMatch(catalog, /value:\s*\{\s*in:\s*values\s*\}/);
});

test("policy activation fails closed when active products would become invalid", async () => {
  const route = await read("app/api/categories/[id]/attributes/route.ts");
  assert.match(route, /validateCategoryProductAttributePolicy/);
  assert.match(route, /ACTIVE_PRODUCTS_INCOMPATIBLE/);
  assert.match(route, /needs typed-value backfill/);
  assert.match(route, /status:\s*409/);
});

test("Phase 5 verification command is chained after Phase 4", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  assert.match(packageJson.scripts["verify:universal-phase5"], /verify:universal-phase4/);
  assert.match(packageJson.scripts["verify:universal-phase5"], /test:universal-phase5/);
});
