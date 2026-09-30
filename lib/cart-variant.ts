export type VariantAwareCartItem = {
  variantId?: string | number | null;
  hasVariants?: boolean;
};

export function cartItemNeedsVariantSelection(
  item: VariantAwareCartItem,
  loadedVariants?: readonly unknown[],
) {
  if (item.variantId !== null && item.variantId !== undefined && item.variantId !== "") {
    return false;
  }
  if (item.hasVariants === false) return false;
  if (item.hasVariants === true) return true;

  // Legacy localStorage rows do not have hasVariants. Only ask for a choice
  // after the product endpoint confirms that selectable variants exist.
  return loadedVariants !== undefined && loadedVariants.length > 0;
}
