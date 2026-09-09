import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { requireBookManager, revalidateBookTaxonomy } from "@/lib/book-admin-server";
import { parseBookPartyInput } from "@/lib/book-party";
import { prisma } from "@/lib/prisma";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";
import { isStorefrontRequest, privateJson, publicJson } from "@/lib/public-cache";

export async function GET(request: Request) {
  const storefront = isStorefrontRequest(request);
  const gate = await gateStoreFeature("BOOKS", storefront ? 404 : 403);
  if (gate) return gate;
  if (!storefront) {
    const auth = await requireBookManager();
    if (!auth.ok) return auth.response;
  }
  const publishers = await prisma.publisher.findMany({
    where: { deleted: false },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { bookMetadata: { where: { product: { deleted: false, available: true } } } },
      },
    },
  });
  const payload = publishers.map((publisher) => ({
    ...publisher,
    bookCount: publisher._count.bookMetadata,
  }));
  return storefront
    ? publicJson(payload, { maxAge: 300, staleWhileRevalidate: 1_800 })
    : privateJson(payload);
}

export async function POST(request: Request) {
  const gate = await gateStoreFeature("BOOKS", 403);
  if (gate) return gate;
  const auth = await requireBookManager();
  if (!auth.ok) return auth.response;
  const parsed = parseBookPartyInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const publisher = await prisma.publisher.create({ data: parsed.value });
    revalidateBookTaxonomy();
    await logActivity({ action: "create", entity: "publisher", entityId: publisher.id, after: publisher, access: auth.access, request });
    return NextResponse.json(publisher, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Publisher name already exists." }, { status: 409 });
    }
    throw error;
  }
}
