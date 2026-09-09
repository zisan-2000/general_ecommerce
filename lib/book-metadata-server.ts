import "server-only";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  hasBookMetadata,
  resolveCompatibleBookMetadata,
  type BookMetadataInput,
} from "@/lib/book-metadata";

export async function readBookMetadataCompat(productId: number) {
  const product = await prisma.product.findFirst({
    where: { id: productId, deleted: false },
    select: {
      id: true,
      writerId: true,
      publisherId: true,
      bookMetadata: {
        select: { id: true, writerId: true, publisherId: true, createdAt: true, updatedAt: true },
      },
    },
  });
  if (!product) return null;

  const effective = resolveCompatibleBookMetadata({
    legacy: { writerId: product.writerId, publisherId: product.publisherId },
    metadata: product.bookMetadata,
  });
  const [writer, publisher] = await Promise.all([
    effective.writerId
      ? prisma.writer.findFirst({
          where: { id: effective.writerId, deleted: false },
          select: { id: true, name: true, image: true },
        })
      : null,
    effective.publisherId
      ? prisma.publisher.findFirst({
          where: { id: effective.publisherId, deleted: false },
          select: { id: true, name: true, image: true },
        })
      : null,
  ]);

  return {
    id: product.bookMetadata?.id ?? null,
    productId: product.id,
    ...effective,
    writer,
    publisher,
    source: product.bookMetadata ? ("bookMetadata" as const) : ("legacy" as const),
    createdAt: product.bookMetadata?.createdAt ?? null,
    updatedAt: product.bookMetadata?.updatedAt ?? null,
  };
}

export async function writeBookMetadataCompat(
  tx: Prisma.TransactionClient,
  productId: number,
  input: BookMetadataInput,
) {
  if (!hasBookMetadata(input)) {
    await Promise.all([
      tx.bookMetadata.deleteMany({ where: { productId } }),
      tx.product.update({
        where: { id: productId },
        data: { writerId: null, publisherId: null },
      }),
    ]);
    return null;
  }

  const metadata = await tx.bookMetadata.upsert({
    where: { productId },
    create: { productId, ...input },
    update: input,
    include: {
      writer: { select: { id: true, name: true, image: true } },
      publisher: { select: { id: true, name: true, image: true } },
    },
  });
  await tx.product.update({
    where: { id: productId },
    data: input,
  });
  return metadata;
}
