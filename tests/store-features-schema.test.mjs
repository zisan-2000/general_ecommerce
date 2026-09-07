import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("StoreFeature schema and migration are additive and strongly keyed", async () => {
  const [schema, migration] = await Promise.all([
    read("prisma/schema.prisma"),
    read(
      "prisma/migrations/20260907_add_store_feature_registry/migration.sql",
    ),
  ]);

  const featureEnum =
    schema.match(/enum StoreFeatureKey\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const featureModel =
    schema.match(/model StoreFeature\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  for (const key of [
    "PC_BUILDER",
    "BOOKS",
    "AUTHORS",
    "COMPARE",
    "DIGITAL_PRODUCTS",
    "SERVICE_PRODUCTS",
    "BUNDLES",
  ]) {
    assert.match(featureEnum, new RegExp(`\\b${key}\\b`));
    assert.match(migration, new RegExp(`'${key}'`));
  }
  assert.match(featureModel, /key\s+StoreFeatureKey\s+@unique/);
  assert.match(featureModel, /enabled\s+Boolean\s+@default\(false\)/);
  assert.match(migration, /CREATE TABLE "StoreFeature"/);
  assert.match(migration, /CREATE UNIQUE INDEX "StoreFeature_key_key"/);
  assert.doesNotMatch(migration, /\b(?:DROP|DELETE|UPDATE|INSERT)\b/i);
});

test("backfill is idempotent and verifier is read-only", async () => {
  const [backfill, verifier] = await Promise.all([
    read("scripts/backfill-store-features.ts"),
    read("scripts/verify-store-features.ts"),
  ]);

  assert.match(backfill, /storeFeature\.createMany/);
  assert.match(backfill, /skipDuplicates:\s*true/);
  assert.match(backfill, /DEFAULT_STORE_FEATURES/);
  assert.doesNotMatch(backfill, /storeFeature\.(?:update|delete|upsert)/);

  assert.match(verifier, /storeFeature\.findMany/);
  assert.match(verifier, /dependencyConflicts/);
  assert.match(verifier, /process\.exitCode = 1/);
  assert.doesNotMatch(
    verifier,
    /storeFeature\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)/,
  );
});

test("runtime reads and writes go through the central cached resolver", async () => {
  const [server, route] = await Promise.all([
    read("lib/store-features-server.ts"),
    read("app/api/admin/store-features/route.ts"),
  ]);

  assert.match(server, /unstable_cache/);
  assert.match(server, /tags:\s*\[STORE_FEATURE_CACHE_TAG\]/);
  assert.match(server, /export async function isFeatureEnabled/);
  assert.match(server, /export async function setStoreFeatureEnabled/);
  assert.match(server, /pg_advisory_xact_lock/);
  assert.match(server, /validateStoreFeatureTransition/);
  assert.match(server, /revalidateStoreFeatureCache\(\)/);
  assert.match(server, /revalidateTag\(tag, \{ expire: 0 \}\)/);
  for (const tag of [
    "store-features",
    "storefront-home",
    "storefront-catalog",
    "storefront-product-detail",
    "products",
    "flash-sales",
    "categories",
    "site-settings",
  ]) {
    assert.ok(server.includes(`"${tag}"`), `missing cache tag ${tag}`);
  }

  assert.match(route, /access\.has\("settings\.manage"\)/);
  assert.match(route, /parseStoreFeatureUpdate/);
  assert.match(route, /setStoreFeatureEnabled/);
  assert.match(route, /StoreFeatureTransitionError/);
  assert.match(route, /status:\s*409/);
  assert.match(route, /status:\s*503/);
  assert.match(route, /action:\s*"update_store_feature"/);
  assert.doesNotMatch(route, /prisma\.storeFeature/);
});

test("Phase 2 commands are wired for tests, backfill and database verification", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const scripts = packageJson.scripts;

  for (const name of [
    "test:universal-phase2",
    "verify:universal-phase2",
    "backfill:store-features",
    "verify:store-features-db",
  ]) {
    assert.equal(typeof scripts[name], "string", `missing npm script: ${name}`);
  }
  assert.match(scripts["verify:universal-phase2"], /verify:universal-phase1/);
  assert.match(scripts["verify:universal-phase2"], /test:universal-phase2/);
});
