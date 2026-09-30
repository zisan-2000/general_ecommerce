import assert from 'node:assert/strict';
import test from 'node:test';
import { specificationKey, parseSpecificationFilters, specificationWhere, specificationFacetQuery } from '../lib/catalog-specification-filters.ts';
import { parseCatalogFilters, catalogUrl, catalogCanonicalUrl, isIndexableCatalogView } from '../lib/storefront-catalog.ts';

test('specification URL filters round trip with variants and pagination', () => {
  const key = specificationKey('Memory Specifications', 'Type');
  const filters = parseCatalogFilters({ category: 'processor', [`spec_${key}`]: ['DDR5', 'DDR4'], variant_Size: '192 GB', page: '2' });
  const url = new URL(catalogUrl(filters), 'http://localhost');
  assert.deepEqual(url.searchParams.getAll(`spec_${key}`), ['DDR5', 'DDR4']);
  assert.equal(url.searchParams.get('variant_Size'), '192 GB');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(isIndexableCatalogView(filters), false);
  assert.equal(catalogCanonicalUrl(filters), '/ecommerce/products?category=processor');
});

test('same label in different specification groups remains distinct', () => {
  const a = specificationKey('Basic Information', 'Base Frequency');
  const b = specificationKey('Graphics Specifications', 'Base Frequency');
  const selected = parseSpecificationFilters({ [`spec_${a}`]: ['4.2 GHz', '4.2 GHz'], [`spec_${b}`]: '300 MHz', spec_bad: 'x' });
  assert.equal(Object.keys(selected).length, 2);
  assert.deepEqual(selected[a], ['4.2 GHz']);
  const where = specificationWhere(selected);
  assert.equal(where.length, 2);
  assert.equal(where[0].specificationGroups.some.items.some.label, 'Base Frequency');
});

test('real catalog specifications aggregate and match sample product', { skip: process.env.TEST_CATALOG_DB !== '1' }, async () => {
  const { PrismaClient } = await import('../generated/prisma/index.js');
  const db = new PrismaClient();
  try {
    const product = await db.product.findUnique({ where: { id: 10085 }, select: { categoryId: true } });
    assert.ok(product);
    const rows = await db.$queryRaw(specificationFacetQuery([product.categoryId], [], false));
    assert.ok(rows.some(row => row.group === 'Memory Specifications' && row.label === 'Type' && row.value === 'DDR5'));
    const matches = await db.product.findMany({ where: { id: 10085, AND: specificationWhere({ [specificationKey('Memory Specifications', 'Type')]: ['DDR5'] }), variants: { some: { active: true, options: { path: ['Maximum Size'], equals: '192 GB' } } } }, select: { id: true } });
    assert.equal(matches.length, 1);
    const absent = await db.product.count({ where: { id: 10085, AND: specificationWhere({ [specificationKey('Memory Specifications', 'Type')]: ['DDR3'] }) } });
    assert.equal(absent, 0);
    console.log(`Verified ${rows.length} specification values and combined variant/specification filtering`);
  } finally { await db.$disconnect(); }
});
