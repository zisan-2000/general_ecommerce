import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "../generated/prisma";
import { syncVariantWarehouseStock } from "../lib/inventory";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();

async function main() {
  const productId = Number(process.argv[2]);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw new Error("Usage: tsx scripts/repair-product-warehouse-stock.ts <productId>");
  }
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: productId },
      select: { type: true },
    });
    if (product.type !== "PHYSICAL") throw new Error("Expected a physical product");
    const variants = await tx.productVariant.findMany({
      where: { productId, stockLevels: { none: {} } },
      select: { id: true, stock: true },
    });
    for (const variant of variants) {
      await syncVariantWarehouseStock({
        tx,
        productId,
        productVariantId: variant.id,
        quantity: variant.stock,
        reason: "Repair missing warehouse stock from existing variant stock",
      });
    }
    return { productId, repairedVariants: variants.length };
  });
  console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
