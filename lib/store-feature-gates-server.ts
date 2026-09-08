import { NextResponse } from "next/server";
import {
  disabledProductTypes,
  productTypeFeatureKey,
  type StoreFeatureKey,
} from "@/lib/store-features";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function storeFeatureDisabledResponse(
  key: StoreFeatureKey,
  status: 403 | 404 = 404,
) {
  return NextResponse.json(
    {
      error: "This store feature is currently unavailable.",
      code: "STORE_FEATURE_DISABLED",
      feature: key,
    },
    { status, headers: PRIVATE_NO_STORE },
  );
}

export async function gateStoreFeature(
  key: StoreFeatureKey,
  status: 403 | 404 = 404,
) {
  const { isFeatureEnabled } = await import("@/lib/store-features-server");
  return (await isFeatureEnabled(key))
    ? null
    : storeFeatureDisabledResponse(key, status);
}

export async function getDisabledStorefrontProductTypes() {
  const { getStoreFeatureRegistry } = await import(
    "@/lib/store-features-server"
  );
  const registry = await getStoreFeatureRegistry();
  return disabledProductTypes(registry.features);
}

export async function gateProductType(
  type: unknown,
  status: 403 | 404 = 403,
) {
  const key = productTypeFeatureKey(type);
  return key ? gateStoreFeature(key, status) : null;
}
