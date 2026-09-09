import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  assertDemoSeedAllowed,
  isDemoSeedProfile,
  parseSeedProfile,
} from "../lib/seed-profile.ts";
import { getUniversalIdentityBackfill } from "../prisma/seed-data/universal.ts";

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
  assert.doesNotMatch(universalSeed, /TechHub|technology storefront|enforceTechOnlyStorefront/i);
  assert.doesNotMatch(universalSeed, /updateMany\([\s\S]*deleted:\s*true/);
  assert.doesNotMatch(universalSeed, /admin@example\.com|Demo123|admin123/);
});

test("existing blank identity is repaired without overwriting configured values", () => {
  assert.deepEqual(getUniversalIdentityBackfill({ storeName: null, siteTitle: null }), {
    storeName: "Online Store",
    siteTitle: "Online Store",
  });
  assert.deepEqual(
    getUniversalIdentityBackfill({ storeName: "", siteTitle: "Legacy Shop" }),
    { storeName: "Legacy Shop" },
  );
  assert.deepEqual(
    getUniversalIdentityBackfill({ storeName: "My Store", siteTitle: "" }),
    { siteTitle: "My Store" },
  );
  assert.deepEqual(
    getUniversalIdentityBackfill({ storeName: "My Store", siteTitle: "My Store" }),
    {},
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
  assert.match(workflow, /prisma db push --force-reset/);
  assert.match(workflow, /prisma db seed/);
  assert.match(workflow, /Seed universal baseline again/);
  assert.match(workflow, /verify-universal-seed\.ts/);
  assert.match(workflow, /test:universal-phase8/);
  assert.match(workflow, /universal-ecommerce-phase9\.test\.mjs/);
  assert.match(workflow, /npx tsc --noEmit/);
  assert.match(verifier, /known demo credential account/);
  assert.ok(fs.existsSync("docs/universal-ecommerce-phase9.md"));
});
