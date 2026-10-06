import {
  createBundleGroup,
  type BundleBuilderGroup,
  type CatalogProduct,
  type CatalogVariant,
} from "./ConfigurableBundleGroupBuilder";

export type BundleEditorMode = "SIMPLE" | "CONFIGURABLE";
export type SimpleBundleChoice = {
  product: CatalogProduct;
  variant: CatalogVariant | null;
};

export function bundleItemKey(productId: number, variantId: number | null) {
  return `${productId}:${variantId ?? "default"}`;
}

/** Only expose the simplified editor when no hidden customer rules would change. */
export function canEditAsSimpleBundle(groups: BundleBuilderGroup[]) {
  const choices = new Set<string>();
  const names = new Set<string>();
  return groups.every((group) => {
    // Quantity validity belongs to the shared form validation. Keep an unfinished
    // Simple draft (for example a temporarily empty quantity) in the same editor.
    if (
      group.selectionType !== "FIXED" || !group.required ||
      group.minSelect !== 1 || group.maxSelect !== 1 ||
      group.allowQuantityChange ||
      group.minQuantity !== group.defaultQuantity || group.maxQuantity !== group.defaultQuantity ||
      group.options.length !== 1 || !group.options[0].isDefault || !group.name.trim()
    ) return false;

    const option = group.options[0];
    // A legacy implicit/default variant must not be rewritten by opening Simple mode.
    if (option.variantId === null && (option.product?.variants?.length || option.product?.type === "PHYSICAL")) return false;
    const name = group.name.trim().toLowerCase();
    if (names.has(name)) return false;
    names.add(name);
    const key = bundleItemKey(option.productId, option.variantId);
    if (choices.has(key)) return false;
    choices.add(key);
    return true;
  });
}

/** New rows use the existing group representation; existing rows are never regenerated. */
export function appendSimpleBundleItems(
  groups: BundleBuilderGroup[],
  choices: SimpleBundleChoice[],
): BundleBuilderGroup[] {
  const next = [...groups];
  const itemKeys = new Set(groups.flatMap((group) => group.options.map(
    (option) => bundleItemKey(option.productId, option.variantId),
  )));
  const names = new Set(groups.map((group) => group.name.trim().toLowerCase()));
  for (const { product, variant } of choices) {
    if (product.variants.length > 0 && !variant) continue;
    if (product.type === "PHYSICAL" && !variant) continue;
    const key = bundleItemKey(product.id, variant?.id ?? null);
    if (itemKeys.has(key)) continue;
    // Stable names avoid stale SKU labels if an admin later changes the variant.
    const baseName = product.name;
    let name = baseName;
    let suffix = 2;
    while (names.has(name.trim().toLowerCase())) name = `${baseName} (${suffix++})`;
    names.add(name.trim().toLowerCase());
    itemKeys.add(key);
    next.push({
      ...createBundleGroup(),
      name,
      selectionType: "FIXED",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      defaultQuantity: 1,
      minQuantity: 1,
      maxQuantity: 1,
      allowQuantityChange: false,
      options: [{
        productId: product.id,
        variantId: variant?.id ?? null,
        isDefault: true,
        priceAdjustment: 0,
        product,
        variant,
      }],
    });
  }
  return next;
}
