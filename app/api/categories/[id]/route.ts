// api/categories/[id]/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import slugify from "slugify";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import {
  isStorefrontRequest,
  privateJson,
  publicJson,
} from "@/lib/public-cache";
import {
  getEffectivelyActiveCategoryIds,
  parseCategoryNavigationPatch,
} from "@/lib/category-navigation";

function toCategoryLogSnapshot(category: {
  name: string;
  slug: string;
  image?: string | null;
  parentId?: number | null;
  deleted?: boolean;
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
    deleted: category.deleted ?? false,
    isActive: category.isActive ?? true,
    sortOrder: category.sortOrder ?? 0,
    showInHeader: category.showInHeader ?? true,
    showInFooter: category.showInFooter ?? true,
    featured: category.featured ?? false,
  };
}

async function wouldCreateCategoryCycle(categoryId: number, parentId: number | null) {
  if (parentId === null) return false;
  if (parentId === categoryId) return true;

  const categories = await prisma.category.findMany({
    where: { deleted: false },
    select: { id: true, parentId: true },
  });
  const parentById = new Map(categories.map((category) => [category.id, category.parentId]));
  const visited = new Set<number>();
  let currentId: number | null = parentId;

  while (currentId !== null) {
    if (currentId === categoryId) return true;
    if (visited.has(currentId)) return true;
    visited.add(currentId);
    currentId = parentById.get(currentId) ?? null;
  }

  return false;
}

/* =========================
   GET SINGLE CATEGORY
========================= */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const storefront = isStorefrontRequest(req);
    const { id: idParam } = await params;
    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid category id" },
        { status: 400 },
      );
    }

    const category = await prisma.category.findFirst({
      where: { id, deleted: false },
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
        products: {
          where: {
            deleted: false,
            ...(storefront ? { available: true } : {}),
          },
          include: { brand: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    if (storefront) {
      const hierarchy = await prisma.category.findMany({
        where: { deleted: false },
        select: {
          id: true,
          name: true,
          parentId: true,
          isActive: true,
          sortOrder: true,
          showInHeader: true,
          showInFooter: true,
          featured: true,
        },
      });
      if (!getEffectivelyActiveCategoryIds(hierarchy).has(category.id)) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 },
        );
      }
    }

    const response = {
      id: category.id,
      name: category.name,
      slug: category.slug,
      image: category.image,
      parentId: category.parentId,
      parentName: category.parent?.name || null,
      productCount: category._count.products,
      childrenCount: category.children.filter((child) => !storefront || child.isActive).length,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      showInHeader: category.showInHeader,
      showInFooter: category.showInFooter,
      featured: category.featured,
      products: category.products,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };

    return storefront
      ? publicJson(response, { maxAge: 60, staleWhileRevalidate: 300 })
      : privateJson(response);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch category" },
      { status: 500 },
    );
  }
}

/* =========================
   UPDATE CATEGORY
========================= */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid category id" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid category payload" }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const navigation = parseCategoryNavigationPatch(payload);
    if (!navigation.ok) {
      return NextResponse.json({ error: navigation.error }, { status: 400 });
    }

    const existing = await prisma.category.findFirst({
      where: { id, deleted: false },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    const hasParentId = Object.prototype.hasOwnProperty.call(payload, "parentId");
    const nextParentId = hasParentId
      ? payload.parentId === null || payload.parentId === undefined || payload.parentId === ""
        ? null
        : Number(payload.parentId)
      : existing.parentId;

    if (
      nextParentId !== null &&
      (!Number.isInteger(nextParentId) || nextParentId <= 0)
    ) {
      return NextResponse.json({ error: "Invalid parent category" }, { status: 400 });
    }
    if (await wouldCreateCategoryCycle(id, nextParentId)) {
      return NextResponse.json(
        { error: "A category cannot be moved under itself or one of its descendants" },
        { status: 409 },
      );
    }

    const nextIsActive = navigation.value.isActive ?? existing.isActive;
    if (nextParentId !== null) {
      const parent = await prisma.category.findFirst({
        where: { id: nextParentId, deleted: false },
        select: { id: true, isActive: true },
      });
      if (!parent) {
        return NextResponse.json({ error: "Parent category not found" }, { status: 404 });
      }
      if (nextIsActive && !parent.isActive) {
        return NextResponse.json(
          { error: "An active category cannot be placed under an inactive parent" },
          { status: 409 },
        );
      }
    }

    const hasName = payload.name !== undefined;
    const normalizedName = hasName ? String(payload.name ?? "").trim() : existing.name;
    if (!normalizedName) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 },
      );
    }

    let slug = existing.slug;
    if (hasName && normalizedName !== existing.name) {
      slug = slugify(normalizedName, { lower: true, strict: true });
      const duplicate = await prisma.category.findFirst({
        where: { slug, NOT: { id } },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Category name already exists" },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: normalizedName,
        slug,
        image:
          payload.image !== undefined
            ? typeof payload.image === "string" && payload.image.trim()
              ? payload.image.trim()
              : null
            : existing.image,
        parentId: nextParentId,
        ...navigation.value,
      },
    });

    await logActivity({
      action: "update",
      entity: "category",
      entityId: updated.id,
      access,
      request: req,
      metadata: { message: `Category updated: ${updated.name}` },
      before: toCategoryLogSnapshot(existing),
      after: toCategoryLogSnapshot(updated),
    });

    revalidateStorefrontCatalog();
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 },
    );
  }
}

/* =========================
   SOFT DELETE CATEGORY
========================= */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid category id" },
        { status: 400 },
      );
    }

    const existing = await prisma.category.findFirst({
      where: { id, deleted: false },
      include: {
        _count: {
          select: {
            products: { where: { deleted: false } },
            children: { where: { deleted: false } },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }
    if (existing._count.products > 0 || existing._count.children > 0) {
      return NextResponse.json(
        {
          error:
            existing._count.children > 0
              ? "Move or remove child categories before deleting this category"
              : "Move or remove products before deleting this category",
        },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.category.update({
        where: { id },
        data: { deleted: true },
      });
      await tx.category.update({
        where: { id },
        data: { isActive: false },
      });
    });

    await logActivity({
      action: "delete",
      entity: "category",
      entityId: id,
      access,
      request: req,
      metadata: { message: `Category deleted: ${existing.name}` },
      before: toCategoryLogSnapshot(existing),
      after: {
        ...toCategoryLogSnapshot(existing),
        deleted: true,
        isActive: false,
      },
    });

    revalidateStorefrontCatalog();
    return NextResponse.json({
      message: "Category soft deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 },
    );
  }
}
