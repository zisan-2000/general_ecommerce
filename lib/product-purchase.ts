export type ProductPurchaseVariant = {
  id: number;
  sku: string | null;
  price: number;
  stock: number;
  options: unknown;
  colorImage: string | null;
  isDefault: boolean;
  active: boolean;
};

export type ProductPurchaseData = {
  id: number;
  name: string;
  type: string;
  sku: string | null;
  image: string | null;
  gallery: string[];
  basePrice: number;
  originalPrice: number | null;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  bundleStockLimit: number | null;
  bundleGroups: Array<{
    id: number;
    name: string;
    selectionType: "FIXED" | "PRODUCT_SELECT" | "VARIANT_SELECT" | "OPTIONAL";
    required: boolean;
    minSelect: number;
    maxSelect: number;
    defaultQuantity: number;
    minQuantity: number;
    maxQuantity: number;
    allowQuantityChange: boolean;
    sortOrder: number;
    options: Array<{
      id: number;
      productId: number;
      variantId: number | null;
      isDefault: boolean;
      priceAdjustment: number;
      sortOrder: number;
      product: {
        id: number;
        name: string;
        image: string | null;
        type: string;
        available: boolean;
        basePrice: number;
      };
      variant: ProductPurchaseVariant | null;
    }>;
  }>;
  variants: ProductPurchaseVariant[];
};

export function parseStorefrontProductId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function getDefaultPurchaseVariant(variants: ProductPurchaseVariant[]) {
  return (
    variants.find((variant) => variant.isDefault && variant.active && variant.stock > 0) ??
    variants.find((variant) => variant.active && variant.stock > 0) ??
    variants.find((variant) => variant.isDefault && variant.active) ??
    variants.find((variant) => variant.active) ??
    null
  );
}

export function getProductAvailableStock(
  product: Pick<ProductPurchaseData, "type" | "bundleStockLimit" | "bundleGroups" | "variants">,
) {
  if (product.type === "BUNDLE") {
    const demand = new Map<number, { stock: number; quantity: number }>();
    for (const group of product.bundleGroups) {
      for (const option of group.options.filter((candidate) => candidate.isDefault)) {
        if (option.product.type !== "PHYSICAL" || !option.variant) continue;
        const current = demand.get(option.variant.id) ?? {
          stock: Math.max(0, option.variant.stock),
          quantity: 0,
        };
        current.quantity += group.defaultQuantity;
        demand.set(option.variant.id, current);
      }
    }
    const componentCapacity = demand.size
      ? Math.min(...Array.from(demand.values()).map((item) => Math.floor(item.stock / item.quantity)))
      : 0;
    return product.bundleStockLimit === null
      ? componentCapacity
      : Math.min(componentCapacity, product.bundleStockLimit);
  }
  if (product.type === "DIGITAL" || product.type === "SERVICE") return 99;
  return product.variants
    .filter((variant) => variant.active)
    .reduce((total, variant) => total + Math.max(0, variant.stock), 0);
}

export function toProductPurchaseData(product: ProductPurchaseData): ProductPurchaseData {
  return {
    id: product.id,
    name: product.name,
    type: product.type,
    sku: product.sku,
    image: product.image,
    gallery: product.gallery,
    basePrice: product.basePrice,
    originalPrice: product.originalPrice,
    currency: product.currency,
    ratingAvg: product.ratingAvg,
    ratingCount: product.ratingCount,
    bundleStockLimit: product.bundleStockLimit,
    bundleGroups: product.bundleGroups.map((group) => ({
      ...group,
      options: group.options.map((option) => ({
        ...option,
        priceAdjustment: Number(option.priceAdjustment),
        product: { ...option.product, basePrice: Number(option.product.basePrice) },
        variant: option.variant
          ? {
              ...option.variant,
              price: Number(option.variant.price),
              stock: Number(option.variant.stock),
            }
          : null,
      })),
    })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      price: variant.price,
      stock: variant.stock,
      options: variant.options,
      colorImage: variant.colorImage,
      isDefault: variant.isDefault,
      active: variant.active,
    })),
  };
}
