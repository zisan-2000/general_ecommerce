import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildProductAttributeStorageRows,
  buildTypedProductAttributeData,
  parseAttributeDefinitionInput,
  parseCategoryAttributeMappings,
} from "../lib/attribute-schema.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("attribute definitions accept all catalog types and normalize units", () => {
  assert.deepEqual(parseAttributeDefinitionInput({ name: " Weight ", type: "NUMBER", unit: " kg " }), {
    ok: true,
    value: { name: "Weight", type: "NUMBER", unit: "kg" },
  });
  assert.equal(parseAttributeDefinitionInput({ name: "Color", type: "JSON" }).ok, false);
});

test("category mappings are deduplicated and flags have safe defaults", () => {
  const parsed = parseCategoryAttributeMappings([
    { attributeId: 2, isRequired: true, sortOrder: 8 },
    { attributeId: 2, isVariant: true, isFilterable: false, sortOrder: 3 },
  ]);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, [
    { attributeId: 2, isRequired: false, isFilterable: false, isVariant: true, sortOrder: 3 },
  ]);
});

test("legacy values are dual-written into the correct typed field", () => {
  assert.deepEqual(
    buildTypedProductAttributeData({ id: 1, type: "NUMBER", values: [] }, " 15.6 "),
    { value: "15.6", valueText: null, valueNumber: "15.6", valueBoolean: null, attributeValueId: null },
  );
  assert.equal(
    buildTypedProductAttributeData({ id: 2, type: "BOOLEAN", values: [] }, "Yes").valueBoolean,
    true,
  );
  assert.equal(
    buildTypedProductAttributeData({ id: 2, type: "NUMBER", values: [] }, "1234567890123456789").valueNumber,
    null,
  );
  assert.equal(
    buildTypedProductAttributeData({ id: 3, type: "SELECT", values: [{ id: 9, value: "Blue" }] }, "blue").attributeValueId,
    9,
  );
});

test("storage row builder preserves the compatibility value", () => {
  const rows = buildProductAttributeStorageRows(
    [{ attributeId: 4, value: "OLED" }],
    [{ id: 4, type: "TEXT", values: [] }],
  );
  assert.deepEqual(rows[0], {
    attributeId: 4,
    value: "OLED",
    valueText: "OLED",
    valueNumber: null,
    valueBoolean: null,
    attributeValueId: null,
  });
});

test("Phase 4 migration is additive and keeps the legacy value column", async () => {
  const [schema, migration] = await Promise.all([
    read("prisma/schema.prisma"),
    read("prisma/migrations/20260908_add_typed_category_attributes/migration.sql"),
  ]);
  for (const type of ["TEXT", "NUMBER", "SELECT", "MULTI_SELECT", "BOOLEAN", "COLOR"]) {
    assert.match(schema, new RegExp(`\\b${type}\\b`));
  }
  assert.match(schema, /model CategoryAttribute\s*\{/);
  assert.match(schema, /value\s+String/);
  assert.match(schema, /valueText\s+String\?/);
  assert.match(schema, /valueNumber\s+Decimal\?/);
  assert.match(schema, /valueBoolean\s+Boolean\?/);
  assert.match(schema, /attributeValueId\s+Int\?/);
  assert.match(migration, /CREATE TABLE "CategoryAttribute"/);
  assert.doesNotMatch(migration, /^\s*(?:DROP|DELETE|UPDATE|INSERT)\b/im);
});

test("mapping API is protected and backfill/verifier responsibilities stay separate", async () => {
  const [route, modal, backfill, verifier] = await Promise.all([
    read("app/api/categories/[id]/attributes/route.ts"),
    read("components/management/AttributesManagerModal.tsx"),
    read("scripts/backfill-product-attribute-values.ts"),
    read("scripts/verify-product-attribute-values.ts"),
  ]);
  assert.match(route, /requireProductManager\(\)/);
  assert.match(route, /parseCategoryAttributeMappings/);
  assert.match(route, /categoryAttribute\.createMany/);
  assert.match(modal, /Save mapping/);
  assert.match(modal, /isRequired/);
  assert.match(modal, /isFilterable/);
  assert.match(modal, /isVariant/);
  assert.match(backfill, /productAttribute\.update/);
  assert.doesNotMatch(verifier, /\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\(/);
  assert.match(verifier, /process\.exitCode = 1/);
});

test("all current product-attribute mutations use compatibility typed writes", async () => {
  const sources = await Promise.all([
    read("app/api/products/route-core.ts"),
    read("app/api/products/[id]/route-core.ts"),
    read("app/api/product-attributes/route.ts"),
    read("app/api/product-attributes/[id]/route.ts"),
  ]);
  for (const source of sources) {
    assert.match(
      source,
      /(?:build(?:ProductAttributeStorageRows|TypedProductAttributeData)|validate(?:Category|SingleCategory)ProductAttribute)/,
    );
  }
});
