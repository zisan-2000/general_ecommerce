import assert from "node:assert/strict";
import test from "node:test";
import { adminProductQuery, ADMIN_PRODUCTS_PAGE_SIZE } from "../lib/admin-product-pagination.ts";

test("invalid and excessive page numbers are bounded", () => {
  for (const value of ["0", "-1", "NaN", "Infinity", "1.5"]) {
    assert.equal(adminProductQuery(new URLSearchParams({ page: value })).page, 1);
  }
  assert.equal(adminProductQuery(new URLSearchParams("page=2")).page, 2);
  assert.equal(adminProductQuery(new URLSearchParams("page=2000000")).page, 1000000);
  assert.equal(ADMIN_PRODUCTS_PAGE_SIZE, 24);
});

test("search text is bound and LIKE wildcard characters remain literal", () => {
  const query = adminProductQuery(new URLSearchParams({ search: "50%_off' OR true --" }));
  assert.ok(!query.from.sql.includes("50%"));
  assert.ok(query.from.values.includes("%50\\%\\_off' OR true --%"));
});

test("stock sorting adds its aggregate and every sort has an ID tie breaker", () => {
  for (const sort of ["stock", "stock-asc", "stock-desc"]) {
    const query = adminProductQuery(new URLSearchParams({ sort }));
    assert.match(query.from.sql, /JOIN LATERAL/);
    assert.match(query.orderBy.sql, /p.id ASC/);
  }
  const query = adminProductQuery(new URLSearchParams({ sort: "malicious; DROP TABLE Product" }));
  assert.equal(query.orderBy.sql, "LOWER(p.name) ASC, p.id ASC");
  assert.doesNotMatch(query.from.sql, /JOIN LATERAL/);
});

test("database pagination returns distinct pages and valid filtered counts", {
  skip: process.env.TEST_ADMIN_PRODUCT_DB !== "1",
}, async () => {
  const { PrismaClient, Prisma } = await import("../generated/prisma/index.js");
  const db = new PrismaClient();
  try {
    const query = adminProductQuery(new URLSearchParams());
    const fetchPage = (offset) => db.$queryRaw(Prisma.sql`SELECT p.id ${query.from}
      ORDER BY ${query.orderBy} LIMIT ${ADMIN_PRODUCTS_PAGE_SIZE} OFFSET ${offset}`);
    const first = await fetchPage(0);
    const second = await fetchPage(24);
    assert.ok(first.length <= 24 && second.length <= 24);
    assert.equal(new Set([...first, ...second].map((row) => row.id)).size, first.length + second.length);
    const total = await db.product.count({ where: { deleted: false } });
    for (const params of [
      "", "stock=in-stock", "stock=low-stock", "stock=out-of-stock",
      "stock=non-physical", "sort=stock-desc", "warehouse=1", "search=camera",
      "category=1&type=PHYSICAL&availability=available&featured=regular",
    ]) {
      const filtered = adminProductQuery(new URLSearchParams(params));
      const counts = await db.$queryRaw(Prisma.sql`SELECT COUNT(*) AS total ${filtered.from}`);
      const rows = await db.$queryRaw(Prisma.sql`SELECT p.id ${filtered.from} ORDER BY ${filtered.orderBy} LIMIT 24`);
      assert.ok(Number(counts[0].total) <= total);
      assert.equal(rows.length, Math.min(24, Number(counts[0].total)));
    }
    console.log(`Verified pagination against ${total} products; first/second page: ${first.length}/${second.length}`);
  } finally {
    await db.$disconnect();
  }
});
