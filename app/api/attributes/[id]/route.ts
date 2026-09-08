import { prisma } from "@/lib/prisma";
import { requireProductManager } from "@/lib/product-management-access";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import { parseAttributeDefinitionInput } from "@/lib/attribute-schema";
import { NextResponse } from "next/server";

/* =========================
   UPDATE ATTRIBUTE
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

    const parsed = parseAttributeDefinitionInput(await req.json());
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 },
      );
    }
    const { name, type, unit } = parsed.value;
    const duplicate = await prisma.attribute.findFirst({
      where: { name, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "An attribute with this name already exists" },
        { status: 409 },
      );
    }

    const updated = await prisma.attribute.update({
      where: { id },
      data: { name, type, unit },
    });

    revalidateStorefrontCatalog();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT ATTRIBUTE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update attribute" },
      { status: 500 },
    );
  }
}

/* =========================
   DELETE ATTRIBUTE
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

    await prisma.$transaction(async (tx) => {
      await tx.productAttribute.deleteMany({ where: { attributeId: id } });
      await tx.categoryAttribute.deleteMany({ where: { attributeId: id } });
      await tx.attributeValue.deleteMany({ where: { attributeId: id } });
      await tx.attribute.delete({ where: { id } });
    });

    revalidateStorefrontCatalog();

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("DELETE ATTRIBUTE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete attribute" },
      { status: 500 },
    );
  }
}

