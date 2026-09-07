import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { privateJson } from "@/lib/public-cache";
import { getAccessContext } from "@/lib/rbac";
import { parseStoreFeatureUpdate } from "@/lib/store-features";
import {
  getStoreFeatureRegistry,
  setStoreFeatureEnabled,
  StoreFeatureTransitionError,
} from "@/lib/store-features-server";

export const dynamic = "force-dynamic";

async function requireFeatureSettingsAccess() {
  const session = await getServerSession(authOptions);
  const access = await getAccessContext(
    session?.user as { id?: string; role?: string } | undefined,
  );
  if (!access.userId) return { ok: false as const, status: 401 as const };
  if (!access.has("settings.manage")) {
    return { ok: false as const, status: 403 as const };
  }
  return { ok: true as const, access };
}

export async function GET() {
  try {
    const allowed = await requireFeatureSettingsAccess();
    if (!allowed.ok) {
      return NextResponse.json(
        { error: allowed.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: allowed.status },
      );
    }

    const registry = await getStoreFeatureRegistry();
    return privateJson({
      storage: registry.storage,
      features: Object.values(registry.features),
    });
  } catch (error) {
    console.error("STORE FEATURE READ ERROR:", error);
    return NextResponse.json(
      { error: "Store features could not be loaded." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const allowed = await requireFeatureSettingsAccess();
    if (!allowed.ok) {
      return NextResponse.json(
        { error: allowed.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: allowed.status },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = parseStoreFeatureUpdate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await setStoreFeatureEnabled(
      parsed.value.key,
      parsed.value.enabled,
    );
    await logActivity({
      action: "update_store_feature",
      entity: "store_feature",
      entityId: result.recordId,
      access: allowed.access,
      request,
      before: result.before,
      after: result.after,
      metadata: {
        message: `${result.after.label} ${result.after.enabled ? "enabled" : "disabled"}`,
        featureKey: result.after.key,
      },
    });

    return privateJson({
      feature: result.after,
      features: Object.values(result.registry.features),
    });
  } catch (error) {
    if (error instanceof StoreFeatureTransitionError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          blockedBy: error.blockedBy,
        },
        { status: 409 },
      );
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2021"
    ) {
      return NextResponse.json(
        { error: "Store feature storage is not ready. Apply the Phase 2 migration." },
        { status: 503 },
      );
    }

    console.error("STORE FEATURE UPDATE ERROR:", error);
    return NextResponse.json(
      { error: "Store feature was not updated." },
      { status: 500 },
    );
  }
}
