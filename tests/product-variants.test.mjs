import assert from "node:assert/strict";
import test from "node:test";

import { normalizeVariantOptions } from "../lib/product-variants.ts";

test("duplicate variant option names are merged case-insensitively", () => {
  assert.deepEqual(
    normalizeVariantOptions([
      { name: "Type", values: ["DDR5"] },
      { name: " type ", values: ["DDR5", "DDR4"] },
    ]),
    [{ name: "Type", values: ["DDR5", "DDR4"] }],
  );
});
