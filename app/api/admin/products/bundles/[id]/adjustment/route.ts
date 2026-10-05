import { Prisma } from "@/generated/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const featureGate = await gateStoreFeature("BUNDLES", 403);
  if (featureGate) return featureGate;
  const session = await getServerSession(authOptions);
  const access = await getAccessContext(
    session?.user as { id?: string; role?: string } | undefined,
  );
  if (!access.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.has("inventory.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const bundleId = Number((await params).id);
  if (!Number.isSafeInteger(bundleId) || bundleId <= 0) {
    return NextResponse.json({ error: "Invalid bundle id" }, { status: 400 });
  }
  try {
    const body = await request.json();
    const quantity = Number(body.quantity);
    const expectedWarehouseId = body.warehouseId === undefined ? null : Number(body.warehouseId);
    if (expectedWarehouseId !== null && (!Number.isSafeInteger(expectedWarehouseId) || expectedWarehouseId <= 0)) {
      return NextResponse.json({ error: "Invalid warehouse id" }, { status: 400 });
    }
    const reason = String(body.reason ?? "").trim();
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !reason || reason.length > 250) {
      return NextResponse.json({ error: "A whole-number quantity and adjustment reason are required" }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${bundleId} FOR NO KEY UPDATE`;
      const bundle = await tx.product.findFirst({
        // Archived bundles may still hold finished stock; permit audited stock-out, never assembly.
        where: { id: bundleId, type: "BUNDLE" },
        select: { bundleFulfillmentMode: true, bundleWarehouseId: true, name: true },
      });
      if (!bundle) throw new Error("Bundle not found");
      if (bundle.bundleFulfillmentMode !== "PREASSEMBLED") throw new Error("Only preassembled bundle stock can be adjusted here");
      if (!bundle.bundleWarehouseId) throw new Error("Bundle fulfillment warehouse is not configured");
      if (expectedWarehouseId !== null && expectedWarehouseId !== bundle.bundleWarehouseId) {
        throw new Error("Bundle fulfillment warehouse changed. Refresh stock before adjustment.");
      }
      if (!access.can("inventory.manage", bundle.bundleWarehouseId)) throw new Error("You do not have inventory access to this warehouse");

      const updated = await tx.$queryRaw<Array<{ id: number; quantity: number; reserved: number }>>(
        Prisma.sql`
          UPDATE "BundleStockLevel"
          SET "quantity" = "quantity" - ${quantity}, "updatedAt" = NOW()
          WHERE "productId" = ${bundleId}
            AND "warehouseId" = ${bundle.bundleWarehouseId}
            AND "quantity" - "reserved" >= ${quantity}
          RETURNING "id", "quantity", "reserved"
        `,
      );
      if (updated.length !== 1) throw new Error("Adjustment exceeds unreserved finished bundle stock");
      await tx.inventoryLog.create({
        data: {
          productId: bundleId,
          variantId: null,
          warehouseId: bundle.bundleWarehouseId,
          change: -quantity,
          reason: `PREASSEMBLED_BUNDLE_ADJUSTMENT_OUT: ${reason}`,
        },
      });
      return {
        warehouseId: bundle.bundleWarehouseId,
        quantity: updated[0].quantity,
        reserved: updated[0].reserved,
        available: Math.max(0, updated[0].quantity - updated[0].reserved),
      };
    });
    revalidateStorefrontCatalog();
    return NextResponse.json({ success: true, stock: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bundle stock adjustment failed";
    return NextResponse.json({ error: message }, { status: message === "Bundle not found" ? 404 : 400 });
  }
}
