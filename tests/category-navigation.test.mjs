import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("category schema and migration expose configurable navigation fields", async () => {
  const [schema, migration] = await Promise.all([
    read("prisma/schema.prisma"),
    read("prisma/migrations/20260908_add_category_navigation_config/migration.sql"),
  ]);

  for (const field of ["isActive", "sortOrder", "showInHeader", "showInFooter", "featured"]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
    assert.match(migration, new RegExp(`"${field}"`));
  }
  assert.match(schema, /@@index\(\[isActive, showInHeader, sortOrder\]\)/);
  assert.match(schema, /@@index\(\[isActive, showInFooter, sortOrder\]\)/);
  assert.match(schema, /@@index\(\[isActive, featured, sortOrder\]\)/);
});

test("header navigation has no technology-specific category order", async () => {
  const header = await read("components/ecommarce/header.tsx");
  assert.doesNotMatch(header, /DESKTOP_CATEGORY_ORDER/);
  assert.match(header, /showInHeader/);
  assert.match(header, /sortOrder/);
  assert.match(header, /getEffectiveCategoryNavigationIds/);
});

test("footer and homepage consume category placement configuration", async () => {
  const [footer, featured] = await Promise.all([
    read("components/ecommarce/footer.tsx"),
    read("components/ecommarce/FeaturedCategories.tsx"),
  ]);
  assert.match(footer, /showInFooter/);
  assert.match(footer, /getEffectiveCategoryNavigationIds/);
  assert.match(featured, /featured/);
  assert.match(featured, /sortOrder/);
  assert.match(featured, /isActive/);
});

test("category API protects hierarchy and persists navigation configuration", async () => {
  const [collection, item] = await Promise.all([
    read("app/api/categories/route.ts"),
    read("app/api/categories/[id]/route.ts"),
  ]);
  for (const source of [collection, item]) {
    assert.match(source, /parseCategoryNavigationPatch/);
    assert.match(source, /revalidateStorefrontCatalog/);
  }
  assert.match(item, /wouldCreateCategoryCycle/);
  assert.match(item, /descendants/);
  assert.match(item, /inactive parent/);
});

test("phase 6 includes safe deployment helpers", async () => {
  const [backfill, verify, docs] = await Promise.all([
    read("scripts/backfill-category-navigation.ts"),
    read("scripts/verify-category-navigation.ts"),
    read("docs/universal-ecommerce-phase6.md"),
  ]);
  assert.match(backfill, /LEGACY_TECH_ROOT_ORDER/);
  assert.match(backfill, /every\(\(category\) => category\.sortOrder === 0\)/);
  assert.match(verify, /participates in a category cycle/);
  assert.match(docs, /Phase 6/);
});
