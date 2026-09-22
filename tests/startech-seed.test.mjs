import assert from "node:assert/strict";
import test from "node:test";
import { loadProductSeed, validateProductSeed, seedProductSeedFile, TECH_PRODUCT_SEED_FILE } from "../prisma/seed-data/productseed-import.ts";

const startech = TECH_PRODUCT_SEED_FILE;

test("both catalogs pass the real importer without a database connection", () => {
  for (const file of [startech, "prisma/seed-data/productseed.json"]) {
    const seed = loadProductSeed(file);
    assert.ok(seed.categories.length > 0);
    assert.ok(seed.products.length > 0);
  }
});

test("invalid identities and references fail before any writes", () => {
  const seed = loadProductSeed(startech);
  const duplicate = structuredClone(seed);
  duplicate.products.push(duplicate.products[0]);
  assert.throws(() => validateProductSeed(duplicate), /Duplicate product/);
  const missingCategory = structuredClone(seed);
  missingCategory.products[0].categorySlug = "does-not-exist";
  assert.throws(() => validateProductSeed(missingCategory), /Missing product category/);
  const invalidPrice = structuredClone(seed);
  invalidPrice.products[0].basePrice = -1;
  assert.throws(() => validateProductSeed(invalidPrice));
});

test("upserts persist model/warranty and retain existing warehouse stock", async () => {
  const products = [];
  const variants = [];
  const brandSlugs = new Set();
  let reusedNamedBrand = false;
  const prisma = {
    category: { upsert: async () => ({ id: 1 }) },
    brand: {
      findUnique: async ({ where }) => where.name === "Orico" ? { id: 23 } : null,
      update: async ({ where, data }) => {
        assert.equal(where.id, 23);
        assert.deepEqual(data, { deleted: false });
        reusedNamedBrand = true;
        return { id: 23 };
      },
      upsert: async ({ where, create }) => {
        assert.equal(where.slug, create.slug);
        assert.ok(!brandSlugs.has(where.slug), "case variants must reuse a brand");
        brandSlugs.add(where.slug);
        return { id: brandSlugs.size + 100 };
      },
    },
    product: { upsert: async (args) => { products.push(args); return { id: products.length }; } },
    productVariant: {
      findFirst: async () => ({ id: 1 }),
      update: async (args) => { variants.push(args.data); return { id: 1, ...args.data }; },
    },
    stockLevel: {
      count: async () => 1,
      findMany: async () => [{ quantity: 23, reserved: 4 }],
    },
    $transaction: async (callback) => callback(prisma),
  };
  const summary = await seedProductSeedFile(prisma, startech);
  const seed = loadProductSeed(startech);
  assert.equal(summary.products, seed.products.length);
  seed.products.forEach((item, index) => {
    for (const operation of ["create", "update"]) {
      assert.equal(products[index][operation].model, item.model?.trim() || null);
      assert.equal(products[index][operation].warranty, item.warranty?.trim() || null);
    }
  });
  assert.equal(variants.at(-1).stock, 19);
  assert.ok(reusedNamedBrand);
  assert.equal(summary.brands, brandSlugs.size + 1);
});
