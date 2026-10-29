// app/api/banners/[id]/route.ts

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { getAccessContext } from "@/lib/rbac";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
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
   GET SINGLE BANNER
========================= */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    const banner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      return NextResponse.json(
        { error: "Banner not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(banner);
  } catch (error) {
    console.error("GET banner error:", error);
    return NextResponse.json(
      { error: "Failed to fetch banner" },
      { status: 500 },
    );
  }
}

/* =========================
   UPDATE BANNER
========================= */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: idParam } = await params;
    const id = parseInt(idParam);
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
    const existing = await prisma.banner.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }

    const banner = await prisma.banner.update({
      where: { id },
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

    revalidateStorefrontBanners();

    await logActivity({
      action: "update_banner",
      entity: "banner",
      entityId: banner.id,
      access,
      request: req,
      metadata: {
        message: `Banner updated: ${banner.title || `#${banner.id}`}`,
      },
      before: toBannerLogSnapshot(existing),
      after: toBannerLogSnapshot(banner),
    });

    return NextResponse.json(banner);
  } catch (error) {
    console.error("PUT banner error:", error);
    return NextResponse.json(
      { error: "Failed to update banner" },
      { status: 500 },
    );
  }
}

/* =========================
   DELETE BANNER
========================= */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const existing = await prisma.banner.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }

    const banner = await prisma.banner.delete({
      where: { id },
    });

    revalidateStorefrontBanners();

    await logActivity({
      action: "delete_banner",
      entity: "banner",
      entityId: banner.id,
      access,
      request: req,
      metadata: {
        message: `Banner deleted: ${existing.title || `#${existing.id}`}`,
      },
      before: toBannerLogSnapshot(existing),
    });

    return NextResponse.json(banner);
  } catch (error) {
    console.error("DELETE banner error:", error);
    return NextResponse.json(
      { error: "Failed to delete banner" },
      { status: 500 },
    );
  }
}
