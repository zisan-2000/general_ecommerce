import test from "node:test";
import assert from "node:assert/strict";
import { serverHasCartLine } from "../lib/cart-line-identity.ts";

test("visiting cart after adding a complete build does not sync its components again", () => {
  const buildId = "pcb_12345678-1234-4123-8123-123456789abc";
  const localItems = Array.from({ length: 15 }, (_, index) => ({
    productId: index + 1,
    variantId: index + 101,
    pcBuildId: buildId,
    quantity: 1,
    bundleConfigurationKey: null,
  }));
  const serverItems = localItems.map((item) => ({
    ...item,
    lineKey: `pcbuild:${buildId}`,
  }));
  const missingItems = localItems.filter((item) => !serverHasCartLine(serverItems, item));
  assert.deepEqual(missingItems, []);
  // Cart refresh stores only bundle keys; build identity still has to round-trip.
  assert.ok(localItems.every((item) => serverHasCartLine(serverItems, { ...item })));
});

test("build rows, other builds, and standard companion quantities remain distinct", () => {
  const buildId = "pcb_12345678-1234-4123-8123-123456789abc";
  const buildRow = { productId: 1, variantId: 2, pcBuildId: buildId };
  const serverItems = [{ ...buildRow, lineKey: `pcbuild:${buildId}` }];
  assert.equal(serverHasCartLine(serverItems, { productId: 1, variantId: 2 }), false);
  assert.equal(serverHasCartLine(serverItems, {
    ...buildRow, pcBuildId: "pcb_87654321-1234-4123-8123-123456789abc",
  }), false);
  assert.equal(serverHasCartLine(serverItems, { ...buildRow, variantId: 3 }), false);
});

test("standard default variants and configured bundles keep their existing identity", () => {
  const serverItems = [
    { productId: 1, variantId: 2, lineKey: "standard" },
    { productId: 3, variantId: null, lineKey: "bundle:configuration-a" },
  ];
  assert.equal(serverHasCartLine(serverItems, { productId: "1", variantId: "2" }), true);
  assert.equal(serverHasCartLine(serverItems, { productId: 1, variantId: null }), true);
  assert.equal(serverHasCartLine(serverItems, {
    productId: 3, bundleConfigurationKey: "bundle:configuration-a",
  }), true);
  assert.equal(serverHasCartLine(serverItems, {
    productId: 3, bundleConfigurationKey: "bundle:configuration-b",
  }), false);
});
