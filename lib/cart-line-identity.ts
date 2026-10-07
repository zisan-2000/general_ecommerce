import { pcBuilderCartLineKey, STANDARD_CART_LINE_KEY } from "./pc-builder-cart-line";

type CartLineIdentity = {
  productId: string | number;
  variantId?: string | number | null;
  pcBuildId?: string | null;
  bundleConfigurationKey?: string | null;
  lineKey?: string | null;
};

export function serverHasCartLine(
  serverItems: CartLineIdentity[],
  localItem: CartLineIdentity,
) {
  const localLineKey =
    (localItem.pcBuildId ? pcBuilderCartLineKey(localItem.pcBuildId) : null) ??
    localItem.bundleConfigurationKey ??
    STANDARD_CART_LINE_KEY;

  return serverItems.some((serverItem) => {
    const sameLine =
      String(serverItem.productId) === String(localItem.productId) &&
      String(serverItem.pcBuildId ?? "") === String(localItem.pcBuildId ?? "") &&
      (serverItem.lineKey ?? STANDARD_CART_LINE_KEY) === localLineKey;
    const sameVariant =
      String(serverItem.variantId ?? "") === String(localItem.variantId ?? "") ||
      (!localItem.variantId && serverItem.variantId != null &&
        !localItem.bundleConfigurationKey && !localItem.pcBuildId);
    return sameLine && sameVariant;
  });
}
