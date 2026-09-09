import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";
import { hasBookMetadata, parseBookMetadataInput } from "@/lib/book-metadata";
import {
  readBookMetadataCompat,
  writeBookMetadataCompat,
} from "@/lib/book-metadata-server";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";

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

function revalidateBookSurfaces(productId: number) {
  revalidateStorefrontCatalog();
  revalidatePath("/ecommerce/books");
  revalidatePath("/ecommerce/authors", "layout");
  revalidatePath("/ecommerce/publishers", "layout");
  revalidatePath(`/ecommerce/products/${productId}`);
}

export async function GET(_request: Request, context: Context) {
  const gate = await gateStoreFeature("BOOKS", 404);
  if (gate) return gate;
  const auth = await requireProductManager();
  if ("response" in auth) return auth.response;

  const { productId: rawId } = await context.params;
  const productId = parseProductId(rawId);
  if (!productId) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const metadata = await readBookMetadataCompat(productId);
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

  const parsed = parseBookMetadataInput(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { writerId, publisherId } = parsed.value;
  const before = await readBookMetadataCompat(productId);
  if (!before) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const [writer, publisher] = await Promise.all([
        writerId
          ? tx.writer.findFirst({ where: { id: writerId, deleted: false }, select: { id: true } })
          : null,
        publisherId
          ? tx.publisher.findFirst({ where: { id: publisherId, deleted: false }, select: { id: true } })
          : null,
      ]);
      if (writerId && !writer) throw new Error("BOOK_WRITER_NOT_FOUND");
      if (publisherId && !publisher) throw new Error("BOOK_PUBLISHER_NOT_FOUND");
      return writeBookMetadataCompat(tx, productId, parsed.value);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "BOOK_WRITER_NOT_FOUND") {
      return NextResponse.json({ error: "Writer not found" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "BOOK_PUBLISHER_NOT_FOUND") {
      return NextResponse.json({ error: "Publisher not found" }, { status: 400 });
    }
    throw error;
  }
  revalidateBookSurfaces(productId);
  await logActivity({
    action: hasBookMetadata(parsed.value) ? "update" : "delete",
    entity: "book_metadata",
    entityId: productId,
    before,
    after: result ?? { productId, writerId: null, publisherId: null },
    access: auth.access,
    request,
  });
  return NextResponse.json(
    result ?? { productId, writerId: null, publisherId: null },
    { headers: PRIVATE_NO_STORE },
  );
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

  const before = await readBookMetadataCompat(productId);
  if (!before) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  await prisma.$transaction((tx) =>
    writeBookMetadataCompat(tx, productId, { writerId: null, publisherId: null }),
  );
  revalidateBookSurfaces(productId);
  await logActivity({
    action: "delete",
    entity: "book_metadata",
    entityId: productId,
    before,
    after: { productId, writerId: null, publisherId: null },
    access: auth.access,
    request: _request,
  });
  return NextResponse.json({ success: true }, { headers: PRIVATE_NO_STORE });
}
