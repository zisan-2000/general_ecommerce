import { WAREHOUSE_BRANDS, WAREHOUSE_CATEGORIES, WAREHOUSE_PRODUCTS } from "./constants";
import { snapshotDate } from "./helpers";
import type { TxClient, WarehouseSeedContext } from "./types";

export async function seedWarehouseStockManagement(
  prisma: TxClient,
  ctx: WarehouseSeedContext,
): Promise<WarehouseSeedContext> {
  for (const category of WAREHOUSE_CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, deleted: false },
      create: { name: category.name, slug: category.slug, deleted: false },
      select: { id: true },
    });
    ctx.categories[category.key] = record.id;
  }

  for (const brand of WAREHOUSE_BRANDS) {
    const record = await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name, deleted: false },
      create: { name: brand.name, slug: brand.slug, deleted: false },
      select: { id: true },
    });
    ctx.brands[brand.key] = record.id;
  }

  const warehouseKeys = Object.keys(ctx.warehouses);

  for (const [index, product] of WAREHOUSE_PRODUCTS.entries()) {
    const productRecord = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        sku: product.sku,
        categoryId: ctx.categories[product.categoryKey],
        brandId: ctx.brands[product.brandKey],
        description: `${product.name} seeded for warehouse stock management.`,
        shortDesc: "Warehouse stock demo product",
        basePrice: product.price,
        originalPrice: product.price + 450,
        currency: "BDT",
        weight: 0.5 + index * 0.3,
        dimensions: { length: 12 + index, width: 8 + index, height: 4 + index },
        lowStockThreshold: product.low,
        available: true,
        featured: true,
        deleted: false,
        image: "/placeholder.svg",
        gallery: [],
      },
      create: {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        categoryId: ctx.categories[product.categoryKey],
        brandId: ctx.brands[product.brandKey],
        description: `${product.name} seeded for warehouse stock management.`,
        shortDesc: "Warehouse stock demo product",
        basePrice: product.price,
        originalPrice: product.price + 450,
        currency: "BDT",
        weight: 0.5 + index * 0.3,
        dimensions: { length: 12 + index, width: 8 + index, height: 4 + index },
        lowStockThreshold: product.low,
        available: true,
        featured: true,
        deleted: false,
        image: "/placeholder.svg",
        gallery: [],
      },
      select: { id: true },
    });
    ctx.products[product.key] = productRecord.id;

    const existingVariant = await prisma.productVariant.findFirst({
      where: { sku: product.variantSku },
      select: { id: true },
    });

    const variant = existingVariant
      ? await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: {
            productId: productRecord.id,
            price: product.price,
            currency: "BDT",
            stock: product.stock,
            options: product.options,
            isDefault: true,
            active: true,
            lowStockThreshold: product.low,
            costPrice: product.cost,
          },
          select: { id: true },
        })
      : await prisma.productVariant.create({
          data: {
            productId: productRecord.id,
            sku: product.variantSku,
            price: product.price,
            currency: "BDT",
            stock: product.stock,
            options: product.options,
            isDefault: true,
            active: true,
            lowStockThreshold: product.low,
            costPrice: product.cost,
          },
          select: { id: true },
        });

    ctx.variants[product.key] = variant.id;

    const warehouseKey = warehouseKeys[index % warehouseKeys.length];
    const warehouseId = ctx.warehouses[warehouseKey];
    const reserved = Math.floor(product.stock * 0.12);

    const stockLevel = await prisma.stockLevel.upsert({
      where: {
        warehouseId_productVariantId: {
          warehouseId,
          productVariantId: variant.id,
        },
      },
      update: {
        quantity: product.stock,
        reserved,
      },
      create: {
        warehouseId,
        productVariantId: variant.id,
        quantity: product.stock,
        reserved,
      },
      select: { id: true },
    });
    ctx.stockLevels[product.key] = stockLevel.id;

    await prisma.inventoryLog.create({
      data: {
        productId: productRecord.id,
        variantId: variant.id,
        warehouseId,
        change: product.stock,
        reason: `Warehouse seed opening stock for ${product.name}`,
      },
    });

    await prisma.inventoryDailySnapshot.upsert({
      where: {
        snapshotDate_variantId: {
          snapshotDate: snapshotDate(index),
          variantId: variant.id,
        },
      },
      update: {
        productId: productRecord.id,
        warehouseId,
        stock: product.stock,
        lowStockThreshold: product.low,
        status: product.stock <= product.low ? "LOW" : "OK",
      },
      create: {
        snapshotDate: snapshotDate(index),
        productId: productRecord.id,
        variantId: variant.id,
        warehouseId,
        stock: product.stock,
        lowStockThreshold: product.low,
        status: product.stock <= product.low ? "LOW" : "OK",
      },
    });

    await prisma.inventoryWarehouseDailySnapshot.upsert({
      where: {
        snapshotDate_variantId_warehouseId: {
          snapshotDate: snapshotDate(index),
          variantId: variant.id,
          warehouseId,
        },
      },
      update: {
        productId: productRecord.id,
        quantity: product.stock,
        reserved,
        available: product.stock - reserved,
      },
      create: {
        snapshotDate: snapshotDate(index),
        productId: productRecord.id,
        variantId: variant.id,
        warehouseId,
        quantity: product.stock,
        reserved,
        available: product.stock - reserved,
      },
    });
  }

  return ctx;
}
