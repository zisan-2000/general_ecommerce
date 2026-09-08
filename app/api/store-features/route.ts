import { NextResponse } from "next/server";
import { getStoreFeatureRegistry } from "@/lib/store-features-server";
import { STORE_FEATURE_KEYS } from "@/lib/store-features";

export async function GET() {
  const registry = await getStoreFeatureRegistry();
  const features = Object.fromEntries(
    STORE_FEATURE_KEYS.map((key) => [key, registry.features[key].enabled]),
  );
  return NextResponse.json(
    { features },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
