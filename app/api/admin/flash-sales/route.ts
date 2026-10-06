import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/public-cache";
import { adminProductQuery } from "@/lib/admin-product-pagination";
import { Prisma } from "@/generated/prisma";
import { getStoreFeatureRegistry } from "@/lib/store-features-server";

async function ensureAccess() {
  const session = await getServerSession(authOptions);
  const access = await getAccessContext(
    session?.user as { id?: string; role?: string } | undefined,
  );
  if (!access.userId) return { ok: false as const, status: 401 };
  if (!access.has("products.manage")) return { ok: false as const, status: 403 };
  return { ok: true as const, access };
}

export async function GET(request: Request) {
  try {
    const allowed = await ensureAccess();
    if (!allowed.ok) {
      return NextResponse.json(
        { error: allowed.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: allowed.status },
      );
    }

    const url = new URL(request.url);
    const { page, from, orderBy } = adminProductQuery(url.searchParams);
    const pageSize = Math.min(
      100,
      Math.max(10, Number(url.searchParams.get("pageSize")) || 50),
    );
    const sort = url.searchParams.get("sort");
    const selectedOrder = !sort || sort === "flash-sale"
      ? Prisma.sql`p."flashSaleEnabled" DESC, p."flashSaleSortOrder" ASC, p."updatedAt" DESC, p.id ASC`
      : orderBy;
    const [rows, totals, categories, registry] = await Promise.all([
      prisma.$queryRaw<{ id: number }[]>(Prisma.sql`SELECT p.id ${from} ORDER BY ${selectedOrder}
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
      prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total ${from}`),
      prisma.category.findMany({ where: { deleted: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      getStoreFeatureRegistry(),
    ]);
    const total = Number(totals[0]?.total ?? 0);

    const products = await prisma.product.findMany({
        where: { id: { in: rows.map(row => row.id) }, deleted: false },
        select: {
          id: true,
          name: true,
          sku: true,
          image: true,
          available: true,
          basePrice: true,
          currency: true,
          flashSaleEnabled: true,
          flashSalePrice: true,
          flashSaleStartsAt: true,
          flashSaleEndsAt: true,
          flashSaleSortOrder: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          variants: {
            where: { active: true },
            select: { stock: true },
          },
        },
      });
    const productsById = new Map(products.map(product => [product.id, product]));
    const orderedProducts = rows.flatMap(row => {
      const product = productsById.get(row.id);
      return product ? [product] : [];
    });

    return privateJson({
      categories,
      features: {
        DIGITAL_PRODUCTS: registry.features.DIGITAL_PRODUCTS.enabled,
        SERVICE_PRODUCTS: registry.features.SERVICE_PRODUCTS.enabled,
        BUNDLES: registry.features.BUNDLES.enabled,
      },
      items: orderedProducts.map((product) => ({
        ...product,
        basePrice: Number(product.basePrice),
        flashSalePrice:
          product.flashSalePrice === null ? null : Number(product.flashSalePrice),
        flashSaleStartsAt: product.flashSaleStartsAt?.toISOString() ?? null,
        flashSaleEndsAt: product.flashSaleEndsAt?.toISOString() ?? null,
        updatedAt: product.updatedAt.toISOString(),
        stock: product.variants.reduce((sum, variant) => sum + variant.stock, 0),
        variants: undefined,
      })),
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    console.error("FLASH SALE LIST ERROR:", error);
    return NextResponse.json(
      { error: "Failed to load flash sale products" },
      { status: 500 },
    );
  }
}
