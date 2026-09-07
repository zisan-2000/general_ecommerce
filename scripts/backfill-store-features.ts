import nextEnv from "@next/env";
import { PrismaClient, StoreFeatureKey as PrismaStoreFeatureKey } from "../generated/prisma";
import {
  DEFAULT_STORE_FEATURES,
  STORE_FEATURE_KEYS,
} from "../lib/store-features";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

try {
  const result = await prisma.storeFeature.createMany({
    data: STORE_FEATURE_KEYS.map((key) => ({
      key: key as PrismaStoreFeatureKey,
      enabled: DEFAULT_STORE_FEATURES[key],
    })),
    skipDuplicates: true,
  });

  console.log(
    `Store feature backfill complete: ${result.count} missing row(s) inserted; existing choices preserved.`,
  );
} catch (error) {
  console.error("Store feature backfill failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
