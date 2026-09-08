import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";

/* =========================
   GET DIGITAL ASSETS
========================= */
export async function GET() {
  const featureGate = await gateStoreFeature("DIGITAL_PRODUCTS", 403);
  if (featureGate) return featureGate;
  try {
    const assets = await prisma.digitalAsset.findMany({
      orderBy: { id: "desc" },
      select: {
        id: true,
        title: true,
        fileUrl: true,
        mimeType: true,
        fileSize: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(assets);
  } catch (error) {
    console.error("GET DIGITAL ASSETS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch digital assets" },
      { status: 500 },
    );
  }
}

/* =========================
   CREATE DIGITAL ASSET
========================= */
export async function POST(req: Request) {
  const featureGate = await gateStoreFeature("DIGITAL_PRODUCTS", 403);
  if (featureGate) return featureGate;
  try {
    const body = await req.json();

    const title = String(body.title || "").trim();
    const fileUrl = String(body.fileUrl || "").trim();

    if (!title || !fileUrl) {
      return NextResponse.json(
        { error: "Title and File URL are required" },
        { status: 400 },
      );
    }

    const created = await prisma.digitalAsset.create({
      data: {
        title,
        fileUrl,
        storageProvider: body.storageProvider ?? null,
        fileSize:
          body.fileSize !== undefined && body.fileSize !== null
            ? Number(body.fileSize)
            : null,
        checksum: body.checksum ?? null,
        mimeType: body.mimeType ?? null,
        maxDownloads:
          body.maxDownloads !== undefined && body.maxDownloads !== null
            ? Number(body.maxDownloads)
            : null,
        expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST DIGITAL ASSET ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create digital asset" },
      { status: 500 },
    );
  }
}
