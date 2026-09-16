import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";
import { requireProductManager } from "@/lib/product-management-access";
import { normalizeBundleSku, normalizeBundleStockQuantity } from "@/lib/bundle-inventory";
import { calculateBundleBasePrice, prepareBundleGroups } from "@/lib/configurable-bundle-admin";

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

const bundleAdminInclude = {
  bundleItems: {
    include: {
      product: { select: { id: true, name: true, basePrice: true, image: true, available: true } },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  bundleGroups: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      options: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          product: { select: { id: true, name: true, basePrice: true, image: true, available: true } },
          variant: { select: { id: true, sku: true, price: true, options: true, active: true } },
        },
      },
    },
  },
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
} as const;

function withBundleStats(bundle: any) {
  const defaultOptions = bundle.bundleGroups.flatMap((group: any) =>
    group.options
      .filter((option: any) => option.isDefault)
      .map((option: any) => ({ option, quantity: group.defaultQuantity })),
  );
  const regularTotal = defaultOptions.reduce(
    (total: number, row: any) =>
      total + Number(row.option.variant?.price ?? row.option.product.basePrice) * row.quantity,
    0,
  );
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

export async function GET(request: NextRequest) {
  const auth = await requireProductManager();
  if (auth) return auth;
  const featureGate = await gateStoreFeature("BUNDLES", 403);
  if (featureGate) return featureGate;
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 10)));
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status");
    const where: any = { type: "BUNDLE", deleted: false };
    if (search) {
      where.OR = ["name", "slug", "description"].map((field) => ({
        [field]: { contains: search, mode: "insensitive" },
      }));
    }
    if (status === "active") where.available = true;
    if (status === "inactive") where.available = false;
    const [bundles, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: bundleAdminInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);
    return NextResponse.json({
      bundles: bundles.map(withBundleStats),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching bundles:", error);
    return NextResponse.json({ error: "Failed to fetch bundles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireProductManager();
  if (auth) return auth;
  const featureGate = await gateStoreFeature("BUNDLES", 403);
  if (featureGate) return featureGate;
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const categoryId = Number(body.categoryId);
    const warehouseId = Number(body.warehouseId);
    if (!name || !description || !Number.isInteger(categoryId) || categoryId <= 0) {
      return NextResponse.json({ error: "Name, description and category are required" }, { status: 400 });
    }
    if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
      return NextResponse.json({ error: "Please select a valid warehouse" }, { status: 400 });
    }
    const requestedLimit = normalizeBundleStockQuantity(body.bundleStockLimit);
    if (requestedLimit === undefined) {
      return NextResponse.json({ error: "Bundle stock limit must be a whole number of zero or more" }, { status: 400 });
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const sku = normalizeBundleSku(body.sku, slug);
    const duplicate = await prisma.product.findFirst({
      where: { OR: [{ slug }, { sku }] },
      select: { slug: true, sku: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: duplicate.slug === slug ? "A product with this name already exists" : "A product with this SKU already exists" },
        { status: 409 },
      );
    }
    const rawGroups = Array.isArray(body.groups) ? body.groups : legacyItemsToGroups(body.items);
    const bundle = await prisma.$transaction(async (tx) => {
      const prepared = await prepareBundleGroups(tx, rawGroups);
      const basePrice = calculateBundleBasePrice({
        regularTotal: prepared.defaultRegularTotal,
        discountType: body.discountType,
        discountValue: body.discountValue,
        manualPrice: body.manualPrice,
      });
      const created = await tx.product.create({
        data: {
          name,
          slug,
          description,
          shortDesc: String(body.shortDesc || "").trim() || null,
          type: "BUNDLE",
          sku,
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
            create: prepared.groups.map((group) => ({
              ...group,
              options: { create: group.options },
            })),
          },
        },
      });
      if (prepared.legacyDefaultItems.length > 0) {
        await tx.productBundleItem.createMany({
          data: prepared.legacyDefaultItems.map((item) => ({ ...item, bundleId: created.id })),
        });
      }
      return created;
    });
    revalidateStorefrontCatalog();
    return NextResponse.json({ success: true, bundle }, { status: 201 });
  } catch (error) {
    console.error("Error creating configurable bundle:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create bundle" },
      { status: 400 },
    );
  }
}
