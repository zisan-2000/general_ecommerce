import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  assertDemoSeedAllowed,
  isDemoSeedProfile,
  parseSeedProfile,
} from "../lib/seed-profile.ts";
import { getUniversalSettingsBackfill } from "../prisma/seed-data/universal.ts";
import {
  parseStorePreset,
  STORE_PRESET_KEYS,
  STORE_PRESETS,
} from "../prisma/seed-data/presets.ts";

const read = (file) => fs.readFileSync(file, "utf8");

const universalSeed = read("prisma/seed-data/universal.ts");
const prismaConfig = read("prisma.config.ts");
const legacySeed = read("prisma/seed.ts");
const demoRunner = read("scripts/run-demo-seed.mjs");

test("universal is the safe default profile and demo profiles require explicit opt-in", () => {
  assert.equal(parseSeedProfile(undefined), "universal");
  assert.equal(parseSeedProfile("technology-demo"), "technology-demo");
  assert.equal(isDemoSeedProfile("full-demo"), true);
  assert.equal(isDemoSeedProfile("universal"), false);
  assert.throws(() => parseSeedProfile("unknown"), /Unsupported SEED_PROFILE/);
  assert.throws(
    () => assertDemoSeedAllowed("full-demo", {}),
    /ALLOW_DEMO_CREDENTIALS=true/,
  );
  assert.throws(
    () =>
      assertDemoSeedAllowed("full-demo", {
        ALLOW_DEMO_CREDENTIALS: "true",
      }),
    /ALLOW_DESTRUCTIVE_DEMO_SEED=true/,
  );
  assert.doesNotThrow(() =>
    assertDemoSeedAllowed("full-demo", {
      ALLOW_DEMO_CREDENTIALS: "true",
      ALLOW_DESTRUCTIVE_DEMO_SEED: "true",
    }),
  );
});

test("Prisma default seed points only at the non-destructive universal runner", () => {
  assert.match(prismaConfig, /seed:\s*"tsx prisma\/seed-universal\.ts"/);
  assert.doesNotMatch(prismaConfig, /prisma\/seed\.ts/);
});

test("universal storefront seed is vertical-neutral and preserves existing administrator state", () => {
  assert.match(universalSeed, /SITE_SETTINGS_DEFAULTS/);
  assert.match(universalSeed, /storeType:\s*SITE_SETTINGS_DEFAULTS\.storeType/);
  assert.match(universalSeed, /skipDuplicates:\s*true/);
  assert.match(universalSeed, /existingSettings/);
  assert.doesNotMatch(universalSeed, /category\.upsert/);
  assert.match(universalSeed, /category\.createMany/);
  assert.doesNotMatch(universalSeed, /TechHub|technology storefront|enforceTechOnlyStorefront/i);
  assert.doesNotMatch(universalSeed, /updateMany\([\s\S]*deleted:\s*true/);
  assert.doesNotMatch(universalSeed, /admin@example\.com|Demo123|admin123/);
});

test("all approved vertical presets configure identity, modules, categories and attributes", () => {
  assert.deepEqual(STORE_PRESET_KEYS, ["tech", "fashion", "grocery", "book"]);
  assert.equal(parseStorePreset("TECH"), "tech");
  assert.throws(() => parseStorePreset("unknown"), /STORE_PRESET must be one of/);

  for (const key of STORE_PRESET_KEYS) {
    const preset = STORE_PRESETS[key];
    assert.ok(preset.categories.length >= 5, `${key} requires useful navigation defaults`);
    assert.ok(preset.attributes.length >= 4, `${key} requires attribute mappings`);
  }
  assert.equal(STORE_PRESETS.tech.features.PC_BUILDER, true);
  assert.equal(STORE_PRESETS.fashion.features.PC_BUILDER, false);
  assert.equal(STORE_PRESETS.grocery.features.BOOKS, false);
  assert.equal(STORE_PRESETS.book.features.BOOKS, true);
  assert.equal(STORE_PRESETS.book.features.AUTHORS, true);
});

test("known demo credentials are disabled without deleting historical users", () => {
  const safety = read("lib/demo-credential-safety.ts");
  const repair = read("scripts/disable-known-demo-credentials.ts");
  const auth = read("lib/auth.ts");
  const reset = read("scripts/reset-legacy-tech-demo.ts");
  assert.match(safety, /passwordHash:\s*null/);
  assert.match(safety, /banned:\s*true/);
  assert.doesNotMatch(safety, /deleteMany|\.delete\(/);
  assert.match(repair, /ALLOW_DEMO_CREDENTIAL_DISABLE/);
  assert.match(auth, /user\.banned/);
  assert.match(auth, /token\.blocked/);
  assert.match(reset, /disableKnownDemoCredentials/);
});

test("a squashed migration baseline supports reusable clean installations", () => {
  const config = read("prisma.config.ts");
  const baseline = read("prisma/migrations-release/00000000000000_squashed_baseline/migration.sql");
  assert.match(config, /path:\s*"prisma\/migrations-release"/);
  assert.match(baseline, /CREATE TABLE "Product"/);
  assert.match(baseline, /CREATE TABLE "sitesettings"/);
  assert.match(baseline, /CREATE TABLE "PcBuildCartItem"/);
  assert.match(baseline, /CREATE TABLE "PcBuilderSavedBuild"/);
});

test("missing legacy runtime settings are repaired without overwriting configured values", () => {
  assert.deepEqual(
    getUniversalSettingsBackfill({
      storeName: null,
      siteTitle: null,
      currency: null,
      currencyPosition: null,
      timezone: null,
      locale: null,
      storeType: null,
    }),
    {
      storeName: "Online Store",
      siteTitle: "Online Store",
      currency: "BDT",
      currencyPosition: "BEFORE",
      timezone: "Asia/Dhaka",
      locale: "en-BD",
      storeType: "GENERAL",
    },
  );

  assert.deepEqual(
    getUniversalSettingsBackfill({
      storeName: "Legacy Shop",
      siteTitle: "Legacy Shop",
      currency: "USD",
      currencyPosition: "AFTER",
      timezone: "America/New_York",
      locale: "en-US",
      storeType: "FASHION",
    }),
    {},
  );

  assert.deepEqual(
    getUniversalSettingsBackfill({
      storeName: "",
      siteTitle: "Legacy Shop",
      currency: "",
      currencyPosition: "",
      timezone: "",
      locale: "",
      storeType: "",
    }),
    {
      storeName: "Legacy Shop",
      currency: "BDT",
      currencyPosition: "BEFORE",
      timezone: "Asia/Dhaka",
      locale: "en-BD",
      storeType: "GENERAL",
    },
  );
});

test("legacy full demo remains available but is no longer an implicit production seed", () => {
  assert.match(legacySeed, /seedStorefrontDemo/);
  assert.match(demoRunner, /ALLOW_DEMO_CREDENTIALS/);
  assert.match(demoRunner, /ALLOW_DESTRUCTIVE_DEMO_SEED/);
  assert.match(demoRunner, /prisma\/seed\.ts/);
});

test("Phase 9 includes live database verification and a cumulative Phase 1-9 release gate", () => {
  const workflow = read(".github/workflows/universal-ecommerce-phase9.yml");
  const verifier = read("scripts/verify-universal-seed.ts");
  assert.match(workflow, /postgres:/);
  assert.match(workflow, /prisma migrate deploy/);
  assert.doesNotMatch(workflow, /prisma db push --force-reset/);
  assert.match(workflow, /prisma db seed/);
  assert.match(workflow, /Seed universal baseline again/);
  assert.match(workflow, /Repair simulated legacy settings/);
  assert.match(workflow, /Verify repaired legacy settings/);
  assert.match(workflow, /verify-universal-seed\.ts/);
  assert.match(workflow, /test:universal-phase8/);
  assert.match(workflow, /npm run test:universal-phase9/);
  assert.match(workflow, /npx tsc --noEmit/);
  assert.match(workflow, /STORE_PRESET: tech/);
  assert.match(workflow, /STORE_PRESET: fashion/);
  assert.match(workflow, /STORE_PRESET: grocery/);
  assert.match(workflow, /STORE_PRESET: book/);
  assert.match(workflow, /disable:known-demo-credentials/);
  assert.match(verifier, /known demo credential account/);
  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["test:universal-phase9"]);
  assert.ok(pkg.scripts["verify:universal-phase9"]);
  assert.match(pkg.scripts["verify:universal-phase8"], /clean:next-dev-types/);
  assert.ok(pkg.scripts["seed:preset"]);
  assert.ok(pkg.scripts["resolve:phase9-baseline"]);
  assert.ok(fs.existsSync("docs/universal-ecommerce-phase9.md"));
});
