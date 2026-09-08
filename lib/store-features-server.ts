import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  resolveStoreFeatures,
  type ResolvedStoreFeature,
  type StoreFeatureKey,
  type StoreFeatureSnapshot,
  validateStoreFeatureTransition,
} from "@/lib/store-features";

export const STORE_FEATURE_CACHE_TAG = "store-features";

export const STORE_FEATURE_AFFECTED_CACHE_TAGS = [
  STORE_FEATURE_CACHE_TAG,
  "storefront-home",
  "storefront-catalog",
  "storefront-product-detail",
  "products",
  "flash-sales",
  "categories",
  "site-settings",
] as const;

export type StoreFeatureRegistrySnapshot = {
  features: StoreFeatureSnapshot;
  storage: "database" | "defaults";
};

export type StoreFeatureUpdateResult = {
  recordId: number;
  before: ResolvedStoreFeature;
  after: ResolvedStoreFeature;
  registry: StoreFeatureRegistrySnapshot;
};

export class StoreFeatureTransitionError extends Error {
  constructor(
    readonly code:
      | "FEATURE_DEPENDENCY_UNMET"
      | "FEATURE_DEPENDENT_ACTIVE",
    message: string,
    readonly blockedBy: readonly string[],
  ) {
    super(message);
    this.name = "StoreFeatureTransitionError";
  }
}

function isMissingStoreFeatureTable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2021"
  );
}

const readStoreFeatureRows = unstable_cache(
  async () => {
    const tableRows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('"StoreFeature"') IS NOT NULL AS "exists"
    `;
    if (!tableRows[0]?.exists) return null;
    return prisma.storeFeature.findMany({
      select: { key: true, enabled: true },
      orderBy: { key: "asc" },
    });
  },
  ["store-feature-registry-v2"],
  { revalidate: 300, tags: [STORE_FEATURE_CACHE_TAG] },
);

export async function getStoreFeatureRegistry(): Promise<StoreFeatureRegistrySnapshot> {
  try {
    const rows = await readStoreFeatureRows();
    if (rows === null) {
      return { features: resolveStoreFeatures([]), storage: "defaults" };
    }
    return { features: resolveStoreFeatures(rows), storage: "database" };
  } catch (error) {
    // This compatibility read keeps current storefront behavior available during
    // an additive deploy where application code reaches an instance just before
    // the StoreFeature migration. All other database failures remain visible.
    if (isMissingStoreFeatureTable(error)) {
      return { features: resolveStoreFeatures([]), storage: "defaults" };
    }
    throw error;
  }
}

export async function isFeatureEnabled(key: StoreFeatureKey) {
  const registry = await getStoreFeatureRegistry();
  return registry.features[key].enabled;
}

export function revalidateStoreFeatureCache() {
  for (const tag of STORE_FEATURE_AFFECTED_CACHE_TAGS) {
    revalidateTag(tag, { expire: 0 });
  }
}

export async function setStoreFeatureEnabled(
  key: StoreFeatureKey,
  enabled: boolean,
): Promise<StoreFeatureUpdateResult> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      "store-feature-registry",
    );

    const rows = await tx.storeFeature.findMany({
      select: { key: true, enabled: true },
      orderBy: { key: "asc" },
    });
    const current = resolveStoreFeatures(rows);
    const transition = validateStoreFeatureTransition(current, key, enabled);
    if (!transition.ok) {
      throw new StoreFeatureTransitionError(
        transition.code,
        transition.message,
        transition.blockedBy,
      );
    }

    const saved = await tx.storeFeature.upsert({
      where: { key },
      create: { key, enabled },
      update: { enabled },
      select: { id: true, key: true, enabled: true },
    });
    const nextRows = [
      ...rows.filter((row) => row.key !== key),
      { key: saved.key, enabled: saved.enabled },
    ];
    const features = resolveStoreFeatures(nextRows);

    return {
      recordId: saved.id,
      before: current[key],
      after: features[key],
      registry: { features, storage: "database" as const },
    };
  });

  revalidateStoreFeatureCache();
  return result;
}
