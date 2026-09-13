import "dotenv/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../generated/prisma");

const prisma = new PrismaClient();

const requiredRelations = [
  "PcBuildCartItem",
  "PcBuildOrderItem",
  "PcBuilderSavedBuild",
];

try {
  const [relations, extensions, cartColumns] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT c.relname AS name
       FROM pg_class c
       INNER JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind IN ('r', 'p')
         AND c.relname = ANY($1::text[])`,
      requiredRelations,
    ),
    prisma.$queryRawUnsafe(
      "SELECT extname AS name FROM pg_extension WHERE extname = 'pg_trgm'",
    ),
    prisma.$queryRawUnsafe(
      `SELECT column_name AS name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'CartItem'
         AND column_name = 'lineKey'`,
    ),
  ]);

  const relationNames = new Set(relations.map((row) => row.name));
  const missing = [
    ...requiredRelations
      .filter((name) => !relationNames.has(name))
      .map((name) => `relation public.${name}`),
  ];

  if (extensions.length === 0) missing.push("extension pg_trgm");
  if (cartColumns.length === 0) missing.push("column public.CartItem.lineKey");

  if (missing.length > 0) {
    console.error("PC Builder database verification failed:");
    for (const item of missing) console.error(`- Missing ${item}`);
    process.exitCode = 1;
  } else {
    console.log(
      `PC Builder database is ready (${requiredRelations.length} relations, pg_trgm, CartItem.lineKey).`,
    );
  }
} catch (error) {
  console.error("PC Builder database verification could not complete:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
