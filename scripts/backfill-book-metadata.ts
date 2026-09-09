import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();
const requestedBatchSize = Number(process.env.BOOK_METADATA_BACKFILL_BATCH_SIZE ?? 250);
const batchSize = Number.isInteger(requestedBatchSize)
  ? Math.min(Math.max(requestedBatchSize, 25), 1_000)
  : 250;

type Counters = {
  processed: number;
  metadataCreated: number;
  legacyRepaired: number;
  skipped: number;
  conflicts: number;
  failed: number;
};

async function main() {
  const counters: Counters = {
    processed: 0,
    metadataCreated: 0,
    legacyRepaired: 0,
    skipped: 0,
    conflicts: 0,
    failed: 0,
  };
  let cursor = 0;

  while (true) {
    const products = await prisma.product.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: "asc" },
      take: batchSize,
      select: {
        id: true,
        writerId: true,
        publisherId: true,
        bookMetadata: {
          select: { writerId: true, publisherId: true },
        },
      },
    });
    if (products.length === 0) break;

    for (const product of products) {
      counters.processed += 1;
      cursor = product.id;
      try {
        const metadata = product.bookMetadata;
        if (!metadata) {
          if (product.writerId === null && product.publisherId === null) {
            counters.skipped += 1;
            continue;
          }
          await prisma.bookMetadata.create({
            data: {
              productId: product.id,
              writerId: product.writerId,
              publisherId: product.publisherId,
            },
          });
          counters.metadataCreated += 1;
          continue;
        }

        const writerConflict =
          product.writerId !== null && product.writerId !== metadata.writerId;
        const publisherConflict =
          product.publisherId !== null && product.publisherId !== metadata.publisherId;
        if (writerConflict || publisherConflict) {
          counters.conflicts += 1;
          console.error("Book metadata conflict; authoritative metadata was not overwritten.", {
            productId: product.id,
            legacy: { writerId: product.writerId, publisherId: product.publisherId },
            metadata,
          });
          continue;
        }

        if (
          product.writerId !== metadata.writerId ||
          product.publisherId !== metadata.publisherId
        ) {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              writerId: metadata.writerId,
              publisherId: metadata.publisherId,
            },
            select: { id: true },
          });
          counters.legacyRepaired += 1;
        } else {
          counters.skipped += 1;
        }
      } catch (error) {
        counters.failed += 1;
        console.error("Book metadata backfill row failed.", {
          productId: product.id,
          error,
        });
      }
    }
  }

  console.log("Phase 8 book metadata backfill finished.", counters);
  if (counters.conflicts > 0 || counters.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
