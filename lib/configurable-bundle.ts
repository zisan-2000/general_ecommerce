import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma";
import { computeWarehouseAvailableStock } from "@/lib/warehouse-stock";

export const BUNDLE_SELECTION_TYPES = [
  "FIXED",
  "PRODUCT_SELECT",
  "VARIANT_SELECT",
  "OPTIONAL",
] as const;

export type BundleSelectionTypeValue = (typeof BUNDLE_SELECTION_TYPES)[number];

export type BundleSelectionInput = {
  groupId: number;
  optionId: number | null;
  quantity?: number;
  omitted?: boolean;
};

export type BundleAdminOptionInput = {
  productId: number;
  variantId?: number | null;
  isDefault?: boolean;
  priceAdjustment?: number;
};

export type BundleAdminGroupInput = {
  name: string;
  selectionType: BundleSelectionTypeValue;
  required?: boolean;
  minSelect?: number;
  maxSelect?: number;
  defaultQuantity?: number;
  minQuantity?: number;
  maxQuantity?: number;
  allowQuantityChange?: boolean;
  options: BundleAdminOptionInput[];
};

type ResolvableVariant = {
  id: number;
  productId: number;
  sku: string;
  price: unknown;
  currency: string;
  stock: number;
  options: unknown;
  active: boolean;
  isDefault: boolean;
  stockLevels?: Array<{ quantity: number; reserved: number }> | null;
};

type ResolvableOption = {
  id: number;
  productId: number;
  variantId: number | null;
  isDefault: boolean;
  priceAdjustment: unknown;
  sortOrder: number;
  product: {
    id: number;
    name: string;
    type: string;
    available: boolean;
    deleted: boolean;
    basePrice: unknown;
    variants: ResolvableVariant[];
  };
  variant: ResolvableVariant | null;
};

type ResolvableGroup = {
  id: number;
  name: string;
  selectionType: BundleSelectionTypeValue;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  defaultQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  allowQuantityChange: boolean;
  sortOrder: number;
  options: ResolvableOption[];
};

export type ResolvableBundle = {
  id: number;
  name: string;
  basePrice: unknown;
  currency: string;
  bundleStockLimit: number | null;
  bundleGroups: ResolvableGroup[];
};

export type ResolvedBundleComponent = {
  groupId: number;
  groupName: string;
  optionId: number;
  productId: number;
  productName: string;
  variantId: number | null;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
  priceAdjustment: number;
  availableStock: number | null;
};

export type ResolvedBundleConfiguration = {
  selections: BundleSelectionInput[];
  components: ResolvedBundleComponent[];
  basePrice: number;
  priceAdjustment: number;
  finalPrice: number;
  regularTotal: number;
  availableQuantity: number;
  configurationKey: string;
};

const asPositiveInteger = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

function variantLabel(variant: ResolvableVariant | null) {
  if (!variant) return null;
  if (variant.options && typeof variant.options === "object" && !Array.isArray(variant.options)) {
    const values = Object.entries(variant.options as Record<string, unknown>)
      .filter(([, value]) => ["string", "number"].includes(typeof value))
      .map(([key, value]) => `${key}: ${String(value)}`);
    if (values.length > 0) return values.join(", ");
  }
  return variant.sku || null;
}

function resolveOptionVariant(option: ResolvableOption) {
  if (option.variant) return option.variant;
  return (
    option.product.variants.find((variant) => variant.isDefault && variant.active) ??
    option.product.variants.find((variant) => variant.active) ??
    null
  );
}

export function parseBundleSelections(value: unknown): BundleSelectionInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((selection) => {
      if (!selection || typeof selection !== "object") return null;
      const row = selection as Record<string, unknown>;
      const groupId = Number(row.groupId);
      const omitted = row.omitted === true;
      const optionId = omitted ? null : Number(row.optionId);
      const quantity = row.quantity === undefined ? undefined : Number(row.quantity);
      if (!Number.isInteger(groupId) || groupId <= 0) return null;
      if (!omitted && (!Number.isInteger(optionId) || Number(optionId) <= 0)) return null;
      if (quantity !== undefined && (!Number.isInteger(quantity) || quantity <= 0)) return null;
      return {
        groupId,
        optionId,
        ...(omitted ? { omitted: true } : {}),
        ...(quantity === undefined ? {} : { quantity }),
      };
    })
    .filter((selection): selection is BundleSelectionInput => selection !== null);
}

export function validateBundleAdminGroups(value: unknown) {
  const errors: string[] = [];
  if (!Array.isArray(value) || value.length < 2) {
    return { valid: false, errors: ["Bundle must contain at least two selection groups"] };
  }

  const names = new Set<string>();
  value.forEach((rawGroup, groupIndex) => {
    const group = (rawGroup ?? {}) as BundleAdminGroupInput;
    const label = `Group ${groupIndex + 1}`;
    const name = String(group.name ?? "").trim();
    if (!name) errors.push(`${label} requires a name`);
    if (names.has(name.toLowerCase())) errors.push(`Group name "${name}" is duplicated`);
    names.add(name.toLowerCase());
    if (!BUNDLE_SELECTION_TYPES.includes(group.selectionType)) {
      errors.push(`${label} has an invalid selection type`);
    }

    const options = Array.isArray(group.options) ? group.options : [];
    if (options.length === 0) errors.push(`${label} requires at least one allowed choice`);
    if (group.selectionType === "FIXED" && options.length !== 1) {
      errors.push(`${label} is fixed and must contain exactly one choice`);
    }
    if (group.selectionType === "FIXED" && group.required === false) {
      errors.push(`${label} is fixed and must be required`);
    }
    if (group.selectionType === "OPTIONAL" && group.required !== false) {
      errors.push(`${label} is optional and cannot be required`);
    }

    const minSelect = Math.max(0, Number(group.minSelect ?? (group.required === false ? 0 : 1)));
    const maxSelect = Math.max(1, Number(group.maxSelect ?? 1));
    if (!Number.isInteger(minSelect) || !Number.isInteger(maxSelect) || minSelect > maxSelect) {
      errors.push(`${label} has invalid minimum/maximum selections`);
    }
    if (maxSelect > options.length) errors.push(`${label} cannot select more choices than it provides`);
    const defaultCount = options.filter((option) => Boolean(option.isDefault)).length;
    if (defaultCount < minSelect || defaultCount > maxSelect) {
      errors.push(`${label} default choices must satisfy its selection limits`);
    }

    const minQuantity = Number(group.minQuantity ?? 1);
    const maxQuantity = Number(group.maxQuantity ?? minQuantity);
    const defaultQuantity = Number(group.defaultQuantity ?? minQuantity);
    if (
      !Number.isInteger(minQuantity) || minQuantity < 1 ||
      !Number.isInteger(maxQuantity) || maxQuantity < minQuantity ||
      !Number.isInteger(defaultQuantity) || defaultQuantity < minQuantity || defaultQuantity > maxQuantity
    ) {
      errors.push(`${label} has invalid quantity limits`);
    }

    const choiceKeys = new Set<string>();
    const products = new Set<number>();
    options.forEach((option, optionIndex) => {
      const productId = Number(option.productId);
      const variantId = option.variantId == null ? null : Number(option.variantId);
      if (!Number.isInteger(productId) || productId <= 0) {
        errors.push(`${label}, choice ${optionIndex + 1} has an invalid product`);
      }
      if (variantId !== null && (!Number.isInteger(variantId) || variantId <= 0)) {
        errors.push(`${label}, choice ${optionIndex + 1} has an invalid variant`);
      }
      const key = `${productId}:${variantId ?? "default"}`;
      if (choiceKeys.has(key)) errors.push(`${label} contains a duplicate choice`);
      choiceKeys.add(key);
      products.add(productId);
      if (!Number.isFinite(Number(option.priceAdjustment ?? 0))) {
        errors.push(`${label}, choice ${optionIndex + 1} has an invalid price adjustment`);
      }
    });
    if (group.selectionType === "VARIANT_SELECT" && products.size > 1) {
      errors.push(`${label} is a variant selector, so every choice must use the same product`);
    }
  });

  return { valid: errors.length === 0, errors };
}

export function resolveBundleConfiguration(params: {
  bundle: ResolvableBundle;
  selections?: unknown;
  strictWarehouseStock?: boolean;
}): ResolvedBundleConfiguration {
  const { bundle } = params;
  if (bundle.bundleGroups.length < 2) {
    throw new Error("Bundle configuration is incomplete");
  }

  const requested = parseBundleSelections(params.selections);
  if (
    params.selections !== undefined &&
    (!Array.isArray(params.selections) || requested.length !== params.selections.length)
  ) {
    throw new Error("Bundle selections are malformed");
  }
  const knownGroupIds = new Set(bundle.bundleGroups.map((group) => group.id));
  if (requested.some((selection) => !knownGroupIds.has(selection.groupId))) {
    throw new Error("Bundle selection contains an unknown group");
  }

  const selections: BundleSelectionInput[] = [];
  const components: ResolvedBundleComponent[] = [];
  const demandByVariant = new Map<number, { required: number; available: number }>();

  for (const group of [...bundle.bundleGroups].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const requestedForGroup = requested.filter((selection) => selection.groupId === group.id);
    const defaults: BundleSelectionInput[] = group.options
      .filter((option) => option.isDefault)
      .map((option) => ({ groupId: group.id, optionId: option.id }));
    const explicitlyOmitted = requestedForGroup.some((selection) => selection.omitted);
    if (
      explicitlyOmitted &&
      (group.selectionType !== "OPTIONAL" ||
        requestedForGroup.length !== 1 ||
        requestedForGroup[0]?.optionId !== null)
    ) {
      throw new Error(`${group.name} cannot be omitted`);
    }
    const selected = explicitlyOmitted
      ? []
      : requestedForGroup.length > 0
        ? requestedForGroup
        : defaults;
    const minimum = group.required ? Math.max(1, group.minSelect) : Math.max(0, group.minSelect);

    if (group.selectionType === "FIXED" && requestedForGroup.length > 0) {
      const defaultIds = new Set(defaults.map((selection) => selection.optionId));
      if (
        requestedForGroup.some(
          (selection) => selection.optionId === null || !defaultIds.has(selection.optionId),
        )
      ) {
        throw new Error(`${group.name} is fixed and cannot be changed`);
      }
    }
    if (selected.length < minimum || selected.length > group.maxSelect) {
      throw new Error(`${group.name} requires ${minimum}-${group.maxSelect} choice(s)`);
    }
    if (new Set(selected.map((selection) => selection.optionId)).size !== selected.length) {
      throw new Error(`${group.name} contains duplicate choices`);
    }

    for (const selection of selected) {
      const option = group.options.find((candidate) => candidate.id === selection.optionId);
      if (!option) throw new Error(`Invalid choice for ${group.name}`);
      if (!option.product.available || option.product.deleted || option.product.type === "BUNDLE") {
        throw new Error(`${option.product.name} is not available for this bundle`);
      }
      const quantity = group.allowQuantityChange
        ? asPositiveInteger(selection.quantity, group.defaultQuantity)
        : group.defaultQuantity;
      if (quantity < group.minQuantity || quantity > group.maxQuantity) {
        throw new Error(`${group.name} quantity must be between ${group.minQuantity} and ${group.maxQuantity}`);
      }
      const variant = resolveOptionVariant(option);
      if (variant && (variant.productId !== option.productId || !variant.active)) {
        throw new Error(`Selected variant is unavailable for ${option.product.name}`);
      }
      if (option.product.type === "PHYSICAL" && !variant) {
        throw new Error(`Inventory is not configured for ${option.product.name}`);
      }

      let availableStock: number | null = null;
      if (option.product.type === "PHYSICAL" && variant) {
        availableStock = computeWarehouseAvailableStock(variant);
        if (availableStock === null && !params.strictWarehouseStock) {
          availableStock = Math.max(0, Number(variant.stock));
        }
        if (availableStock === null) {
          throw new Error(`Warehouse inventory is not configured for ${option.product.name}`);
        }
        const current = demandByVariant.get(variant.id) ?? { required: 0, available: availableStock };
        current.required += quantity;
        current.available = Math.min(current.available, availableStock);
        demandByVariant.set(variant.id, current);
      }

      const unitPrice = Number(variant?.price ?? option.product.basePrice);
      const priceAdjustment = Number(option.priceAdjustment);
      selections.push({ groupId: group.id, optionId: option.id, quantity });
      components.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        productId: option.productId,
        productName: option.product.name,
        variantId: variant?.id ?? null,
        variantLabel: variantLabel(variant),
        quantity,
        unitPrice,
        priceAdjustment,
        availableStock,
      });
    }
  }

  const priceAdjustment = components.reduce(
    (total, component) => total + component.priceAdjustment * component.quantity,
    0,
  );
  const basePrice = Number(bundle.basePrice);
  const finalPrice = Math.max(0, basePrice + priceAdjustment);
  const regularTotal = components.reduce(
    (total, component) => total + component.unitPrice * component.quantity,
    0,
  );
  const componentCapacity = demandByVariant.size
    ? Math.min(
        ...Array.from(demandByVariant.values()).map(({ available, required }) =>
          Math.floor(available / required),
        ),
      )
    : Number.POSITIVE_INFINITY;
  const configuredLimit = bundle.bundleStockLimit ?? Number.POSITIVE_INFINITY;
  const availableQuantity = Number.isFinite(Math.min(componentCapacity, configuredLimit))
    ? Math.max(0, Math.min(componentCapacity, configuredLimit))
    : 99;
  const canonicalSelections = [...selections].sort(
    (left, right) => left.groupId - right.groupId || (left.optionId ?? -1) - (right.optionId ?? -1),
  );
  const configurationKey = createHash("sha256")
    .update(JSON.stringify(canonicalSelections))
    .digest("hex")
    .slice(0, 32);

  return {
    selections: canonicalSelections,
    components,
    basePrice,
    priceAdjustment,
    finalPrice,
    regularTotal,
    availableQuantity,
    configurationKey,
  };
}

export const configurableBundleInclude = {
  bundleGroups: {
    orderBy: { sortOrder: "asc" },
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            include: {
              variants: {
                where: { active: true },
                orderBy: [{ isDefault: "desc" }, { id: "asc" }],
                include: {
                  stockLevels: { select: { quantity: true, reserved: true } },
                },
              },
            },
          },
          variant: {
            include: {
              stockLevels: { select: { quantity: true, reserved: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;
