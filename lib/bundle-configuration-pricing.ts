export type BundlePricingModeValue = "AUTOMATIC" | "MANUAL";

export type BundlePricingGroup = {
  id: number;
  pricingMode?: BundlePricingModeValue | string | null;
  defaultQuantity: number;
  options: Array<{
    id: number;
    isDefault: boolean;
    priceAdjustment: unknown;
    product: { basePrice: unknown };
    variant?: { price: unknown } | null;
  }>;
};

export type BundlePricingSelection = {
  groupId: number;
  optionId: number | null;
  quantity: number;
  omitted?: boolean;
};

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function getBundleOptionUnitPrice(option: BundlePricingGroup["options"][number]) {
  return finiteNumber(option.variant?.price ?? option.product.basePrice);
}

export function calculateConfiguredBundlePricing(params: {
  basePrice: unknown;
  groups: BundlePricingGroup[];
  selections: BundlePricingSelection[];
}) {
  let priceAdjustment = 0;
  let regularTotal = 0;

  for (const group of params.groups) {
    const selected = params.selections.filter(
      (selection) =>
        selection.groupId === group.id &&
        selection.optionId !== null &&
        !selection.omitted,
    );
    const defaultRegularTotal = group.options
      .filter((option) => option.isDefault)
      .reduce(
        (total, option) =>
          total + getBundleOptionUnitPrice(option) * finiteNumber(group.defaultQuantity),
        0,
      );
    let selectedRegularTotal = 0;
    let manualAdjustment = 0;

    for (const selection of selected) {
      const option = group.options.find((candidate) => candidate.id === selection.optionId);
      if (!option) continue;
      const quantity = finiteNumber(selection.quantity);
      selectedRegularTotal += getBundleOptionUnitPrice(option) * quantity;
      manualAdjustment += finiteNumber(option.priceAdjustment) * quantity;
    }

    regularTotal += selectedRegularTotal;
    priceAdjustment += group.pricingMode === "MANUAL"
      ? manualAdjustment
      : selectedRegularTotal - defaultRegularTotal;
  }

  const basePrice = finiteNumber(params.basePrice);
  return {
    basePrice,
    priceAdjustment,
    finalPrice: Math.max(0, basePrice + priceAdjustment),
    regularTotal,
  };
}
