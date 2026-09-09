import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  hasBookMetadata,
  parseBookMetadataInput,
  resolveCompatibleBookMetadata,
} from "../lib/book-metadata.ts";

const read = (file) => fs.readFileSync(file, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260908190000_decouple_book_metadata/migration.sql");
const compatibilityMigration = read("prisma/migrations/20260908200000_restore_book_compatibility/migration.sql");

function model(name) {
  const start = schema.indexOf(`model ${name} {`);
  assert.ok(start >= 0, `model ${name} must exist`);
  const match = schema.slice(start).match(/^model\s+\w+\s+\{[\s\S]*?\r?\n\}/);
  assert.ok(match, `model ${name} must have a closing brace`);
  return match[0];
}
test("Product keeps explicitly transitional writer and publisher columns for rollback compatibility", () => {
  const product = model("Product");
  assert.match(product, /writerId\s+Int\?/);
  assert.match(product, /publisherId\s+Int\?/);
  assert.match(product, /Phase 8 compatibility columns/);
  assert.match(product, /bookMetadata\s+BookMetadata\?/);
});

test("BookMetadata owns the one-to-one product and optional writer/publisher relations", () => {
  const metadata = model("BookMetadata");
  assert.match(metadata, /productId\s+Int\s+@unique/);
  assert.match(metadata, /product\s+Product\s+@relation\(fields: \[productId\]/);
  assert.match(metadata, /writer\s+Writer\?\s+@relation\(fields: \[writerId\]/);
  assert.match(metadata, /publisher\s+Publisher\?\s+@relation\(fields: \[publisherId\]/);
  assert.match(model("Writer"), /bookMetadata\s+BookMetadata\[\]/);
  assert.match(model("Publisher"), /bookMetadata\s+BookMetadata\[\]/);
});

test("forward repair preserves an additive compatibility window after the committed cutover", () => {
  const insertAt = migration.indexOf('INSERT INTO "BookMetadata"');
  const dropAt = migration.indexOf('DROP COLUMN "writerId"');
  assert.ok(insertAt >= 0 && dropAt > insertAt);
  assert.match(migration, /FROM "Product"/);
  assert.match(migration, /WHERE "writerId" IS NOT NULL OR "publisherId" IS NOT NULL/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.match(migration, /ON DELETE SET NULL/);
  assert.match(migration, /^BEGIN;/m);
  assert.match(migration, /^COMMIT;/m);
  assert.match(compatibilityMigration, /ADD COLUMN IF NOT EXISTS "writerId"/);
  assert.match(compatibilityMigration, /ADD COLUMN IF NOT EXISTS "publisherId"/);
  assert.doesNotMatch(compatibilityMigration, /DROP COLUMN/);
  assert.doesNotMatch(compatibilityMigration, /INSERT INTO "BookMetadata"/);
});

test("book metadata input is bounded to nullable positive relation ids", () => {
  assert.deepEqual(parseBookMetadataInput({ writerId: "12", publisherId: 4 }), {
    ok: true,
    value: { writerId: 12, publisherId: 4 },
  });
  assert.equal(parseBookMetadataInput({ writerId: -1 }).ok, false);
  assert.equal(parseBookMetadataInput({ publisherId: 1.2 }).ok, false);
  assert.equal(hasBookMetadata({ writerId: null, publisherId: null }), false);
  assert.equal(hasBookMetadata({ writerId: 1, publisherId: null }), true);
  assert.deepEqual(
    resolveCompatibleBookMetadata({
      legacy: { writerId: 4, publisherId: 8 },
      metadata: { writerId: 12, publisherId: null },
    }),
    { writerId: 12, publisherId: 8 },
  );
});

test("book metadata API is isolated behind BOOKS and product-management gates", () => {
  const route = read("app/api/book-metadata/[productId]/route.ts");
  const server = read("lib/book-metadata-server.ts");
  assert.match(route, /gateStoreFeature\("BOOKS"/);
  assert.match(route, /access\.has\("products\.manage"\)/);
  assert.match(route, /writeBookMetadataCompat/);
  assert.match(server, /tx\.bookMetadata\.upsert/);
  assert.match(server, /tx\.product\.update/);
  assert.match(route, /logActivity/);
  assert.match(route, /revalidateBookSurfaces/);

  for (const file of ["app/api/products/route-core.ts", "app/api/products/[id]/route-core.ts"]) {
    const source = read(file);
    assert.doesNotMatch(source, /\bwriterId\b/);
    assert.doesNotMatch(source, /\bpublisherId\b/);
    assert.doesNotMatch(source, /bookMetadata/);
  }
});

test("book, author and publisher surfaces are active only through feature gates", () => {
  assert.match(read("app/api/writers/route.ts"), /gateStoreFeature\(storefront \? "AUTHORS" : "BOOKS"/);
  assert.match(read("app/api/publishers/route.ts"), /gateStoreFeature\("BOOKS"/);
  assert.match(read("app/ecommerce/books/page.tsx"), /isFeatureEnabled\("BOOKS"\)/);
  assert.match(read("app/ecommerce/authors/page.tsx"), /isFeatureEnabled\("AUTHORS"\)/);
  assert.doesNotMatch(read("app/api/writers/route.ts"), /status: 410/);
  assert.doesNotMatch(read("app/api/publishers/route.ts"), /status: 410/);
  const features = read("lib/store-features.ts");
  assert.match(features, /BOOKS:[\s\S]*?defaultEnabled: false/);
  assert.match(features, /AUTHORS:[\s\S]*?dependencies: \["BOOKS"\]/);
});

test("book discovery and administration use the central feature boundary", () => {
  const visibility = read("lib/book-product-visibility-server.ts");
  assert.match(visibility, /isFeatureEnabled\("BOOKS"\)/);
  assert.match(visibility, /bookMetadata/);
  assert.match(visibility, /writerId/);
  assert.match(visibility, /publisherId/);
  for (const file of [
    "lib/storefront-catalog.ts",
    "lib/storefront-home.ts",
    "lib/storefront-flash-sale.ts",
    "lib/storefront-product-detail.ts",
    "lib/search/server.ts",
    "app/api/products/route-core.ts",
    "app/api/products/[id]/route-core.ts",
    "app/api/wishlist/route.ts",
    "app/api/cart/route-core.ts",
    "app/api/orders/route-core.ts",
    "app/api/compare/products/route.ts",
    "app/api/products/top-selling/route.ts",
    "app/sitemap.ts",
  ]) {
    assert.match(read(file), /getBookProductVisibilityWhere/, `${file} must enforce BOOKS discovery visibility`);
  }
  assert.match(read("components/management/ProductRelationsModal.tsx"), /Save Book Metadata/);
  assert.match(read("components/admin/Sidebar.tsx"), /requiredFeature: "BOOKS"/);
  assert.match(read("components/ecommarce/header.tsx"), /featureVisibility\.books/);
});

test("Phase 8 ships database verification, documentation and cumulative release wiring", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts["test:universal-phase8"], /book-module-decoupling/);
  assert.match(pkg.scripts["verify:book-metadata-db"], /verify-book-metadata/);
  assert.match(pkg.scripts["backfill:book-metadata"], /backfill-book-metadata/);
  assert.ok(pkg.scripts["verify:universal-phase8"]);
  assert.ok(fs.existsSync("docs/universal-ecommerce-phase8.md"));
  assert.ok(fs.existsSync("docs/universal-ecommerce/phase-8-book-metadata-removal-runbook.md"));
  assert.ok(fs.existsSync("tests/fixtures/phase8-legacy-schema.sql"));
  assert.ok(fs.existsSync(".github/workflows/universal-ecommerce-phase8.yml"));
  assert.equal(fs.existsSync(".github/workflows/universal-ecommerce-phase7.yml"), false);
  const workflow = read(".github/workflows/universal-ecommerce-phase8.yml");
  assert.match(workflow, /postgres:/);
  assert.match(workflow, /20260908190000_decouple_book_metadata\/migration\.sql/);
  assert.match(workflow, /20260908200000_restore_book_compatibility\/migration\.sql/);
  assert.match(workflow, /backfill:book-metadata/);
  assert.match(workflow, /verify:book-metadata-db/);
});
