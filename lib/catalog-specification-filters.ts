import { Prisma } from "@/generated/prisma";

export type SpecificationFacet = {
  key: string;
  group: string;
  label: string;
  values: Array<{ value: string; productCount: number }>;
};

export function specificationKey(group: string, label: string) {
  return JSON.stringify([group, label]);
}

export function parseSpecificationFilters(params: Record<string, string | string[] | undefined>) {
  const entries: Array<[string, string[]]> = [];
  for (const [name, raw] of Object.entries(params)) {
    if (!name.startsWith("spec_")) continue;
    try {
      const pair: unknown = JSON.parse(name.slice(5));
      if (!Array.isArray(pair) || pair.length !== 2 ||
          !pair.every((part) => typeof part === "string" && part.trim() && part.length <= 200)) continue;
      const values = [...new Set((Array.isArray(raw) ? raw : raw ? [raw] : [])
        .filter((value) => value.trim() && value.length <= 4000))].slice(0, 24);
      if (values.length) entries.push([specificationKey(pair[0], pair[1]), values]);
    } catch { /* Ignore malformed URL keys. */ }
  }
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)).slice(0, 12));
}

export function specificationWhere(selections: Record<string, string[]>): Prisma.ProductWhereInput[] {
  return Object.entries(selections).map(([key, values]) => {
    const [group, label] = JSON.parse(key) as [string, string];
    return { specificationGroups: { some: {
      name: group, items: { some: { label, value: { in: values } } },
    } } };
  });
}

// Aggregate in PostgreSQL: do not load every product's specification graph.
export function specificationFacetQuery(categoryIds: number[], disabledTypes: string[], hideBooks: boolean) {
  return Prisma.sql`WITH counts AS (
    SELECT g.name AS "group", i.label, i.value, COUNT(DISTINCT p.id)::int AS "productCount"
    FROM "ProductSpecificationItem" i
    JOIN "ProductSpecificationGroup" g ON g.id = i."groupId"
    JOIN "Product" p ON p.id = g."productId"
    WHERE p.deleted = false AND p.available = true
      AND ${categoryIds.length ? Prisma.sql`p."categoryId" IN (${Prisma.join(categoryIds)})` : Prisma.sql`false`}
      ${disabledTypes.length ? Prisma.sql`AND p.type::text NOT IN (${Prisma.join(disabledTypes)})` : Prisma.empty}
      ${hideBooks ? Prisma.sql`AND p."writerId" IS NULL AND p."publisherId" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "BookMetadata" bm WHERE bm."productId" = p.id)` : Prisma.empty}
      AND LENGTH(TRIM(g.name)) > 0 AND LENGTH(g.name) <= 200
      AND LENGTH(TRIM(i.label)) > 0 AND LENGTH(i.label) <= 200
      AND LENGTH(TRIM(i.value)) > 0 AND LENGTH(i.value) <= 4000
    GROUP BY g.name, i.label, i.value
  ), ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY "group", label ORDER BY "productCount" DESC, value) AS rank
    FROM counts
  ) SELECT "group", label, value, "productCount" FROM ranked WHERE rank <= 40
    ORDER BY "group", label, "productCount" DESC, value`;
}
