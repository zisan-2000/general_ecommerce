import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";

/* =========================
   UPDATE DIGITAL ASSET
========================= */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const featureGate = await gateStoreFeature("DIGITAL_PRODUCTS", 403);
  if (featureGate) return featureGate;
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await prisma.digitalAsset.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Digital asset not found" },
        { status: 404 },
      );
    }

    const body = await req.json();

    const title =
      body.title !== undefined ? String(body.title || "").trim() : existing.title;
    const fileUrl =
      body.fileUrl !== undefined
        ? String(body.fileUrl || "").trim()
        : existing.fileUrl;

    if (!title || !fileUrl) {
      return NextResponse.json(
        { error: "Title and File URL are required" },
        { status: 400 },
      );
    }

    const updated = await prisma.digitalAsset.update({
      where: { id },
      data: {
        title,
        fileUrl,
        storageProvider:
          body.storageProvider !== undefined
            ? body.storageProvider ?? null
            : existing.storageProvider,
        fileSize:
          body.fileSize !== undefined
            ? body.fileSize === null
              ? null
              : Number(body.fileSize)
            : existing.fileSize,
        checksum:
          body.checksum !== undefined ? body.checksum ?? null : existing.checksum,
        mimeType:
          body.mimeType !== undefined ? body.mimeType ?? null : existing.mimeType,
        maxDownloads:
          body.maxDownloads !== undefined
            ? body.maxDownloads === null
              ? null
              : Number(body.maxDownloads)
            : existing.maxDownloads,
        expiresAt:
          body.expiresAt !== undefined
            ? body.expiresAt
              ? new Date(String(body.expiresAt))
              : null
            : existing.expiresAt,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT DIGITAL ASSET ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update digital asset" },
      { status: 500 },
    );
  }
}

/* =========================
   DELETE DIGITAL ASSET
========================= */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const featureGate = await gateStoreFeature("DIGITAL_PRODUCTS", 403);
  if (featureGate) return featureGate;
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const deliveriesCount = await prisma.digitalDelivery.count({
      where: { digitalAssetId: id },
    });
    if (deliveriesCount > 0) {
      return NextResponse.json(
        { error: "This asset is used in deliveries and cannot be deleted" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { digitalAssetId: id },
        data: { digitalAssetId: null },
      });
      await tx.productVariant.updateMany({
        where: { digitalAssetId: id },
        data: { digitalAssetId: null },
      });
      await tx.digitalAsset.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("DELETE DIGITAL ASSET ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete digital asset" },
      { status: 500 },
    );
  }
}

