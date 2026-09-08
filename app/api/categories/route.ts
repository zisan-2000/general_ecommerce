// api/categories/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import slugify from "slugify";
import { isStorefrontRequest, privateJson, publicJson } from "@/lib/public-cache";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import {
  CATEGORY_NAVIGATION_DEFAULTS,
  getEffectivelyActiveCategoryIds,
  parseCategoryNavigationPatch,
} from "@/lib/category-navigation";
import { getEffectiveStorefrontCategoryIdSet } from "@/lib/category-navigation-server";

function toCategoryLogSnapshot(category: {
  name: string;
  slug: string;
  image?: string | null;
  parentId?: number | null;
  isActive?: boolean;
  sortOrder?: number;
  showInHeader?: boolean;
  showInFooter?: boolean;
  featured?: boolean;
}) {
  return {
    name: category.name,
    slug: category.slug,
    image: category.image ?? null,
    parentId: category.parentId ?? null,
    isActive: category.isActive ?? CATEGORY_NAVIGATION_DEFAULTS.isActive,
    sortOrder: category.sortOrder ?? CATEGORY_NAVIGATION_DEFAULTS.sortOrder,
    showInHeader:
      category.showInHeader ?? CATEGORY_NAVIGATION_DEFAULTS.showInHeader,
    showInFooter:
      category.showInFooter ?? CATEGORY_NAVIGATION_DEFAULTS.showInFooter,
    featured: category.featured ?? CATEGORY_NAVIGATION_DEFAULTS.featured,
  };
}

/* =========================
   GET ALL CATEGORIES
========================= */
export async function GET(req: Request) {
  try {
    const storefront = isStorefrontRequest(req);
    const categories = await prisma.category.findMany({
      where: { deleted: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      include: {
        parent: true,
        children: {
          where: { deleted: false },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
        },
        _count: {
          select: {
            products: {
              where: {
                deleted: false,
                ...(storefront ? { available: true } : {}),
              },
            },
          },
        },
      },
    });

    const effectivelyActiveIds = storefront
      ? getEffectivelyActiveCategoryIds(categories)
      : null;
    const visibleCategories = storefront
      ? categories.filter((category) => effectivelyActiveIds?.has(category.id))
      : categories;

    const categoryMap = new Map(
      visibleCategories.map((category) => [category.id, category]),
    );
    const childMap = new Map<number, number[]>();

    visibleCategories.forEach((category) => {
      if (!category.parentId || !categoryMap.has(category.parentId)) return;
      const siblings = childMap.get(category.parentId) ?? [];
      siblings.push(category.id);
      childMap.set(category.parentId, siblings);
    });

    const totals = new Map<number, number>();

    const computeTotalProductCount = (categoryId: number): number => {
      if (totals.has(categoryId)) return totals.get(categoryId)!;
      const category = categoryMap.get(categoryId);
      if (!category) return 0;

      const childrenTotal = (childMap.get(categoryId) ?? []).reduce(
        (sum, childId) => sum + computeTotalProductCount(childId),
        0,
      );
      const total = category._count.products + childrenTotal;
      totals.set(categoryId, total);
      return total;
    };

    const formatted = visibleCategories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      image: c.image,
      parentId: c.parentId,
      parentName: c.parent?.name || null,
      productCount: computeTotalProductCount(c.id),
      childrenCount: (childMap.get(c.id) ?? []).length,
      isActive: c.isActive,
      sortOrder: c.sortOrder,
      showInHeader: c.showInHeader,
      showInFooter: c.showInFooter,
      featured: c.featured,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      deleted: c.deleted,
    }));

    return storefront
      ? publicJson(formatted, { maxAge: 300, staleWhileRevalidate: 1800 })
      : privateJson(formatted);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}

/* =========================
   CREATE CATEGORY
========================= */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(
      session?.user as { id?: string; role?: string } | undefined,
    );
    if (!access.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!access.has("products.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid category payload" }, { status: 400 });
    }

    const { name, parentId, image } = body as Record<string, unknown>;
    const normalizedName = String(name ?? "").trim();
    if (!normalizedName) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 },
      );
    }

    const navigation = parseCategoryNavigationPatch(body);
    if (!navigation.ok) {
      return NextResponse.json({ error: navigation.error }, { status: 400 });
    }

    const normalizedParentId =
      parentId === null || parentId === undefined || parentId === ""
        ? null
        : Number(parentId);
    if (
      normalizedParentId !== null &&
      (!Number.isInteger(normalizedParentId) || normalizedParentId <= 0)
    ) {
      return NextResponse.json({ error: "Invalid parent category" }, { status: 400 });
    }

    if (normalizedParentId !== null) {
      const parent = await prisma.category.findFirst({
        where: { id: normalizedParentId, deleted: false },
        select: { id: true, isActive: true },
      });
      if (!parent) {
        return NextResponse.json({ error: "Parent category not found" }, { status: 404 });
      }
      const activeCategoryIds = await getEffectiveStorefrontCategoryIdSet();
      if (
        (navigation.value.isActive ?? true) &&
        (!parent.isActive || !activeCategoryIds.has(parent.id))
      ) {
        return NextResponse.json(
          { error: "An active category cannot be placed under an inactive parent" },
          { status: 409 },
        );
      }
    }

    const slug = slugify(normalizedName, { lower: true, strict: true });
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "Category already exists" },
        { status: 400 },
      );
    }

    const category = await prisma.category.create({
      data: {
        name: normalizedName,
        slug,
        image: typeof image === "string" && image.trim() ? image.trim() : null,
        parentId: normalizedParentId,
        ...navigation.value,
      },
    });

    await logActivity({
      action: "create",
      entity: "category",
      entityId: category.id,
      access,
      request: req,
      metadata: { message: `Category created: ${category.name}` },
      after: toCategoryLogSnapshot(category),
    });

    revalidateStorefrontCatalog();
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 },
    );
  }
}
