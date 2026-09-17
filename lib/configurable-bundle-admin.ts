import "server-only";

import type { Prisma } from "@/generated/prisma";
import {
  type BundleAdminGroupInput,
  validateBundleAdminGroups,
} from "@/lib/configurable-bundle";

type AdminBundleClient = Pick<Prisma.TransactionClient, "product">;

export async function prepareBundleGroups(
  client: AdminBundleClient,
  rawGroups: unknown,
) {
  const validation = validateBundleAdminGroups(rawGroups);
  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }
  const groups = rawGroups as BundleAdminGroupInput[];
  const productIds = Array.from(
    new Set(groups.flatMap((group) => group.options.map((option) => Number(option.productId)))),
  );
  const products = await client.product.findMany({
    where: { id: { in: productIds }, deleted: false, type: { not: "BUNDLE" } },
    include: {
      variants: {
        where: { active: true },
        orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      },
    },
  });
  if (products.length !== productIds.length) {
    throw new Error("One or more bundle choices are unavailable or are nested bundles");
  }
  const productById = new Map(products.map((product) => [product.id, product]));

  let defaultRegularTotal = 0;
  const legacyDefaultItems = new Map<number, { productId: number; quantity: number; sortOrder: number }>();
  const normalized = groups.map((group, groupIndex) => {
    const required = group.selectionType === "OPTIONAL" ? Boolean(group.required) : group.required !== false;
    const minSelect = Math.max(0, Number(group.minSelect ?? (required ? 1 : 0)));
    const maxSelect = Math.max(1, Number(group.maxSelect ?? 1));
    const defaultQuantity = Number(group.defaultQuantity ?? 1);
    const minQuantity = Number(group.minQuantity ?? defaultQuantity);
    const maxQuantity = Number(group.maxQuantity ?? defaultQuantity);
    const pricingMode = group.pricingMode === "MANUAL"
      ? ("MANUAL" as const)
      : ("AUTOMATIC" as const);
    const options = group.options.map((option, optionIndex) => {
      const product = productById.get(Number(option.productId));
      if (!product) throw new Error("Bundle choice product was not found");
      const requestedVariantId = option.variantId == null ? null : Number(option.variantId);
      const variant = requestedVariantId
        ? product.variants.find((candidate) => candidate.id === requestedVariantId)
        : product.variants.find((candidate) => candidate.isDefault) ?? product.variants[0] ?? null;
      if (product.type === "PHYSICAL" && !variant) {
        throw new Error(`Inventory variant is required for ${product.name}`);
      }
      if (requestedVariantId && !variant) {
        throw new Error(`Selected variant does not belong to ${product.name}`);
      }
      const isDefault = Boolean(option.isDefault);
      if (isDefault) {
        const unitPrice = Number(variant?.price ?? product.basePrice);
        defaultRegularTotal += unitPrice * defaultQuantity;
        const existing = legacyDefaultItems.get(product.id);
        legacyDefaultItems.set(product.id, {
          productId: product.id,
          quantity: (existing?.quantity ?? 0) + defaultQuantity,
          sortOrder: existing?.sortOrder ?? groupIndex,
        });
      }
      return {
        productId: product.id,
        variantId: variant?.id ?? null,
        isDefault,
        priceAdjustment: Number(option.priceAdjustment ?? 0),
        sortOrder: optionIndex,
      };
    });

    return {
      name: String(group.name).trim(),
      selectionType: group.selectionType,
      pricingMode,
      required,
      minSelect,
      maxSelect,
      defaultQuantity,
      minQuantity,
      maxQuantity,
      allowQuantityChange: Boolean(group.allowQuantityChange),
      sortOrder: groupIndex,
      options,
    };
  });

  return {
    groups: normalized,
    defaultRegularTotal,
    legacyDefaultItems: Array.from(legacyDefaultItems.values()).sort(
      (left, right) => left.sortOrder - right.sortOrder,
    ),
  };
}

export function calculateBundleBasePrice(params: {
  regularTotal: number;
  discountType: unknown;
  discountValue: unknown;
  manualPrice: unknown;
}) {
  const regularTotal = Math.max(0, params.regularTotal);
  const discountValue = Number(params.discountValue ?? 0);
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    throw new Error("Discount value is invalid");
  }
  switch (params.discountType) {
    case "PERCENTAGE":
      if (discountValue > 100) throw new Error("Percentage discount cannot exceed 100%");
      return Math.max(0, regularTotal * (1 - discountValue / 100));
    case "FIXED":
      if (discountValue > regularTotal) throw new Error("Fixed discount cannot exceed regular total");
      return regularTotal - discountValue;
    case "MANUAL": {
      const manualPrice = Number(params.manualPrice);
      if (!Number.isFinite(manualPrice) || manualPrice < 0 || manualPrice > regularTotal) {
        throw new Error("Manual price must be between zero and the regular total");
      }
      return manualPrice;
    }
    default:
      throw new Error("Invalid discount type");
  }
}
