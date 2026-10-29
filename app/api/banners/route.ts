// app/api/banners/route.ts

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { getAccessContext } from "@/lib/rbac";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { isStorefrontRequest, privateJson, publicJson } from "@/lib/public-cache";
import { parseBannerLink } from "@/lib/banner-link";
import { revalidateStorefrontBanners } from "@/lib/banner-cache";

function toBannerLogSnapshot(banner: {
  id: number;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  image: string;
  mobileImage: string | null;
  buttonText: string | null;
  buttonLink: string | null;
  position: number;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  type: string;
}) {
  return {
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle,
    description: banner.description,
    image: banner.image,
    mobileImage: banner.mobileImage,
    buttonText: banner.buttonText,
    buttonLink: banner.buttonLink,
    position: banner.position,
    isActive: banner.isActive,
    startDate: banner.startDate?.toISOString() ?? null,
    endDate: banner.endDate?.toISOString() ?? null,
    type: banner.type,
  };
}

/* =========================
   GET ALL BANNERS
========================= */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const activeOnly = searchParams.get("active");

    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (activeOnly === "true") {
      where.isActive = true;
      where.OR = [{ startDate: null }, { startDate: { lte: new Date() } }];
      where.AND = [
        {
          OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
        },
      ];
    }

    const banners = await prisma.banner.findMany({
      where,
      orderBy: { position: "asc" },
    });

    return isStorefrontRequest(req)
      ? publicJson(banners, { maxAge: 120, staleWhileRevalidate: 600 })
      : privateJson(banners);
  } catch (error) {
    console.error("GET banners error:", error);
    return NextResponse.json(
      { error: "Failed to fetch banners" },
      { status: 500 },
    );
  }
}

/* =========================
   CREATE BANNER
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
    if (!access.hasAny(["settings.banner.manage", "settings.manage"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid banner payload" }, { status: 400 });
    }
    const buttonLink = parseBannerLink(body.buttonLink);
    if (!buttonLink.ok) {
      return NextResponse.json(
        { error: "Banner destination must be a valid internal route" },
        { status: 400 },
      );
    }

    const banner = await prisma.banner.create({
      data: {
        title: body.title,
        subtitle: body.subtitle || null,
        description: body.description || null,

        image: body.image,
        mobileImage: body.mobileImage || null,

        buttonText: body.buttonText || null,
        buttonLink: buttonLink.value,

        position: body.position ?? 0,
        isActive: body.isActive ?? true,

        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,

        type: body.type || "HERO",
      },
    });

    await logActivity({
      action: "create_banner",
      entity: "banner",
      entityId: banner.id,
      access,
      request: req,
      metadata: {
        message: `Banner created: ${banner.title || `#${banner.id}`}`,
      },
      after: toBannerLogSnapshot(banner),
    });

    revalidateStorefrontBanners();

    return NextResponse.json(banner);
  } catch (error) {
    console.error("POST banner error:", error);
    return NextResponse.json(
      { error: "Failed to create banner" },
      { status: 500 },
    );
  }
}
