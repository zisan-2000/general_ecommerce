// Reconcile a local, previously db-pushed database before release migrations.
// Existing policy content is preserved. A database backup is required.
import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";

nextEnv.loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient({ errorFormat: "minimal" });
const cli = require.resolve("prisma/build/index.js");
const pcMigration = "20260930130000_ensure_pc_builder_storage";
const policyMigration = "20261004090000_store_policy_content";

function runPrisma(args, input) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    input, encoding: "utf8", env: process.env,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Prisma command failed");
  console.log(result.stdout.trim());
}

async function main() {
  const target = new URL(process.env.DATABASE_URL);
  if (process.env.ALLOW_LOCAL_RELEASE_BASELINE !== "true" ||
      process.env.NODE_ENV === "production" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
    throw new Error("This reconciliation requires an explicitly enabled local development database.");
  }
  if (!process.env.BUNDLE_DATABASE_BACKUP || statSync(process.env.BUNDLE_DATABASE_BACKUP).size === 0) {
    throw new Error("BUNDLE_DATABASE_BACKUP must name the completed database backup.");
  }
  const [history] = await prisma.$queryRawUnsafe("SELECT to_regclass('public._prisma_migrations')::text AS ledger");
  if (history.ledger) throw new Error("Migration history already exists; use normal release migrations instead.");
  const columns = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1",
    "StorePolicyContent",
  );
  const expected = ["id", "kind", "locale", "title", "content", "category", "linkUrl", "sortOrder", "isPublished", "effectiveDate", "createdAt", "updatedAt"];
  if (expected.some((column) => !columns.some((row) => row.column_name === column))) {
    throw new Error("Existing policy table does not match the release schema.");
  }
  const [invalid] = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*)::int AS count FROM "StorePolicyContent" WHERE kind <> ALL($1::text[]) OR "sortOrder" < 0',
    ["shipping", "returns", "privacy", "faq", "terms", "sitemap"],
  );
  if (invalid.count) throw new Error("Existing policy records violate release constraints.");
  const constraints = await prisma.$queryRawUnsafe(
    "SELECT conname FROM pg_constraint WHERE conrelid=to_regclass($1)", '\"StorePolicyContent\"',
  );
  const before = { products: await prisma.product.count(), orders: await prisma.order.count() };
  const policySql = readFileSync(`prisma/migrations-release/${policyMigration}/migration.sql`, "utf8");
  const insertStart = policySql.indexOf('INSERT INTO "StorePolicyContent"');
  if (insertStart < 0) throw new Error("Policy release migration has no seed statement.");
  let reconcileSql = 'ALTER TABLE "StorePolicyContent" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;\nCREATE INDEX IF NOT EXISTS "StorePolicyContent_kind_locale_isPublished_sortOrder_idx" ON "StorePolicyContent"("kind", "locale", "isPublished", "sortOrder");\n';
  if (!constraints.some((row) => row.conname === "StorePolicyContent_kind_check")) {
    reconcileSql += `ALTER TABLE "StorePolicyContent" ADD CONSTRAINT "StorePolicyContent_kind_check" CHECK ("kind" IN ('shipping','returns','privacy','faq','terms','sitemap'));\n`;
  }
  if (!constraints.some((row) => row.conname === "StorePolicyContent_sortOrder_check")) {
    reconcileSql += 'ALTER TABLE "StorePolicyContent" ADD CONSTRAINT "StorePolicyContent_sortOrder_check" CHECK ("sortOrder" >= 0);\n';
  }
  reconcileSql += policySql.slice(insertStart).trim().replace(/;$/, ' ON CONFLICT ("id") DO NOTHING;');
  await prisma.$disconnect();
  runPrisma(["db", "execute", "--schema", "prisma/schema.prisma", "--file", `prisma/migrations-release/${pcMigration}/migration.sql`]);
  runPrisma(["db", "execute", "--schema", "prisma/schema.prisma", "--stdin"], reconcileSql);
  runPrisma(["migrate", "resolve", "--applied", pcMigration]);
  runPrisma(["migrate", "resolve", "--applied", policyMigration]);
  const after = { products: await prisma.product.count(), orders: await prisma.order.count() };
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Existing product/order counts changed unexpectedly.");
  console.log("Local release baseline reconciled; existing products and orders preserved.", after);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
