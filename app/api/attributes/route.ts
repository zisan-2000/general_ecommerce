import { prisma } from "@/lib/prisma";
import {
  requireProductAccess,
  requireProductManager,
} from "@/lib/product-management-access";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import { parseAttributeDefinitionInput } from "@/lib/attribute-schema";
import { NextResponse } from "next/server";

/* =========================
   GET ATTRIBUTES
========================= */
export async function GET() {
  try {
    const denied = await requireProductAccess([
      "products.manage",
      "inventory.manage",
    ]);
    if (denied) return denied;

    const attributes = await prisma.attribute.findMany({
      orderBy: { id: "desc" },
      include: {
        values: {
          orderBy: { id: "desc" },
        },
        categoryAttributes: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: { category: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    return NextResponse.json(attributes);
  } catch (error) {
    console.error("GET ATTRIBUTES ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch attributes" },
      { status: 500 },
    );
  }
}

/* =========================
   CREATE ATTRIBUTE
========================= */
export async function POST(req: Request) {
  try {
    const denied = await requireProductManager();
    if (denied) return denied;

    const parsed = parseAttributeDefinitionInput(await req.json());
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 },
      );
    }
    const { name, type, unit } = parsed.value;
    const existing = await prisma.attribute.findFirst({
      where: { name },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An attribute with this name already exists" },
        { status: 409 },
      );
    }

    const created = await prisma.attribute.create({
      data: { name, type, unit },
    });

    revalidateStorefrontCatalog();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST ATTRIBUTE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create attribute" },
      { status: 500 },
    );
  }
}

