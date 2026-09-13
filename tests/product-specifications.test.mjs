import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getSpecificationPreset,
  mergeSpecificationGroups,
  parseSpecificationGroupsInput,
  parseSpecificationText,
} from "../lib/product-specifications.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("laptop and desktop presets create editable empty generic fields", () => {
  const laptop = getSpecificationPreset("laptop");
  const desktop = getSpecificationPreset("desktop");

  assert.equal(laptop[0].name, "General");
  assert.equal(laptop.find((group) => group.name === "Processor").items.length, 8);
  assert.equal(laptop.find((group) => group.name === "Warranty").items[1].label, "Warranty Period");
  assert.equal(desktop.find((group) => group.name === "Motherboard").items[2].label, "Chipset");
  assert.ok(laptop.every((group) => group.items.every((item) => item.value === "")));
});

test("parser supports explicit and simple groups, first-colon values, duplicates, and warnings", () => {
  const parsed = parseSpecificationText(`###GROUP###
General
Brand: Dell
Support URL: https://example.com:8443/help
Brand: Dell Bangladesh

###GROUP###
Processor
Processor Model: Core i5-1335U
: invalid

Empty Group`);

  assert.equal(parsed.itemCount, 4);
  assert.deepEqual(parsed.groups.map((group) => group.name), ["General", "Processor"]);
  assert.equal(parsed.groups[0].items[1].value, "https://example.com:8443/help");
  assert.equal(parsed.groups[0].items.filter((item) => item.label === "Brand").length, 2);
  assert.equal(parsed.warnings.length, 2);
});

test("fill-empty preserves values while aliases fill matches and create missing fields", () => {
  const current = getSpecificationPreset("laptop");
  current.find((group) => group.name === "General").items[0].value = "Existing Brand";

  const incoming = parseSpecificationText(`General
Brand: New Brand
MIL-STD Certification: MIL-STD-810H

Processor
Generation: 13th Gen
Core: 10

Memory
RAM Bus: 3200MHz

Display
Screen Size: 15.6 Inch

Software
OS: Windows 11`).groups;

  const result = mergeSpecificationGroups(current, incoming, "fill-empty");
  assert.equal(result[0].items[0].value, "Existing Brand");
  assert.equal(result[0].items.at(-1).label, "MIL-STD Certification");
  assert.equal(result.find((group) => group.name === "Processor").items.find((item) => item.label === "Processor Generation").value, "13th Gen");
  assert.equal(result.find((group) => group.name === "Memory").items.find((item) => item.label === "RAM Bus Speed").value, "3200MHz");
  assert.equal(result.find((group) => group.name === "Display").items.find((item) => item.label === "Display Size").value, "15.6 Inch");
});

test("merge updates matches while replace uses only imported ordering", () => {
  const current = [{ name: "General", items: [{ label: "Brand", value: "Old" }] }];
  const incoming = [
    { name: "General", items: [{ label: "Brand", value: "New" }] },
    { name: "Memory", items: [{ label: "RAM", value: "16GB" }] },
  ];

  assert.equal(mergeSpecificationGroups(current, incoming, "merge")[0].items[0].value, "New");
  assert.deepEqual(mergeSpecificationGroups(current, incoming, "replace"), incoming);
});

test("server input validation bounds generic group and item data", () => {
  assert.equal(parseSpecificationGroupsInput([]).ok, true);
  assert.equal(parseSpecificationGroupsInput([{ name: "", items: [] }]).ok, false);
  assert.equal(
    parseSpecificationGroupsInput([{ name: "General", items: [{ label: "Brand", value: "Dell" }] }]).ok,
    true,
  );
});

test("create and edit routes persist ordered generic specifications", async () => {
  const [schema, createRoute, editRoute, modal, builder] = await Promise.all([
    read("prisma/schema.prisma"),
    read("app/api/products/route-core.ts"),
    read("app/api/products/[id]/route-core.ts"),
    read("components/management/ProductAddModal.tsx"),
    read("components/management/ProductSpecificationBuilder.tsx"),
  ]);

  assert.match(schema, /model ProductSpecificationGroup/);
  assert.match(schema, /model ProductSpecificationItem/);
  assert.match(createRoute, /parseSpecificationGroupsInput/);
  assert.match(createRoute, /productSpecificationGroup\.create/);
  assert.match(editRoute, /productSpecificationGroup\.deleteMany/);
  assert.match(editRoute, /productSpecificationGroup\.create/);
  assert.match(modal, /specificationGroups: specificationValidation\.value/);
  assert.match(builder, /Fill Empty Fields Only/);
  assert.match(builder, /Merge and Update Matching Fields/);
  assert.match(builder, /Replace All Specifications/);
  assert.match(builder, /Copy Laptop Format/);
});
