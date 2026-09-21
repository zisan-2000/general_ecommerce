import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CATEGORY_NAVIGATION_DEFAULTS,
  getCategoryDescendantIds,
  getEffectiveCategoryNavigationIds,
  getHeaderCategoryNavigationIds,
  getEffectivelyActiveCategoryIds,
} from "../lib/category-navigation.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("category schema and migration expose configurable navigation fields", async () => {
  const [schema, migration, hardeningMigration] = await Promise.all([
    read("prisma/schema.prisma"),
    read("prisma/migrations/20260908_add_category_navigation_config/migration.sql"),
    read("prisma/migrations/20260908_phase6_navigation_hardening/migration.sql"),
  ]);

  for (const field of ["isActive", "sortOrder", "showInHeader", "showInFooter", "featured"]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
    assert.match(migration, new RegExp(`"${field}"`));
  }
  assert.match(schema, /@@index\(\[isActive, showInHeader, sortOrder\]\)/);
  assert.match(schema, /@@index\(\[isActive, showInFooter, sortOrder\]\)/);
  assert.match(schema, /@@index\(\[isActive, featured, sortOrder\]\)/);
  assert.equal(CATEGORY_NAVIGATION_DEFAULTS.showInFooter, false);
  assert.match(schema, /showInFooter\s+Boolean\s+@default\(false\)/);
  assert.match(hardeningMigration, /ALTER COLUMN "showInFooter" SET DEFAULT false/);
});

const category = (id, parentId, overrides = {}) => ({
  id,
  parentId,
  name: `Category ${id}`,
  isActive: true,
  sortOrder: id,
  showInHeader: true,
  showInFooter: true,
  featured: false,
  ...overrides,
});

test("inactive ancestors hide every descendant from activation and navigation", () => {
  const categories = [
    category(1, null, { isActive: false }),
    category(2, 1),
    category(3, 2),
    category(4, null),
  ];

  assert.deepEqual([...getEffectivelyActiveCategoryIds(categories)], [4]);
  assert.deepEqual([...getEffectiveCategoryNavigationIds(categories, "header")], [4]);
  assert.deepEqual(getCategoryDescendantIds(categories, 1, new Set([4])), []);
});

test("placement visibility is inherited without changing activation", () => {
  const categories = [
    category(1, null, { showInFooter: false }),
    category(2, 1),
    category(3, null),
  ];

  assert.deepEqual([...getEffectivelyActiveCategoryIds(categories)], [1, 2, 3]);
  assert.deepEqual([...getEffectiveCategoryNavigationIds(categories, "footer")], [3]);
  assert.deepEqual(getCategoryDescendantIds(categories, 1), [1, 2]);
});

test("header navigation has no technology-specific category order", async () => {
  const header = await read("components/ecommarce/header.tsx");
  assert.doesNotMatch(header, /DESKTOP_CATEGORY_ORDER/);
  assert.match(header, /showInHeader/);
  assert.match(header, /sortOrder/);
  assert.match(header, /getHeaderCategoryNavigationIds/);
});

test("header roots include active children and grandchildren without individual placement flags", () => {
  const categories = [
    category(512, null, { name: "Food" }),
    category(513, 512, { name: "Fruits & Vegetables", showInHeader: false }),
    category(514, 513, { name: "Fruits", showInHeader: false }),
    category(516, 512, { name: "Meat & Fish", showInHeader: false }),
    category(517, 516, { name: "Chicken & Poultry", showInHeader: false }),
    category(600, 512, { isActive: false }),
    category(601, 600),
    category(700, null, { showInHeader: false }),
    category(701, 700),
    category(800, 999),
    category(900, 901),
    category(901, 900),
  ];
  assert.deepEqual([...getHeaderCategoryNavigationIds(categories)], [512, 513, 514, 516, 517]);
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
  assert.doesNotMatch(featured, /configured\.length > 0 \? configured : roots/);
});

test("inactive category products are gated across storefront and purchase paths", async () => {
  const paths = [
    "lib/storefront-home.ts",
    "lib/storefront-catalog.ts",
    "lib/storefront-product-detail.ts",
    "lib/search/server.ts",
    "lib/storefront-pc-builder.ts",
    "app/sitemap.ts",
    "app/api/products/route-core.ts",
    "app/api/products/[id]/route-core.ts",
    "app/api/cart/route-core.ts",
    "app/api/orders/route-core.ts",
    "app/api/compare/products/route.ts",
    "app/api/wishlist/route.ts",
    "app/api/products/top-selling/route.ts",
    "app/api/product-questions/route.ts",
    "lib/cart-reminder-notifications.ts",
    "lib/price-drop-alerts.ts",
  ];
  const sources = await Promise.all(paths.map(read));
  for (const source of sources) {
    assert.match(source, /EffectiveStorefrontCategory|effectiveCategoryIds|activeCategoryIds/);
  }
  assert.match(sources[6], /isCategoryEffectivelyActive/);
  assert.match(sources[7], /isCategoryEffectivelyActive/);
  assert.match(sources[8], /isCategoryEffectivelyActive/);
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
