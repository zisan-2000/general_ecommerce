import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseSiteSettingsInput,
  resolveSiteSettings,
  SITE_SETTINGS_DEFAULTS,
} from "../lib/site-settings.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 7 schema and migration add identity and SEO fields without removing legacy fields", async () => {
  const [schema, migration] = await Promise.all([
    read("prisma/schema.prisma"),
    read("prisma/migrations/20260908_phase7_store_identity_seo/migration.sql"),
  ]);
  for (const field of [
    "storeName",
    "storeTagline",
    "defaultSeoTitle",
    "defaultSeoDescription",
    "defaultSeoKeywords",
    "defaultOgImage",
    "favicon",
    "currency",
    "currencyPosition",
    "timezone",
    "locale",
    "storeType",
  ]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
    assert.match(migration, new RegExp(`"${field}"`));
  }
  assert.match(schema, /siteTitle\s+String\?/);
  assert.doesNotMatch(migration, /DROP\s+(COLUMN|TABLE)/i);
});

test("site settings input normalizes identity, keywords and localization", () => {
  const parsed = parseSiteSettingsInput({
    storeName: "  Acme   Market  ",
    storeTagline: " Everything you need ",
    defaultSeoKeywords: ["Fashion", "fashion", "New arrivals"],
    currency: "usd",
    currencyPosition: "after",
    timezone: "America/New_York",
    locale: "en-US",
    storeType: "fashion",
    logo: "/logo.png",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.storeName, "Acme Market");
  assert.deepEqual(parsed.value.defaultSeoKeywords, ["Fashion", "New arrivals"]);
  assert.equal(parsed.value.currency, "USD");
  assert.equal(parsed.value.currencyPosition, "AFTER");
  assert.equal(parsed.value.storeType, "FASHION");
});

test("site settings validation rejects invalid locale, timezone, currency and store type", () => {
  for (const payload of [
    { storeName: "Store", currency: "TAKA" },
    { storeName: "Store", timezone: "Dhaka/Nowhere" },
    { storeName: "Store", locale: "not_a_locale" },
    { storeName: "Store", storeType: "PC_BUILDER" },
  ]) {
    assert.equal(parseSiteSettingsInput(payload).ok, false);
  }
});

test("identity resolver preserves legacy data and has neutral catalog-driven defaults", () => {
  const legacy = resolveSiteSettings(
    { siteTitle: "Legacy Shop", footerDescription: "Legacy description" },
    ["Clothing", "Groceries"],
  );
  assert.equal(legacy.storeName, "Legacy Shop");
  assert.equal(legacy.siteTitle, "Legacy Shop");
  assert.equal(legacy.siteDescription, "Legacy description");
  assert.ok(legacy.defaultSeoKeywords.includes("Clothing"));
  assert.equal(legacy.storeType, "GENERAL");
  assert.doesNotMatch(
    `${SITE_SETTINGS_DEFAULTS.storeName} ${SITE_SETTINGS_DEFAULTS.defaultSeoDescription}`,
    /computer|technology|gadget|laptop/i,
  );
});

test("admin/API surface validates configuration, dual-writes identity and invalidates SEO caches", async () => {
  const [form, route] = await Promise.all([
    read("components/Settings/SiteSettingsForm.tsx"),
    read("app/api/site/route.ts"),
  ]);
  for (const field of [
    "storeName",
    "storeTagline",
    "defaultSeoTitle",
    "defaultSeoDescription",
    "defaultSeoKeywords",
    "defaultOgImage",
    "favicon",
    "currencyPosition",
    "timezone",
    "locale",
    "storeType",
  ]) {
    assert.match(form, new RegExp(field));
  }
  assert.match(route, /parseSiteSettingsInput/);
  assert.match(route, /siteTitle:\s*parsed\.value\.storeName/);
  assert.match(route, /revalidateTag\("site-settings",\s*"max"\)/);
  assert.match(route, /settings\.manage/);
});

test("metadata, manifest and structured data resolve configurable identity", async () => {
  const [seo, home, layout, manifest] = await Promise.all([
    read("lib/seo.ts"),
    read("app/page.tsx"),
    read("app/layout.tsx"),
    read("app/manifest.ts"),
  ]);
  assert.match(seo, /defaultSeoKeywords/);
  assert.match(seo, /settings\.favicon/);
  assert.match(seo, /settings\.ogImage/);
  assert.match(home, /settings\.defaultSeoTitle/);
  assert.match(layout, /siteSettings\.locale/);
  assert.match(layout, /siteSettings\.facebookLink/);
  assert.match(manifest, /settings\.favicon/);
  assert.doesNotMatch(seo, /computer components|technology products|laptops/i);
});

test("general storefront copy is vertical-neutral while modules remain independently gated", async () => {
  const paths = [
    "app/page.tsx",
    "app/ecommerce/about/page.tsx",
    "app/ecommerce/contact/page.tsx",
    "app/ecommerce/contact/ContactPageClient.tsx",
    "app/ecommerce/products/page.tsx",
    "app/ecommerce/categories/page.tsx",
    "app/ecommerce/brands/page.tsx",
    "app/ecommerce/blogs/page.tsx",
    "app/ecommerce/faq/page.tsx",
    "app/ecommerce/terms/page.tsx",
    "app/ecommerce/shipping/page.tsx",
    "app/ecommerce/flash-sale/page.tsx",
    "components/ecommarce/footer.tsx",
  ];
  const sources = await Promise.all(paths.map(read));
  for (const source of sources) {
    assert.doesNotMatch(source, /computers?|laptops?|gadgets?|technology products?/i);
  }
  const storeFeatures = await read("lib/store-features.ts");
  assert.match(storeFeatures, /PC_BUILDER/);
});

test("Phase 7 ships idempotent rollout tools and a cumulative release gate", async () => {
  const [backfill, verifier, docs, pkg] = await Promise.all([
    read("scripts/backfill-store-identity.ts"),
    read("scripts/verify-store-identity.ts"),
    read("docs/universal-ecommerce-phase7.md"),
    read("package.json"),
  ]);
  assert.match(backfill, /!row\.storeName/);
  assert.match(verifier, /Multiple site settings rows/);
  assert.match(docs, /storeType.*descriptive only/i);
  assert.match(pkg, /verify:universal-phase7/);
  assert.match(pkg, /verify:universal-phase6.*test:universal-phase7/);
});
