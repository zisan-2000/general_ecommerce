import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  LEGACY_TECH_BANNER_TITLES,
  LEGACY_TECH_BRAND_SLUGS,
  LEGACY_TECH_CATEGORY_SLUGS,
} from "../scripts/legacy-tech-demo-state.ts";
import {
  STOREFRONT_BANNERS,
  STOREFRONT_BRANDS,
  STOREFRONT_CATEGORIES,
} from "../prisma/seed-data/storefront/constants.ts";

const read = (file) => fs.readFileSync(file, "utf8");

test("cleanup fingerprints are derived from the repository's legacy demo seed", () => {
  assert.deepEqual(
    new Set(LEGACY_TECH_CATEGORY_SLUGS),
    new Set(STOREFRONT_CATEGORIES.map((category) => category.slug)),
  );
  assert.deepEqual(
    new Set(LEGACY_TECH_BRAND_SLUGS),
    new Set(STOREFRONT_BRANDS.map((brand) => brand.slug)),
  );
  assert.deepEqual(
    new Set(LEGACY_TECH_BANNER_TITLES),
    new Set(STOREFRONT_BANNERS.map((banner) => banner.title)),
  );
});

test("audit is read-only", () => {
  const source = read("scripts/audit-legacy-tech-demo.ts");
  assert.doesNotMatch(source, /updateMany|deleteMany|\.update\(|\.delete\(/);
  assert.match(source, /Dry-run only/);
});

test("reset is explicitly guarded and preserves historical rows", () => {
  const source = read("scripts/reset-legacy-tech-demo.ts");
  assert.match(source, /ALLOW_UNIVERSAL_RESET/);
  assert.match(source, /looksLikeLegacyTechDemo/);
  assert.match(source, /\$transaction/);
  assert.doesNotMatch(source, /deleteMany|\.delete\(/);
  assert.match(source, /deleted:\s*true/);
  assert.match(source, /available:\s*false/);
  assert.match(source, /isActive:\s*false/);
  assert.match(source, /feature:\s*false/);
  assert.match(source, /PC_BUILDER/);
  assert.match(source, /enabled:\s*false/);
  assert.match(source, /SITE_SETTINGS_DEFAULTS/);
  assert.match(source, /seedUniversalStorefront/);
});

test("reset verification rejects remaining tech storefront state", () => {
  const state = read("scripts/legacy-tech-demo-state.ts");
  const verifier = read("scripts/verify-legacy-tech-demo-reset.ts");
  assert.match(state, /TechHub identity is still configured/);
  assert.match(state, /legacy tech categories are still storefront-visible/);
  assert.match(state, /legacy tech products are still available/);
  assert.match(state, /legacy tech demo banners are still active/);
  assert.match(state, /PC Builder is not explicitly disabled/);
  assert.match(verifier, /assertLegacyTechDemoReset/);
});
