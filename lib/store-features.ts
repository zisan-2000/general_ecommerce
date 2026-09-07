export const STORE_FEATURE_KEYS = [
  "PC_BUILDER",
  "BOOKS",
  "AUTHORS",
  "COMPARE",
  "DIGITAL_PRODUCTS",
  "SERVICE_PRODUCTS",
  "BUNDLES",
] as const;

export type StoreFeatureKey = (typeof STORE_FEATURE_KEYS)[number];

export const CORE_COMMERCE_CAPABILITIES = [
  "PHYSICAL_PRODUCTS",
  "CART",
  "INVENTORY",
] as const;

export type CoreCommerceCapability =
  (typeof CORE_COMMERCE_CAPABILITIES)[number];

export type StoreFeatureDefinition = {
  label: string;
  description: string;
  defaultEnabled: boolean;
  dependencies: readonly StoreFeatureKey[];
  coreRequirements: readonly CoreCommerceCapability[];
};

export const STORE_FEATURE_DEFINITIONS = {
  PC_BUILDER: {
    label: "PC Builder",
    description: "Compatible component selection, saved builds and grouped checkout.",
    defaultEnabled: true,
    dependencies: [],
    coreRequirements: ["PHYSICAL_PRODUCTS", "CART", "INVENTORY"],
  },
  BOOKS: {
    label: "Books",
    description: "Book-specific discovery and structured book metadata.",
    defaultEnabled: false,
    dependencies: [],
    coreRequirements: [],
  },
  AUTHORS: {
    label: "Authors",
    description: "Author discovery and author-to-book navigation.",
    defaultEnabled: false,
    dependencies: ["BOOKS"],
    coreRequirements: [],
  },
  COMPARE: {
    label: "Product comparison",
    description: "Side-by-side comparison of selected products.",
    defaultEnabled: true,
    dependencies: [],
    coreRequirements: [],
  },
  DIGITAL_PRODUCTS: {
    label: "Digital products",
    description: "Products fulfilled through protected digital delivery.",
    defaultEnabled: true,
    dependencies: [],
    coreRequirements: [],
  },
  SERVICE_PRODUCTS: {
    label: "Service products",
    description: "Bookable or scheduled service products.",
    defaultEnabled: true,
    dependencies: [],
    coreRequirements: [],
  },
  BUNDLES: {
    label: "Product bundles",
    description: "Products composed from multiple purchasable products.",
    defaultEnabled: true,
    dependencies: [],
    coreRequirements: ["PHYSICAL_PRODUCTS"],
  },
} as const satisfies Record<StoreFeatureKey, StoreFeatureDefinition>;

export const DEFAULT_CORE_COMMERCE_CAPABILITIES = {
  PHYSICAL_PRODUCTS: true,
  CART: true,
  INVENTORY: true,
} as const satisfies Record<CoreCommerceCapability, boolean>;

export const DEFAULT_STORE_FEATURES = Object.fromEntries(
  STORE_FEATURE_KEYS.map((key) => [
    key,
    STORE_FEATURE_DEFINITIONS[key].defaultEnabled,
  ]),
) as Record<StoreFeatureKey, boolean>;

export type StoreFeatureRow = {
  key: string;
  enabled: boolean;
};

export type StoreFeatureSource = "database" | "default";

export type ResolvedStoreFeature = {
  key: StoreFeatureKey;
  label: string;
  description: string;
  configuredEnabled: boolean;
  enabled: boolean;
  dependencies: readonly StoreFeatureKey[];
  coreRequirements: readonly CoreCommerceCapability[];
  blockedBy: Array<StoreFeatureKey | CoreCommerceCapability>;
  source: StoreFeatureSource;
};

export type StoreFeatureSnapshot = Record<
  StoreFeatureKey,
  ResolvedStoreFeature
>;

export type StoreFeatureTransition =
  | { ok: true; next: StoreFeatureSnapshot }
  | {
      ok: false;
      code: "FEATURE_DEPENDENCY_UNMET" | "FEATURE_DEPENDENT_ACTIVE";
      message: string;
      blockedBy: Array<StoreFeatureKey | CoreCommerceCapability>;
    };

export function isStoreFeatureKey(value: unknown): value is StoreFeatureKey {
  return (
    typeof value === "string" &&
    STORE_FEATURE_KEYS.includes(value as StoreFeatureKey)
  );
}

export function parseStoreFeatureUpdate(value: unknown):
  | { ok: true; value: { key: StoreFeatureKey; enabled: boolean } }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "A JSON object is required." };
  }

  const input = value as Record<string, unknown>;
  if (!isStoreFeatureKey(input.key)) {
    return { ok: false, error: "A valid store feature key is required." };
  }
  if (typeof input.enabled !== "boolean") {
    return { ok: false, error: "enabled must be a boolean." };
  }

  return {
    ok: true,
    value: { key: input.key, enabled: input.enabled },
  };
}

export function resolveStoreFeatures(
  rows: readonly StoreFeatureRow[],
  coreCapabilities: Readonly<Record<CoreCommerceCapability, boolean>> =
    DEFAULT_CORE_COMMERCE_CAPABILITIES,
): StoreFeatureSnapshot {
  const configured = new Map<StoreFeatureKey, boolean>();
  for (const row of rows) {
    if (isStoreFeatureKey(row.key)) configured.set(row.key, row.enabled);
  }

  const resolved = {} as StoreFeatureSnapshot;
  const resolving = new Set<StoreFeatureKey>();

  const evaluate = (key: StoreFeatureKey): ResolvedStoreFeature => {
    if (resolved[key]) return resolved[key];
    if (resolving.has(key)) {
      throw new Error(`Store feature dependency cycle detected at ${key}.`);
    }

    resolving.add(key);
    const definition = STORE_FEATURE_DEFINITIONS[key];
    const configuredEnabled =
      configured.get(key) ?? definition.defaultEnabled;
    const blockedBy: Array<StoreFeatureKey | CoreCommerceCapability> = [];

    if (configuredEnabled) {
      for (const dependency of definition.dependencies) {
        if (!evaluate(dependency).enabled) blockedBy.push(dependency);
      }
      for (const requirement of definition.coreRequirements) {
        if (!coreCapabilities[requirement]) blockedBy.push(requirement);
      }
    }

    const feature: ResolvedStoreFeature = {
      key,
      label: definition.label,
      description: definition.description,
      configuredEnabled,
      enabled: configuredEnabled && blockedBy.length === 0,
      dependencies: definition.dependencies,
      coreRequirements: definition.coreRequirements,
      blockedBy,
      source: configured.has(key) ? "database" : "default",
    };
    resolving.delete(key);
    resolved[key] = feature;
    return feature;
  };

  for (const key of STORE_FEATURE_KEYS) evaluate(key);
  return resolved;
}

export function validateStoreFeatureTransition(
  current: StoreFeatureSnapshot,
  key: StoreFeatureKey,
  enabled: boolean,
  coreCapabilities: Readonly<Record<CoreCommerceCapability, boolean>> =
    DEFAULT_CORE_COMMERCE_CAPABILITIES,
): StoreFeatureTransition {
  const rows = STORE_FEATURE_KEYS.map((candidate) => ({
    key: candidate,
    enabled:
      candidate === key ? enabled : current[candidate].configuredEnabled,
  }));
  const next = resolveStoreFeatures(rows, coreCapabilities);

  if (enabled && !next[key].enabled) {
    return {
      ok: false,
      code: "FEATURE_DEPENDENCY_UNMET",
      message: `${next[key].label} cannot be enabled until ${next[key].blockedBy.join(", ")} is enabled.`,
      blockedBy: next[key].blockedBy,
    };
  }

  if (!enabled) {
    const affected = STORE_FEATURE_KEYS.filter(
      (candidate) =>
        candidate !== key &&
        current[candidate].enabled &&
        current[candidate].configuredEnabled &&
        !next[candidate].enabled,
    );
    if (affected.length > 0) {
      return {
        ok: false,
        code: "FEATURE_DEPENDENT_ACTIVE",
        message: `${current[key].label} cannot be disabled while ${affected.join(", ")} is enabled.`,
        blockedBy: affected,
      };
    }
  }

  return { ok: true, next };
}
