import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";
import { requireProductManager } from "@/lib/product-management-access";
import { normalizeBundleSku, normalizeBundleStockQuantity } from "@/lib/bundle-inventory";
import { calculateBundleBasePrice, prepareBundleGroups } from "@/lib/configurable-bundle-admin";

const detailInclude = {
  category: true,
  brand: true,
  VatClass: true,
  variants: {
    include: { stockLevels: { include: { warehouse: true } } },
    orderBy: { isDefault: "desc" as const },
  },
  bundleItems: {
    include: {
      product: {
        include: {
          category: true,
          brand: true,
          variants: { where: { active: true }, orderBy: { isDefault: "desc" as const } },
        },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  bundleGroups: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      options: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          product: {
            include: {
              category: true,
              brand: true,
              variants: { where: { active: true }, orderBy: { isDefault: "desc" as const } },
            },
          },
          variant: true,
        },
      },
    },
  },
} as const;

function legacyItemsToGroups(items: any[]) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    name: String(item?.product?.name || `Item ${index + 1}`),
    selectionType: "FIXED",
    required: true,
    minSelect: 1,
    maxSelect: 1,
    defaultQuantity: Number(item?.quantity || 1),
    minQuantity: Number(item?.quantity || 1),
    maxQuantity: Number(item?.quantity || 1),
    allowQuantityChange: false,
    options: [{
      productId: Number(item?.product?.id),
      variantId: item?.variant?.id ? Number(item.variant.id) : null,
      isDefault: true,
      priceAdjustment: 0,
    }],
  }));
}

function withStats(bundle: any) {
  const regularTotal = bundle.bundleGroups.reduce((total: number, group: any) => {
    const groupTotal = group.options
      .filter((option: any) => option.isDefault)
      .reduce(
        (sum: number, option: any) =>
          sum + Number(option.variant?.price ?? option.product.basePrice) * group.defaultQuantity,
        0,
      );
    return total + groupTotal;
  }, 0);
  const discountAmount = Math.max(0, regularTotal - Number(bundle.basePrice));
  const discountPercentage = regularTotal > 0 ? (discountAmount / regularTotal) * 100 : 0;
  return {
    ...bundle,
    _stats: {
      itemCount: bundle.bundleGroups.length,
      choiceCount: bundle.bundleGroups.reduce((total: number, group: any) => total + group.options.length, 0),
      regularTotal,
      discountedPrice: Number(bundle.basePrice),
      discountAmount,
      discountPercentage: Math.round(discountPercentage * 100) / 100,
      savings: discountAmount > 0 ? `${Math.round(discountPercentage * 100) / 100}%` : "No discount",
    },
  };
}

async function parseBundleId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const bundleId = Number(id);
  return Number.isInteger(bundleId) && bundleId > 0 ? bundleId : null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProductManager();
  if (auth) return auth;
  const featureGate = await gateStoreFeature("BUNDLES", 403);
  if (featureGate) return featureGate;
  const bundleId = await parseBundleId(params);
  if (!bundleId) return NextResponse.json({ error: "Invalid bundle id" }, { status: 400 });
  const bundle = await prisma.product.findFirst({
    where: { id: bundleId, type: "BUNDLE", deleted: false },
    include: detailInclude,
  });
  if (!bundle) return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  return NextResponse.json(withStats(bundle));
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProductManager();
  if (auth) return auth;
  const featureGate = await gateStoreFeature("BUNDLES", 403);
  if (featureGate) return featureGate;
  const bundleId = await parseBundleId(params);
  if (!bundleId) return NextResponse.json({ error: "Invalid bundle id" }, { status: 400 });
  try {
    const existing = await prisma.product.findFirst({
      where: { id: bundleId, type: "BUNDLE", deleted: false },
      select: { id: true, slug: true, sku: true },
    });
    if (!existing) return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    const body = await request.json();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const categoryId = Number(body.categoryId);
    if (!name || !description || !Number.isInteger(categoryId) || categoryId <= 0) {
      return NextResponse.json({ error: "Name, description and category are required" }, { status: 400 });
    }
    const requestedLimit = normalizeBundleStockQuantity(body.bundleStockLimit);
    if (requestedLimit === undefined) {
      return NextResponse.json({ error: "Bundle stock limit must be a whole number of zero or more" }, { status: 400 });
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const sku = normalizeBundleSku(body.sku, slug, existing.sku);
    const duplicate = await prisma.product.findFirst({
      where: { id: { not: bundleId }, OR: [{ slug }, { sku }] },
      select: { slug: true },
    });
    if (duplicate) return NextResponse.json({ error: "Another product already uses this name or SKU" }, { status: 409 });
    const rawGroups = Array.isArray(body.groups) ? body.groups : legacyItemsToGroups(body.items);
    const updated = await prisma.$transaction(async (tx) => {
      const prepared = await prepareBundleGroups(tx, rawGroups);
      const basePrice = calculateBundleBasePrice({
        regularTotal: prepared.defaultRegularTotal,
        discountType: body.discountType,
        discountValue: body.discountValue,
        manualPrice: body.manualPrice,
      });
      await tx.bundleGroup.deleteMany({ where: { bundleId } });
      await tx.productBundleItem.deleteMany({ where: { bundleId } });
      const bundle = await tx.product.update({
        where: { id: bundleId },
        data: {
          name,
          slug,
          sku,
          description,
          shortDesc: String(body.shortDesc || "").trim() || null,
          categoryId,
          brandId: body.brandId ? Number(body.brandId) : null,
          basePrice,
          originalPrice: prepared.defaultRegularTotal,
          currency: String(body.currency || "BDT").slice(0, 3).toUpperCase(),
          image: body.image || null,
          gallery: Array.isArray(body.gallery) ? body.gallery : [],
          bundleStockLimit: requestedLimit,
          available: body.available !== false,
          featured: Boolean(body.featured),
          VatClassId: body.vatClassId ? Number(body.vatClassId) : null,
          bundleGroups: {
            create: prepared.groups.map((group) => ({ ...group, options: { create: group.options } })),
          },
        },
      });
      if (prepared.legacyDefaultItems.length > 0) {
        await tx.productBundleItem.createMany({
          data: prepared.legacyDefaultItems.map((item) => ({ ...item, bundleId })),
        });
      }
      return bundle;
    });
    revalidateStorefrontCatalog();
    return NextResponse.json({ success: true, bundle: updated });
  } catch (error) {
    console.error("Error updating configurable bundle:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update bundle" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProductManager();
  if (auth) return auth;
  const featureGate = await gateStoreFeature("BUNDLES", 403);
  if (featureGate) return featureGate;
  const bundleId = await parseBundleId(params);
  if (!bundleId) return NextResponse.json({ error: "Invalid bundle id" }, { status: 400 });
  const existing = await prisma.product.findFirst({
    where: { id: bundleId, type: "BUNDLE", deleted: false },
    select: { id: true, _count: { select: { orderItems: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  if (existing._count.orderItems > 0) {
    await prisma.product.update({ where: { id: bundleId }, data: { deleted: true, available: false } });
  } else {
    await prisma.product.delete({ where: { id: bundleId } });
  }
  revalidateStorefrontCatalog();
  return NextResponse.json({ success: true });
}
