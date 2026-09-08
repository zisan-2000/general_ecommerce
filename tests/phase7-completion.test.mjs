import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("root layout provides runtime currency settings and locale-derived structured-data country", async () => {
  const layout = await read("app/layout.tsx");
  assert.match(layout, /storefrontSettings=\{\{/);
  assert.match(layout, /currency:\s*siteSettings\.currency/);
  assert.match(layout, /currencyPosition:\s*siteSettings\.currencyPosition/);
  assert.match(layout, /locale:\s*siteSettings\.locale/);
  assert.match(layout, /new Intl\.Locale\(locale\)\.region/);
  assert.doesNotMatch(layout, /addressCountry:\s*["']BD["']/);
});

test("shared storefront product card uses configured currency rather than a hardcoded taka formatter", async () => {
  const card = await read("components/ecommarce/ProductCard.tsx");
  assert.match(card, /useStorefrontSettings/);
  assert.match(card, /formatCurrency\(product\.price\)/);
  assert.match(card, /formatCurrency\(savingsAmount\)/);
  assert.doesNotMatch(card, /defaultFormatPrice/);
  assert.doesNotMatch(card, /৳/);
});

test("storefront settings provider honors currency code, placement and locale", async () => {
  const provider = await read("providers/storefront-settings-provider.tsx");
  assert.match(provider, /currencyDisplay:\s*["']narrowSymbol["']/);
  assert.match(provider, /currencyPosition === ["']AFTER["']/);
  assert.match(provider, /new Intl\.NumberFormat\(safeLocale/);
  assert.match(provider, /formatCurrency/);
});

test("Phase 7 guarantees remain enforced by the cumulative successor CI", async () => {
  const workflow = await read(".github/workflows/universal-ecommerce-phase8.yml");
  const typecheck = await read("scripts/typecheck-universal.mjs");
  assert.match(workflow, /npm ci --legacy-peer-deps --ignore-scripts/);
  assert.match(workflow, /test:universal-phase7/);
  assert.match(workflow, /phase7-completion\.test\.mjs/);
  assert.match(workflow, /npx tsc --noEmit/);
  assert.match(typecheck, /ALLOWED_BASELINE_FILES/);
  assert.match(typecheck, /new or unrecognized diagnostics detected/);
});
