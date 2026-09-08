import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CORE_COMMERCE_CAPABILITIES,
  DEFAULT_STORE_FEATURES,
  disabledProductTypes,
  isProductTypeEnabled,
  parseStoreFeatureUpdate,
  resolveStoreFeatures,
  STORE_FEATURE_KEYS,
  validateStoreFeatureTransition,
} from "../lib/store-features.ts";

test("feature registry contains every approved optional module", () => {
  assert.deepEqual(STORE_FEATURE_KEYS, [
    "PC_BUILDER",
    "BOOKS",
    "AUTHORS",
    "COMPARE",
    "DIGITAL_PRODUCTS",
    "SERVICE_PRODUCTS",
    "BUNDLES",
  ]);
});

test("missing rows preserve the current technology storefront behavior", () => {
  const features = resolveStoreFeatures([]);

  assert.deepEqual(DEFAULT_STORE_FEATURES, {
    PC_BUILDER: true,
    BOOKS: false,
    AUTHORS: false,
    COMPARE: true,
    DIGITAL_PRODUCTS: true,
    SERVICE_PRODUCTS: true,
    BUNDLES: true,
  });
  for (const key of STORE_FEATURE_KEYS) {
    assert.equal(features[key].enabled, DEFAULT_STORE_FEATURES[key]);
    assert.equal(features[key].source, "default");
  }
});

test("database rows override defaults without bypassing dependencies", () => {
  const blocked = resolveStoreFeatures([
    { key: "BOOKS", enabled: false },
    { key: "AUTHORS", enabled: true },
  ]);
  assert.equal(blocked.AUTHORS.configuredEnabled, true);
  assert.equal(blocked.AUTHORS.enabled, false);
  assert.deepEqual(blocked.AUTHORS.blockedBy, ["BOOKS"]);

  const enabled = resolveStoreFeatures([
    { key: "BOOKS", enabled: true },
    { key: "AUTHORS", enabled: true },
  ]);
  assert.equal(enabled.BOOKS.enabled, true);
  assert.equal(enabled.AUTHORS.enabled, true);
});

test("PC Builder and bundles fail closed when required core capabilities are absent", () => {
  const capabilities = {
    ...DEFAULT_CORE_COMMERCE_CAPABILITIES,
    INVENTORY: false,
    PHYSICAL_PRODUCTS: false,
  };
  const features = resolveStoreFeatures([], capabilities);

  assert.equal(features.PC_BUILDER.enabled, false);
  assert.deepEqual(features.PC_BUILDER.blockedBy, [
    "PHYSICAL_PRODUCTS",
    "INVENTORY",
  ]);
  assert.equal(features.BUNDLES.enabled, false);
  assert.deepEqual(features.BUNDLES.blockedBy, ["PHYSICAL_PRODUCTS"]);
});

test("transition validation rejects unmet prerequisites and active dependents", () => {
  const defaults = resolveStoreFeatures([]);
  const authorsOn = validateStoreFeatureTransition(defaults, "AUTHORS", true);
  assert.equal(authorsOn.ok, false);
  if (!authorsOn.ok) {
    assert.equal(authorsOn.code, "FEATURE_DEPENDENCY_UNMET");
    assert.deepEqual(authorsOn.blockedBy, ["BOOKS"]);
  }

  const booksAndAuthors = resolveStoreFeatures([
    { key: "BOOKS", enabled: true },
    { key: "AUTHORS", enabled: true },
  ]);
  const booksOff = validateStoreFeatureTransition(
    booksAndAuthors,
    "BOOKS",
    false,
  );
  assert.equal(booksOff.ok, false);
  if (!booksOff.ok) {
    assert.equal(booksOff.code, "FEATURE_DEPENDENT_ACTIVE");
    assert.deepEqual(booksOff.blockedBy, ["AUTHORS"]);
  }
});

test("valid transitions return a complete next registry", () => {
  const current = resolveStoreFeatures([]);
  const booksOn = validateStoreFeatureTransition(current, "BOOKS", true);
  assert.equal(booksOn.ok, true);
  if (booksOn.ok) {
    assert.equal(booksOn.next.BOOKS.enabled, true);
    assert.equal(booksOn.next.AUTHORS.enabled, false);
  }
});

test("feature update input accepts only a known key and boolean state", () => {
  assert.deepEqual(parseStoreFeatureUpdate({ key: "COMPARE", enabled: false }), {
    ok: true,
    value: { key: "COMPARE", enabled: false },
  });
  assert.equal(parseStoreFeatureUpdate(null).ok, false);
  assert.equal(
    parseStoreFeatureUpdate({ key: "UNKNOWN", enabled: true }).ok,
    false,
  );
  assert.equal(
    parseStoreFeatureUpdate({ key: "COMPARE", enabled: "false" }).ok,
    false,
  );
});

test("product types are controlled only by their approved optional modules", () => {
  const defaults = resolveStoreFeatures([]);
  assert.equal(isProductTypeEnabled("PHYSICAL", defaults), true);
  assert.equal(isProductTypeEnabled("DIGITAL", defaults), true);

  const verticalStore = resolveStoreFeatures([
    { key: "DIGITAL_PRODUCTS", enabled: false },
    { key: "SERVICE_PRODUCTS", enabled: false },
    { key: "BUNDLES", enabled: false },
  ]);
  assert.deepEqual(disabledProductTypes(verticalStore), [
    "DIGITAL",
    "SERVICE",
    "BUNDLE",
  ]);
  assert.equal(isProductTypeEnabled("PHYSICAL", verticalStore), true);
  assert.equal(isProductTypeEnabled("DIGITAL", verticalStore), false);
  assert.equal(isProductTypeEnabled("SERVICE", verticalStore), false);
  assert.equal(isProductTypeEnabled("BUNDLE", verticalStore), false);
});
