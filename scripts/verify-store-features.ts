import nextEnv from "@next/env";
import { PrismaClient } from "../generated/prisma";
import {
  resolveStoreFeatures,
  STORE_FEATURE_KEYS,
} from "../lib/store-features";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

try {
  const rows = await prisma.storeFeature.findMany({
    select: { key: true, enabled: true },
    orderBy: { key: "asc" },
  });
  const present = new Set(rows.map((row) => row.key));
  const missing = STORE_FEATURE_KEYS.filter((key) => !present.has(key));
  const features = resolveStoreFeatures(rows);
  const dependencyConflicts = STORE_FEATURE_KEYS.filter(
    (key) => features[key].configuredEnabled && !features[key].enabled,
  );

  if (missing.length > 0 || dependencyConflicts.length > 0) {
    console.error("Store feature verification failed.");
    if (missing.length > 0) {
      console.error(`Missing rows: ${missing.join(", ")}`);
    }
    for (const key of dependencyConflicts) {
      console.error(
        `${key} is configured ON but blocked by ${features[key].blockedBy.join(", ")}.`,
      );
    }
    process.exitCode = 1;
  } else {
    console.log(
      `Store feature registry is ready (${STORE_FEATURE_KEYS.length} rows, dependencies valid).`,
    );
  }
} catch (error) {
  console.error("Store feature verification could not complete:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
