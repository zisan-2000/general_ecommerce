// Public gateway metadata only. AIBL credentials are server-side environment variables.
export const AIBL_WALLET_GATEWAY_TYPE = "AIBL_WALLET" as const;
export const AIBL_WALLET_CONTRACT = "AIBL_ISLAMIC_WALLET_V1_UAT" as const;

export function aiblWalletObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function normalizeAiblWalletGatewaySettings(value: unknown) {
  const input = aiblWalletObject(value);
  return {
    type: AIBL_WALLET_GATEWAY_TYPE,
    isActive: input.isActive === true,
    contract: AIBL_WALLET_CONTRACT,
    environment: "uat",
  };
}

export function aiblWalletGatewayId(paymentMethod: unknown): number | null {
  const match = /^AIBL_WALLET:(\d+)$/.exec(String(paymentMethod ?? ""));
  const id = Number(match?.[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Strict two-decimal normalization: no float arithmetic for gateway verification.
export function aiblMoney(value: unknown): string | null {
  if (value === null || value === undefined || !["string", "number"].includes(typeof value)) return null;
  const raw = String(value);
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(raw)) return null;
  const parts = raw.split(".");
  return BigInt(parts[0]).toString() + "." + (parts[1] ?? "").padEnd(2, "0");
}

export function aiblVerifiedTransaction(value: unknown): string | null {
  const data = aiblWalletObject(value);
  const code = data.code;
  const message = data.msg;
  const transactionId = data.transactionID;
  // No undocumented aliases, case folding or message normalization.
  if ((code !== 200 && code !== "200") || message !== "Order Verified" ||
      (typeof transactionId !== "string" && !(typeof transactionId === "number" && Number.isSafeInteger(transactionId) && transactionId > 0))) return null;
  const safeId = String(transactionId);
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(safeId) && !/^0+$/.test(safeId) ? safeId : null;
}

export function aiblProviderOrderId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value) ? value : null;
}
