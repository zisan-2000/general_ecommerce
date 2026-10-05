import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import { resolveBundleConfiguration } from "@/lib/configurable-bundle";
import {
  deductVariantInventory,
  recordPreassembledBundleAssembly,
} from "@/lib/inventory";

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
  if (!access.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!access.has("inventory.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const bundleId = Number(id);
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
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Assembly quantity must be a whole number greater than 0" },
        { status: 400 },
      );
    }
    const assemblyReference = randomUUID();

    const result = await prisma.$transaction(async (tx) => {
      // Serialize assembly against deletion so newly assembled stock cannot be cascaded away.
      await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${bundleId} FOR NO KEY UPDATE`;
      const bundle = await tx.product.findFirst({
        where: { id: bundleId, type: "BUNDLE", deleted: false },
        include: {
          bundleGroups: {
            orderBy: { sortOrder: "asc" },
            include: {
              options: {
                include: {
                  product: {
                    include: {
                      variants: {
                        where: { active: true },
                        include: {
                          stockLevels: {
                            select: { warehouseId: true, quantity: true, reserved: true },
                          },
                        },
                        orderBy: { isDefault: "desc" },
                      },
                    },
                  },
                  variant: {
                    include: {
                      stockLevels: {
                        select: { warehouseId: true, quantity: true, reserved: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!bundle) throw new Error("Bundle not found");
      if (bundle.bundleFulfillmentMode !== "PREASSEMBLED") {
        throw new Error("Switch this bundle to preassembled fulfillment before assembly");
      }
      if (!bundle.bundleWarehouseId) {
        throw new Error("Select a fulfillment warehouse before assembly");
      }
      if (expectedWarehouseId !== null && expectedWarehouseId !== bundle.bundleWarehouseId) {
        throw new Error("Bundle fulfillment warehouse changed. Refresh stock before assembly.");
      }
      if (!access.can("inventory.manage", bundle.bundleWarehouseId)) {
        throw new Error("You do not have inventory access to this warehouse");
      }

      const fixedComposition = bundle.bundleGroups.length > 0 &&
        bundle.bundleGroups.every((group) =>
          group.selectionType === "FIXED" &&
          group.required &&
          !group.allowQuantityChange &&
          group.minQuantity === group.defaultQuantity &&
          group.maxQuantity === group.defaultQuantity &&
          group.options.length === 1 &&
          group.options[0].product.type === "PHYSICAL",
        );
      if (!fixedComposition) {
        throw new Error("Only fixed bundles made from physical products can be preassembled");
      }

      const configuration = resolveBundleConfiguration({
        bundle: {
          ...bundle,
          bundleFulfillmentMode: "VIRTUAL",
          bundleStockLimit: null,
        },
        selections: [],
        strictWarehouseStock: true,
      });
      if (configuration.availableQuantity < quantity) {
        throw new Error(
          `Insufficient component stock for assembly. Maximum assemble quantity: ${configuration.availableQuantity}`,
        );
      }

      for (const component of configuration.components) {
        if (component.variantId === null) {
          throw new Error(`Inventory variant is not configured for ${component.productName}`);
        }
        const group = bundle.bundleGroups.find((row) => row.id === component.groupId);
        const option = group?.options.find((row) => row.id === component.optionId);
        const variant = option?.variant ?? option?.product.variants.find((row) => row.isDefault) ?? option?.product.variants[0];
        if (!option || !variant) {
          throw new Error(`Inventory variant is not configured for ${component.productName}`);
        }
        await deductVariantInventory({
          tx,
          productId: option.productId,
          productVariantId: variant.id,
          quantity: component.quantity * quantity,
          reason: `Bundle assembly ${assemblyReference}: ${bundle.name}`,
          warehouseId: bundle.bundleWarehouseId,
        });
      }

      await recordPreassembledBundleAssembly({
        tx,
        bundleId,
        warehouseId: bundle.bundleWarehouseId,
        quantity,
        reason: `Assembly ${assemblyReference}: ${quantity} unit(s) of ${bundle.name}`,
      });

      const stock = await tx.bundleStockLevel.findUnique({
        where: {
          productId_warehouseId: {
            productId: bundleId,
            warehouseId: bundle.bundleWarehouseId,
          },
        },
        select: { quantity: true, reserved: true },
      });
      return {
        warehouseId: bundle.bundleWarehouseId,
        assemblyReference,
        quantity: stock?.quantity ?? 0,
        reserved: stock?.reserved ?? 0,
        available: Math.max(0, (stock?.quantity ?? 0) - (stock?.reserved ?? 0)),
      };
    });

    revalidateStorefrontCatalog();
    return NextResponse.json({ success: true, stock: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bundle assembly failed";
    const status = message === "Bundle not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
