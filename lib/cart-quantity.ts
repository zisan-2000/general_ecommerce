export type CartQuantityWriteMode = "increment" | "set";

export function normalizeCartQuantityWriteMode(
  value: unknown,
): CartQuantityWriteMode {
  return value === "set" ? "set" : "increment";
}

export function resolveCartQuantity(
  existingQuantity: number,
  requestedQuantity: number,
  mode: CartQuantityWriteMode,
) {
  return mode === "set"
    ? requestedQuantity
    : existingQuantity + requestedQuantity;
}
