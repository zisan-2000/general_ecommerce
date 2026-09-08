import { prisma } from "@/lib/prisma";
import { requireProductManager } from "@/lib/product-management-access";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import { NextResponse } from "next/server";
import {
  canDeleteCategoryProductAttribute,
  validateSingleCategoryProductAttribute,
} from "@/lib/category-product-attributes-server";

/* =========================
   UPDATE PRODUCT ATTRIBUTE
========================= */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const denied = await requireProductManager();
    if (denied) return denied;

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json();
    const value = String(body.value || "").trim();
    if (!value || value.length > 500) {
      return NextResponse.json(
        { error: "Value must be between 1 and 500 characters" },
        { status: 400 },
      );
    }

    const existing = await prisma.productAttribute.findUnique({
      where: { id },
      select: {
        id: true,
        attributeId: true,
        product: { select: { categoryId: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const validation = await validateSingleCategoryProductAttribute({
      categoryId: existing.product.categoryId,
      attributeId: existing.attributeId,
      value,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updated = await prisma.productAttribute.update({
      where: { id },
      data: validation.value,
      include: { attribute: true },
    });

    revalidateStorefrontCatalog();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT PRODUCT ATTRIBUTE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update product attribute" },
      { status: 500 },
    );
  }
}

/* =========================
   DELETE PRODUCT ATTRIBUTE
========================= */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const denied = await requireProductManager();
    if (denied) return denied;

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await prisma.productAttribute.findUnique({
      where: { id },
      select: {
        id: true,
        attributeId: true,
        product: { select: { categoryId: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const deletion = await canDeleteCategoryProductAttribute({
      categoryId: existing.product.categoryId,
      attributeId: existing.attributeId,
    });
    if (!deletion.ok) {
      return NextResponse.json({ error: deletion.error }, { status: 409 });
    }

    await prisma.productAttribute.delete({ where: { id } });
    revalidateStorefrontCatalog();
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("DELETE PRODUCT ATTRIBUTE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete product attribute" },
      { status: 500 },
    );
  }
}

