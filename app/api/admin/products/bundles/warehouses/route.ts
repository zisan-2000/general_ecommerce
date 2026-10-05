import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";
import { requireProductManager } from "@/lib/product-management-access";

export async function GET() {
  const auth = await requireProductManager();
  if (auth) return auth;
  const featureGate = await gateStoreFeature("BUNDLES", 403);
  if (featureGate) return featureGate;

  const warehouses = await prisma.warehouse.findMany({
    select: { id: true, name: true, code: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ warehouses });
}
