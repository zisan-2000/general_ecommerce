import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const productColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Product'
  `;
  const columns = new Set(productColumns.map((row) => row.column_name));
  for (const legacy of ["writerId", "publisherId"]) {
    if (!columns.has(legacy)) {
      throw new Error(
        `Phase 8 compatibility verification failed: Product.${legacy} is missing before the later removal release.`,
      );
    }
  }

  const metadataTable = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'BookMetadata'
  `;
  if (Number(metadataTable[0]?.count ?? 0) !== 1) {
    throw new Error("Phase 8 verification failed: BookMetadata table is missing.");
  }

  const [
    orphans,
    invalidWriters,
    invalidPublishers,
    duplicateProducts,
    missingMetadata,
    mismatchedRepresentations,
    emptyMetadata,
    legacyRows,
    metadataRows,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "BookMetadata" bm
      LEFT JOIN "Product" p ON p."id" = bm."productId"
      WHERE p."id" IS NULL
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "BookMetadata" bm
      LEFT JOIN "Writer" w ON w."id" = bm."writerId"
      WHERE bm."writerId" IS NOT NULL AND w."id" IS NULL
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "BookMetadata" bm
      LEFT JOIN "Publisher" p ON p."id" = bm."publisherId"
      WHERE bm."publisherId" IS NOT NULL AND p."id" IS NULL
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT "productId"
        FROM "BookMetadata"
        GROUP BY "productId"
        HAVING COUNT(*) > 1
      ) duplicates
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "Product" p
      LEFT JOIN "BookMetadata" bm ON bm."productId" = p."id"
      WHERE (p."writerId" IS NOT NULL OR p."publisherId" IS NOT NULL)
        AND bm."id" IS NULL
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "Product" p
      INNER JOIN "BookMetadata" bm ON bm."productId" = p."id"
      WHERE p."writerId" IS DISTINCT FROM bm."writerId"
         OR p."publisherId" IS DISTINCT FROM bm."publisherId"
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "BookMetadata"
      WHERE "writerId" IS NULL AND "publisherId" IS NULL
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "Product"
      WHERE "writerId" IS NOT NULL OR "publisherId" IS NOT NULL
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "BookMetadata"
      WHERE "writerId" IS NOT NULL OR "publisherId" IS NOT NULL
    `,
  ]);

  const checks = {
    orphanProducts: Number(orphans[0]?.count ?? 0),
    invalidWriters: Number(invalidWriters[0]?.count ?? 0),
    invalidPublishers: Number(invalidPublishers[0]?.count ?? 0),
    duplicateProducts: Number(duplicateProducts[0]?.count ?? 0),
    missingMetadata: Number(missingMetadata[0]?.count ?? 0),
    mismatchedRepresentations: Number(mismatchedRepresentations[0]?.count ?? 0),
    emptyMetadata: Number(emptyMetadata[0]?.count ?? 0),
  };
  const failures = Object.entries(checks).filter(([, count]) => count !== 0);
  if (failures.length) {
    throw new Error(`Phase 8 verification failed: ${JSON.stringify(checks)}`);
  }

  console.log("Phase 8 book metadata verification passed.", {
    legacyRows: Number(legacyRows[0]?.count ?? 0),
    metadataRows: Number(metadataRows[0]?.count ?? 0),
    ...checks,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
