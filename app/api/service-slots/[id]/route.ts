import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";

/* =========================
   UPDATE SERVICE SLOT
========================= */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const featureGate = await gateStoreFeature("SERVICE_PRODUCTS", 403);
  if (featureGate) return featureGate;
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json();
    const existing = await prisma.serviceSlot.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Service slot not found" },
        { status: 404 },
      );
    }

    const startsAt =
      body.startsAt !== undefined
        ? body.startsAt
          ? new Date(String(body.startsAt))
          : null
        : existing.startsAt;
    const endsAt =
      body.endsAt !== undefined
        ? body.endsAt
          ? new Date(String(body.endsAt))
          : null
        : existing.endsAt;

    if (!startsAt || isNaN(new Date(startsAt).getTime())) {
      return NextResponse.json({ error: "startsAt is required" }, { status: 400 });
    }
    if (!endsAt || isNaN(new Date(endsAt).getTime())) {
      return NextResponse.json({ error: "endsAt is required" }, { status: 400 });
    }

    const updated = await prisma.serviceSlot.update({
      where: { id },
      data: {
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        capacity:
          body.capacity !== undefined ? Number(body.capacity) : existing.capacity,
        timezone: body.timezone !== undefined ? body.timezone : existing.timezone,
        location: body.location !== undefined ? body.location : existing.location,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT SERVICE SLOT ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update service slot" },
      { status: 500 },
    );
  }
}

/* =========================
   DELETE SERVICE SLOT
========================= */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const featureGate = await gateStoreFeature("SERVICE_PRODUCTS", 403);
  if (featureGate) return featureGate;
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await prisma.serviceSlot.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("DELETE SERVICE SLOT ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete service slot" },
      { status: 500 },
    );
  }
}

