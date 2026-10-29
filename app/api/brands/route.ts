// api/brands/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import slugify from "slugify";
import { isStorefrontRequest, privateJson, publicJson } from "@/lib/public-cache";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";

function createBrandSlug(name: string) {
  const asciiSlug = slugify(name, { lower: true, strict: true });
  if (asciiSlug) return asciiSlug;

  // `slugify` drops scripts it cannot transliterate (for example Bangla).
  // Keep those letters in a valid, stable URL slug instead of creating an
  // empty slug that subsequently collides with every similar brand name.
  return name
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function toBrandLogSnapshot(brand: {
  name: string;
  slug: string;
  logo?: string | null;
}) {
  return {
    name: brand.name,
    slug: brand.slug,
    logo: brand.logo ?? null,
  };
}

/* =========================
   GET ALL BRANDS
========================= */
export async function GET(req: Request) {
  try {
    const brands = await prisma.brand.findMany({
      where: { deleted: false },
      orderBy: { id: "desc" },
      include: {
        _count: {
          select: {
            products: {
              where: { deleted: false },
            },
          },
        },
      },
    });

    const data = brands.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        logo: b.logo,
        productCount: b._count.products,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      }));
    return isStorefrontRequest(req)
      ? publicJson(data, { maxAge: 300, staleWhileRevalidate: 1800 })
      : privateJson(data);
  } catch (error) {
    console.error("GET BRANDS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch brands" },
      { status: 500 }
    );
  }
}

/* =========================
   CREATE BRAND
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
      return NextResponse.json({ error: "Invalid brand payload" }, { status: 400 });
    }

    const normalizedName = String((body as Record<string, unknown>).name ?? "").trim();
    const logoValue = (body as Record<string, unknown>).logo;
    const normalizedLogo =
      typeof logoValue === "string" && logoValue.trim() ? logoValue.trim() : null;

    if (!normalizedName)
      return NextResponse.json(
        { error: "Brand name required" },
        { status: 400 }
      );

    const slug = createBrandSlug(normalizedName);
    if (!slug) {
      return NextResponse.json(
        { error: "Brand name must contain at least one letter or number" },
        { status: 400 },
      );
    }

    const [slugOwner, nameOwner] = await Promise.all([
      prisma.brand.findUnique({ where: { slug } }),
      prisma.brand.findUnique({ where: { name: normalizedName } }),
    ]);

    if (
      (slugOwner && !slugOwner.deleted) ||
      (nameOwner && !nameOwner.deleted) ||
      (slugOwner && nameOwner && slugOwner.id !== nameOwner.id)
    )
      return NextResponse.json(
        { error: "Brand already exists" },
        { status: 409 }
      );

    const existing = slugOwner ?? nameOwner;

    // A soft-deleted row still owns its unique name and slug. Restore it so
    // admins can add that brand again without a database constraint failure.
    const brand = existing
      ? await prisma.brand.update({
          where: { id: existing.id },
          data: {
            name: normalizedName,
            slug,
            logo: normalizedLogo,
            deleted: false,
          },
        })
      : await prisma.brand.create({
          data: {
            name: normalizedName,
            slug,
            logo: normalizedLogo,
          },
        });

    await logActivity({
      action: existing ? "restore" : "create",
      entity: "brand",
      entityId: brand.id,
      access,
      request: req,
      metadata: {
        message: existing
          ? `Brand restored: ${brand.name}`
          : `Brand created: ${brand.name}`,
      },
      before: existing ? toBrandLogSnapshot(existing) : null,
      after: toBrandLogSnapshot(brand),
    });

    revalidateStorefrontCatalog();

    return NextResponse.json(brand, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("POST BRAND ERROR:", error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Brand already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create brand" },
      { status: 500 }
    );
  }
}
