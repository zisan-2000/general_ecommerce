import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { hasBookMetadata, parseBookMetadataInput } from "../lib/book-metadata.ts";

const read = (file) => fs.readFileSync(file, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260908190000_decouple_book_metadata/migration.sql");

function model(name) {
  const start = schema.indexOf(`model ${name} {`);
  assert.ok(start >= 0, `model ${name} must exist`);
  const rest = schema.slice(start);
  const end = rest.indexOf("\n}\n");
  assert.ok(end >= 0, `model ${name} must have a closing brace`);
  return rest.slice(0, end + 2);
}
test("generic Product core has no direct writer or publisher columns", () => {
  const product = model("Product");
  assert.doesNotMatch(product, /\bwriterId\b/);
  assert.doesNotMatch(product, /\bpublisherId\b/);
  assert.doesNotMatch(product, /^\s*writer\s+Writer/m);
  assert.doesNotMatch(product, /^\s*publisher\s+Publisher/m);
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

test("migration copies legacy relations before dropping Product columns", () => {
  const insertAt = migration.indexOf('INSERT INTO "BookMetadata"');
  const dropAt = migration.indexOf('DROP COLUMN "writerId"');
  assert.ok(insertAt >= 0 && dropAt > insertAt);
  assert.match(migration, /FROM "Product"/);
  assert.match(migration, /WHERE "writerId" IS NOT NULL OR "publisherId" IS NOT NULL/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.match(migration, /ON DELETE SET NULL/);
  assert.match(migration, /^BEGIN;/m);
  assert.match(migration, /^COMMIT;/m);
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
});

test("book metadata API is isolated behind BOOKS and product-management gates", () => {
  const route = read("app/api/book-metadata/[productId]/route.ts");
  assert.match(route, /gateStoreFeature\("BOOKS"/);
  assert.match(route, /access\.has\("products\.manage"\)/);
  assert.match(route, /prisma\.bookMetadata\.upsert/);
  assert.match(route, /parseBookMetadataInput/);

  for (const file of ["app/api/products/route-core.ts", "app/api/products/[id]/route-core.ts"]) {
    const source = read(file);
    assert.doesNotMatch(source, /\bwriterId\b/);
    assert.doesNotMatch(source, /\bpublisherId\b/);
    assert.doesNotMatch(source, /bookMetadata/);
  }
});

test("legacy author/publisher endpoints remain dormant and module dependencies stay intact", () => {
  assert.match(read("app/api/writers/route.ts"), /status: 410/);
  assert.match(read("app/api/publishers/route.ts"), /status: 410/);
  const features = read("lib/store-features.ts");
  assert.match(features, /BOOKS:[\s\S]*?defaultEnabled: false/);
  assert.match(features, /AUTHORS:[\s\S]*?dependencies: \["BOOKS"\]/);
});

test("Phase 8 ships database verification, documentation and cumulative release wiring", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts["test:universal-phase8"], /book-module-decoupling/);
  assert.match(pkg.scripts["verify:book-metadata-db"], /verify-book-metadata/);
  assert.ok(pkg.scripts["verify:universal-phase8"]);
  assert.ok(fs.existsSync("docs/universal-ecommerce-phase8.md"));
  assert.ok(fs.existsSync(".github/workflows/universal-ecommerce-phase8.yml"));
  assert.equal(fs.existsSync(".github/workflows/universal-ecommerce-phase7.yml"), false);
});
