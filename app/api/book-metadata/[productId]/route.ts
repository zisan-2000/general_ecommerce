import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";
import { hasBookMetadata, parseBookMetadataInput } from "@/lib/book-metadata";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" } as const;

type Context = { params: Promise<{ productId: string }> };

function parseProductId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function requireProductManager() {
  const session = await getServerSession(authOptions);
  const access = await getAccessContext(
    session?.user as { id?: string; role?: string } | undefined,
  );
  if (!access.userId) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!access.has("products.manage")) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { access };
}

export async function GET(_request: Request, context: Context) {
  const gate = await gateStoreFeature("BOOKS", 404);
  if (gate) return gate;

  const { productId: rawId } = await context.params;
  const productId = parseProductId(rawId);
  if (!productId) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const metadata = await prisma.bookMetadata.findUnique({
    where: { productId },
    include: {
      writer: { select: { id: true, name: true, image: true } },
      publisher: { select: { id: true, name: true, image: true } },
    },
  });
  if (!metadata) {
    return NextResponse.json({ error: "Book metadata not found" }, { status: 404 });
  }

  return NextResponse.json(metadata, { headers: PRIVATE_NO_STORE });
}

export async function PUT(request: Request, context: Context) {
  const gate = await gateStoreFeature("BOOKS", 403);
  if (gate) return gate;
  const auth = await requireProductManager();
  if ("response" in auth) return auth.response;

  const { productId: rawId } = await context.params;
  const productId = parseProductId(rawId);
  if (!productId) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const parsed = parseBookMetadataInput(await request.json());
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, deleted: false },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const { writerId, publisherId } = parsed.value;
  const [writer, publisher] = await Promise.all([
    writerId
      ? prisma.writer.findFirst({ where: { id: writerId, deleted: false }, select: { id: true } })
      : Promise.resolve(null),
    publisherId
      ? prisma.publisher.findFirst({ where: { id: publisherId, deleted: false }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  if (writerId && !writer) {
    return NextResponse.json({ error: "Writer not found" }, { status: 400 });
  }
  if (publisherId && !publisher) {
    return NextResponse.json({ error: "Publisher not found" }, { status: 400 });
  }

  if (!hasBookMetadata(parsed.value)) {
    await prisma.bookMetadata.deleteMany({ where: { productId } });
    return NextResponse.json({ productId, writerId: null, publisherId: null }, { headers: PRIVATE_NO_STORE });
  }

  const metadata = await prisma.bookMetadata.upsert({
    where: { productId },
    create: { productId, writerId, publisherId },
    update: { writerId, publisherId },
    include: {
      writer: { select: { id: true, name: true, image: true } },
      publisher: { select: { id: true, name: true, image: true } },
    },
  });
  return NextResponse.json(metadata, { headers: PRIVATE_NO_STORE });
}

export async function DELETE(_request: Request, context: Context) {
  const gate = await gateStoreFeature("BOOKS", 403);
  if (gate) return gate;
  const auth = await requireProductManager();
  if ("response" in auth) return auth.response;

  const { productId: rawId } = await context.params;
  const productId = parseProductId(rawId);
  if (!productId) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  await prisma.bookMetadata.deleteMany({ where: { productId } });
  return NextResponse.json({ success: true }, { headers: PRIVATE_NO_STORE });
}
