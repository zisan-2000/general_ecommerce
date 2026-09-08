import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";

/* =========================
   GET SERVICE SLOTS
   Required query: ?productId=1
========================= */
export async function GET(req: Request) {
  const featureGate = await gateStoreFeature("SERVICE_PRODUCTS");
  if (featureGate) return featureGate;
  try {
    const url = new URL(req.url);
    const productIdParam = url.searchParams.get("productId");
    const productId = productIdParam ? Number(productIdParam) : null;

    if (!productId || Number.isNaN(productId)) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 },
      );
    }

    const slots = await prisma.serviceSlot.findMany({
      where: { productId },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json(slots);
  } catch (error) {
    console.error("GET SERVICE SLOTS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch service slots" },
      { status: 500 },
    );
  }
}

/* =========================
   CREATE SERVICE SLOT
========================= */
export async function POST(req: Request) {
  const featureGate = await gateStoreFeature("SERVICE_PRODUCTS", 403);
  if (featureGate) return featureGate;
  try {
    const body = await req.json();
    const productId = Number(body.productId);
    if (!productId || Number.isNaN(productId)) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 },
      );
    }

    const startsAt = body.startsAt ? new Date(String(body.startsAt)) : null;
    const endsAt = body.endsAt ? new Date(String(body.endsAt)) : null;
    const capacity = body.capacity !== undefined ? Number(body.capacity) : 1;

    if (!startsAt || isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "startsAt is required" }, { status: 400 });
    }
    if (!endsAt || isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "endsAt is required" }, { status: 400 });
    }
    if (!Number.isFinite(capacity) || capacity < 1) {
      return NextResponse.json(
        { error: "capacity must be 1 or more" },
        { status: 400 },
      );
    }

    const created = await prisma.serviceSlot.create({
      data: {
        productId,
        startsAt,
        endsAt,
        capacity,
        timezone: body.timezone ? String(body.timezone) : null,
        location: body.location ? String(body.location) : null,
        notes: body.notes ? String(body.notes) : null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST SERVICE SLOT ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create service slot" },
      { status: 500 },
    );
  }
}

