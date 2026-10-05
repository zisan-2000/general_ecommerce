export type GA4Item = {
  item_id: string; item_name?: string; item_brand?: string; item_category?: string;
  item_category2?: string; item_category3?: string; item_variant?: string;
  price?: number; quantity: number; discount?: number; coupon?: string; index?: number;
};
export type EcommercePayload = {
  currency?: string; value?: number; tax?: number; shipping?: number; coupon?: string;
  transaction_id?: string; items?: GA4Item[]; shipping_tier?: string; payment_type?: string;
  item_list_id?: string; item_list_name?: string; promotion_id?: string;
  promotion_name?: string; creative_name?: string; creative_slot?: string;
};
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
export function amount(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}
function name(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 100) : undefined;
}
export function toGA4Item(value: unknown, index?: number): GA4Item {
  const row = record(value);
  const product = Object.keys(record(row.product)).length ? record(row.product) : row;
  const variant = record(row.variant);
  const category = record(product.category);
  const brand = record(product.brand);
  const price = amount(row.price ?? product.price ?? product.basePrice);
  const original = amount(product.originalPrice);
  const variantId = row.variantId ?? variant.id;
  const itemId = String(row.productId ?? product.id ?? "");
  const itemName = name(product.name ?? row.name);
  const itemBrand = name(brand.name ?? product.brandName);
  const itemCategory = name(category.name ?? product.categoryName);
  const bundleConfiguration = record(row.bundleConfiguration);
  const bundleSummary = Array.isArray(row.bundleSummary)
    ? row.bundleSummary
    : Array.isArray(bundleConfiguration.summary)
      ? bundleConfiguration.summary
      : [];
  const bundleVariant = bundleSummary.filter((entry): entry is string => typeof entry === "string").join(", ");
  const fallbackVariant = bundleVariant || variant.sku || (variantId == null ? undefined : String(variantId));
  const itemVariant = name(row.variantLabel ?? fallbackVariant);
  const discount = original !== undefined && price !== undefined && original > price ? original - price : undefined;
  const itemIndex = index ?? amount(row.index);
  return {
    item_id: itemId,
    quantity: amount(row.quantity) ?? 1,
    ...(itemName ? { item_name: itemName } : {}),
    ...(itemBrand ? { item_brand: itemBrand } : {}),
    ...(itemCategory ? { item_category: itemCategory } : {}),
    ...(itemVariant ? { item_variant: itemVariant } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(discount !== undefined ? { discount } : {}),
    ...(itemIndex !== undefined ? { index: itemIndex } : {}),
  };
}
export function ecommerceFromRows(rows: readonly unknown[], currency: string, coupon?: string): EcommercePayload {
  const items = rows.map((row) => toGA4Item(row)).filter((item) => item.item_id && item.quantity > 0);
  return { currency, items, coupon: name(coupon),
    value: items.every((item) => item.price !== undefined)
      ? Number(items.reduce((sum, item) => sum + item.price! * item.quantity, 0).toFixed(2)) : undefined };
}
export function purchaseFromOrder(value: unknown, storeCurrency: string): EcommercePayload | null {
  const order = record(value);
  if (!order.id || !Array.isArray(order.orderItems) || !order.orderItems.length) return null;
  const first = record(order.orderItems[0]);
  const payload = ecommerceFromRows(order.orderItems, name(order.currency ?? first.currency) ?? storeCurrency, name(record(order.coupon).code ?? order.couponCode));
  const merchandiseValue = amount(order.total) ?? payload.value;
  return { ...payload, transaction_id: String(order.id),
    // GA4 revenue excludes shipping and tax; persisted item prices drive merchandise value.
    value: merchandiseValue === undefined
      ? undefined
      : Math.max(0, Number((merchandiseValue - (amount(order.discount_total) ?? 0)).toFixed(2))),
    tax: amount(order.Vat_total), shipping: amount(order.shipping_cost) };
}
