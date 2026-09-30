import { Prisma } from "@/generated/prisma";

export const ADMIN_PRODUCTS_PAGE_SIZE = 24;

// Values are bound parameters; sort expressions come exclusively from this allowlist.
export function adminProductQuery(params: URLSearchParams) {
  const requestedPage = Number(params.get("page") || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 1_000_000) : 1;
  const conditions = [Prisma.sql`p."deleted" = false`];
  const search = params.get("search")?.trim();
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(Prisma.sql`(p."name" ILIKE ${pattern} OR p."sku" ILIKE ${pattern}
      OR c."name" ILIKE ${pattern} OR b."name" ILIKE ${pattern}
      OR EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id AND v.sku ILIKE ${pattern}))`);
  }
  const category = Number(params.get("category"));
  if (Number.isSafeInteger(category) && category > 0) conditions.push(Prisma.sql`p."categoryId" = ${category}`);
  const type = params.get("type");
  if (type) conditions.push(Prisma.sql`p."type"::text = ${type}`);
  const availability = params.get("availability");
  if (availability) conditions.push(Prisma.sql`p.available = ${availability === "available"}`);
  const featured = params.get("featured");
  if (featured) conditions.push(Prisma.sql`p.featured = ${featured === "featured"}`);
  const warehouse = Number(params.get("warehouse"));
  if (Number.isSafeInteger(warehouse) && warehouse > 0) {
    conditions.push(Prisma.sql`(p.type <> 'PHYSICAL' OR EXISTS (
      SELECT 1 FROM "ProductVariant" v JOIN "StockLevel" sl ON sl."productVariantId" = v.id
      WHERE v."productId" = p.id AND sl."warehouseId" = ${warehouse} AND sl.quantity > 0))`);
  }
  const stock = params.get("stock");
  const sort = params.get("sort") || "name-asc";
  const needsStock = Boolean(stock && stock !== "non-physical") || sort.split("-")[0] === "stock";
  const stockJoin = needsStock ? Prisma.sql`LEFT JOIN LATERAL (
    SELECT COUNT(*) AS count, COALESCE(SUM(v.stock), 0) AS total,
      BOOL_OR(v.stock <= GREATEST(0, COALESCE(v."lowStockThreshold", p."lowStockThreshold", 10))) AS low
    FROM "ProductVariant" v WHERE v."productId" = p.id
  ) inventory ON true` : Prisma.empty;
  if (stock === "non-physical") conditions.push(Prisma.sql`p.type <> 'PHYSICAL'`);
  if (stock === "in-stock") conditions.push(Prisma.sql`p.type = 'PHYSICAL' AND (inventory.count = 0 OR (inventory.total > 0 AND NOT inventory.low))`);
  if (stock === "low-stock") conditions.push(Prisma.sql`p.type = 'PHYSICAL' AND inventory.total > 0 AND inventory.low`);
  if (stock === "out-of-stock") conditions.push(Prisma.sql`p.type = 'PHYSICAL' AND inventory.count > 0 AND inventory.total <= 0`);
  const fields: Record<string, Prisma.Sql> = {
    name: Prisma.sql`LOWER(p.name)`,
    category: Prisma.sql`LOWER(c.name)`,
    price: Prisma.sql`p."basePrice"`,
    stock: Prisma.sql`CASE WHEN p.type = 'PHYSICAL' THEN inventory.total ELSE -1 END`,
  };
  const [field, direction] = sort.split("-");
  const orderBy = Prisma.sql`${fields[field] ?? fields.name} ${direction === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`}, p.id ASC`;
  const from = Prisma.sql`FROM "Product" p
    LEFT JOIN "Category" c ON c.id = p."categoryId"
    LEFT JOIN "Brand" b ON b.id = p."brandId"
    ${stockJoin} WHERE ${Prisma.join(conditions, " AND ")}`;
  return { page, from, orderBy };
}
