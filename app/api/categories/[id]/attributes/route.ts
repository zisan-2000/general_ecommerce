import { NextResponse } from "next/server";
import {
  parseCategoryAttributeMappings,
  validateCategoryProductAttributePolicy,
} from "@/lib/attribute-schema";
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
    const [category, attributeDefinitions, activeProducts] = await Promise.all([
      prisma.category.findFirst({
        where: { id: categoryId, deleted: false },
        select: { id: true },
      }),
      prisma.attribute.findMany({
        where: { id: { in: attributeIds } },
        select: {
          id: true,
          name: true,
          type: true,
          unit: true,
          values: { select: { id: true, value: true } },
        },
      }),
      prisma.product.findMany({
        where: { categoryId, deleted: false, available: true },
        select: {
          id: true,
          name: true,
          attributes: {
            select: {
              attributeId: true,
              value: true,
              valueText: true,
              valueNumber: true,
              valueBoolean: true,
              attributeValueId: true,
              attribute: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  unit: true,
                  values: { select: { id: true, value: true } },
                },
              },
            },
          },
          variantOptions: {
            select: {
              name: true,
              values: { select: { value: true } },
            },
          },
        },
      }),
    ]);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (attributeDefinitions.length !== attributeIds.length) {
      return NextResponse.json(
        { error: "One or more attributes do not exist" },
        { status: 400 },
      );
    }

    const mappedById = new Map(attributeDefinitions.map((item) => [item.id, item]));
    const prospectiveMappings = parsed.value.map((item) => ({
      ...item,
      attribute: mappedById.get(item.attributeId)!,
    }));
    const invalidProducts = activeProducts.flatMap((product) => {
      const definitionsById = new Map(attributeDefinitions.map((item) => [item.id, item]));
      for (const item of product.attributes) {
        definitionsById.set(item.attributeId, item.attribute);
      }
      const validation = validateCategoryProductAttributePolicy({
        productAttributes: product.attributes.map((item) => ({
          attributeId: item.attributeId,
          value: item.value,
        })),
        definitions: [...definitionsById.values()],
        mappings: prospectiveMappings,
        variantOptions: product.variantOptions.map((option) => ({
          name: option.name,
          values: option.values.map((item) => item.value),
        })),
      });
      if (!validation.ok) {
        return [{ id: product.id, name: product.name, error: validation.error }];
      }
      const expectedById = new Map(validation.value.map((item) => [item.attributeId, item]));
      const staleTypedValue = product.attributes.find((item) => {
        const expected = expectedById.get(item.attributeId);
        if (!expected) return false;
        return !(
          item.valueText === expected.valueText &&
          (item.valueNumber === null ? null : item.valueNumber.toString()) === expected.valueNumber &&
          item.valueBoolean === expected.valueBoolean &&
          item.attributeValueId === expected.attributeValueId
        );
      });
      return staleTypedValue
        ? [{
            id: product.id,
            name: product.name,
            error: `${staleTypedValue.attribute.name} needs typed-value backfill`,
          }]
        : [];
    });
    if (invalidProducts.length) {
      return NextResponse.json(
        {
          error: "This mapping would make active products invalid",
          code: "ACTIVE_PRODUCTS_INCOMPATIBLE",
          products: invalidProducts.slice(0, 20),
          invalidProductCount: invalidProducts.length,
        },
        { status: 409 },
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
