import { NextResponse } from "next/server";
import { parseCategoryAttributeMappings } from "@/lib/attribute-schema";
import {
  requireProductAccess,
  requireProductManager,
} from "@/lib/product-management-access";
import { prisma } from "@/lib/prisma";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const denied = await requireProductAccess(["products.manage", "inventory.manage"]);
    if (denied) return denied;

    const categoryId = parseId((await params).id);
    if (!categoryId) {
      return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
    }

    const category = await prisma.category.findFirst({
      where: { id: categoryId, deleted: false },
      select: {
        id: true,
        name: true,
        categoryAttributes: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: { attribute: { include: { values: true } } },
        },
      },
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("GET CATEGORY ATTRIBUTES ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch category attributes" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const denied = await requireProductManager();
    if (denied) return denied;

    const categoryId = parseId((await params).id);
    if (!categoryId) {
      return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = parseCategoryAttributeMappings(
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).attributes
        : null,
    );
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const attributeIds = parsed.value.map((item) => item.attributeId);
    const [category, attributeCount] = await Promise.all([
      prisma.category.findFirst({
        where: { id: categoryId, deleted: false },
        select: { id: true },
      }),
      prisma.attribute.count({ where: { id: { in: attributeIds } } }),
    ]);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (attributeCount !== attributeIds.length) {
      return NextResponse.json(
        { error: "One or more attributes do not exist" },
        { status: 400 },
      );
    }

    const mappings = await prisma.$transaction(async (tx) => {
      await tx.categoryAttribute.deleteMany({ where: { categoryId } });
      if (parsed.value.length) {
        await tx.categoryAttribute.createMany({
          data: parsed.value.map((item) => ({ categoryId, ...item })),
        });
      }
      return tx.categoryAttribute.findMany({
        where: { categoryId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: { attribute: { include: { values: true } } },
      });
    });

    revalidateStorefrontCatalog();
    return NextResponse.json({ categoryId, attributes: mappings });
  } catch (error) {
    console.error("PUT CATEGORY ATTRIBUTES ERROR:", error);
    return NextResponse.json({ error: "Failed to update category attributes" }, { status: 500 });
  }
}
