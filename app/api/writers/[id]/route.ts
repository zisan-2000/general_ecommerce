import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { requireBookManager, parsePositiveRouteId, revalidateBookTaxonomy } from "@/lib/book-admin-server";
import { parseBookPartyInput } from "@/lib/book-party";
import { prisma } from "@/lib/prisma";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";
import { isStorefrontRequest, privateJson, publicJson } from "@/lib/public-cache";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const storefront = isStorefrontRequest(request);
  const gate = await gateStoreFeature(storefront ? "AUTHORS" : "BOOKS", storefront ? 404 : 403);
  if (gate) return gate;
  if (!storefront) {
    const auth = await requireBookManager();
    if (!auth.ok) return auth.response;
  }
  const id = parsePositiveRouteId((await context.params).id);
  if (!id) return NextResponse.json({ error: "Invalid writer id." }, { status: 400 });
  const writer = await prisma.writer.findFirst({
    where: { id, deleted: false },
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
  if (!writer) return NextResponse.json({ error: "Writer not found." }, { status: 404 });
  const payload = { ...writer, bookCount: writer._count.bookMetadata };
  return storefront
    ? publicJson(payload, { maxAge: 300, staleWhileRevalidate: 1_800 })
    : privateJson(payload);
}

export async function PUT(request: Request, context: Context) {
  const gate = await gateStoreFeature("BOOKS", 403);
  if (gate) return gate;
  const auth = await requireBookManager();
  if (!auth.ok) return auth.response;
  const id = parsePositiveRouteId((await context.params).id);
  if (!id) return NextResponse.json({ error: "Invalid writer id." }, { status: 400 });
  const parsed = parseBookPartyInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const before = await prisma.writer.findFirst({ where: { id, deleted: false } });
  if (!before) return NextResponse.json({ error: "Writer not found." }, { status: 404 });
  try {
    const writer = await prisma.writer.update({ where: { id }, data: parsed.value });
    revalidateBookTaxonomy();
    await logActivity({ action: "update", entity: "writer", entityId: id, before, after: writer, access: auth.access, request });
    return privateJson(writer);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Writer name already exists." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: Request, context: Context) {
  const gate = await gateStoreFeature("BOOKS", 403);
  if (gate) return gate;
  const auth = await requireBookManager();
  if (!auth.ok) return auth.response;
  const id = parsePositiveRouteId((await context.params).id);
  if (!id) return NextResponse.json({ error: "Invalid writer id." }, { status: 400 });
  const before = await prisma.writer.findFirst({ where: { id, deleted: false } });
  if (!before) return NextResponse.json({ error: "Writer not found." }, { status: 404 });
  const writer = await prisma.writer.update({ where: { id }, data: { deleted: true } });
  revalidateBookTaxonomy();
  await logActivity({ action: "delete", entity: "writer", entityId: id, before, after: writer, access: auth.access, request });
  return privateJson({ success: true });
}
