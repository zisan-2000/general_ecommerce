import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../generated/prisma";

const BASELINE = "00000000000000_squashed_baseline";
const prisma = new PrismaClient();

async function main() {
  if (process.env.ALLOW_PHASE9_BASELINE_RESOLVE !== "true") {
    throw new Error(
      "Baseline reconciliation blocked. Back up the existing database, then set ALLOW_PHASE9_BASELINE_RESOLVE=true.",
    );
  }

  const [tables] = await prisma.$queryRaw<Array<{
    product: string | null;
    user_table: string | null;
    settings: string | null;
    migrations: string | null;
  }>>`
    SELECT
      to_regclass('public."Product"')::text AS product,
      to_regclass('public."User"')::text AS user_table,
      to_regclass('public.sitesettings')::text AS settings,
      to_regclass('public._prisma_migrations')::text AS migrations
  `;
  if (!tables?.product || !tables.user_table || !tables.settings) {
    throw new Error("Baseline resolve is only valid for an existing complete application database.");
  }
  if (tables.migrations) {
    const applied = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL',
      BASELINE,
    );
    if (Number(applied[0]?.count ?? 0) > 0) {
      console.log("Phase 9 baseline is already recorded for this database.", { baseline: BASELINE });
      return;
    }
  }
  await prisma.$disconnect();

  const prismaCli = fileURLToPath(
    new URL("../node_modules/prisma/build/index.js", import.meta.url),
  );
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "resolve", "--applied", BASELINE], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `Prisma baseline reconciliation failed${result.error ? `: ${result.error.message}` : "."}`,
    );
  }
  console.log("Phase 9 baseline recorded for the existing database.", { baseline: BASELINE });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
