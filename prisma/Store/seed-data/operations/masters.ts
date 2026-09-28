import {
  OPERATION_BRANDS,
  OPERATION_CATEGORIES,
  OPERATION_COURIERS,
  OPERATION_PRODUCTS,
  OPERATION_WAREHOUSES,
} from "./constants";
import type { OperationsSeedContext, TxClient } from "./types";

export async function seedOperationsMasters(
  prisma: TxClient,
  ctx: OperationsSeedContext,
): Promise<OperationsSeedContext> {
  for (const category of OPERATION_CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, deleted: false },
      create: { name: category.name, slug: category.slug, deleted: false },
      select: { id: true },
    });
    ctx.categories[category.key] = record.id;
  }

  for (const brand of OPERATION_BRANDS) {
    const record = await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name, deleted: false },
      create: { name: brand.name, slug: brand.slug, deleted: false },
      select: { id: true },
    });
    ctx.brands[brand.key] = record.id;
  }

  for (const product of OPERATION_PRODUCTS) {
    const productRecord = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        sku: product.sku,
        categoryId: ctx.categories[product.categoryKey],
        brandId: ctx.brands[product.brandKey],
        description: `${product.name} seeded for operations demo.`,
        shortDesc: "Operations demo product",
        basePrice: product.basePrice.toFixed(2),
        originalPrice: product.originalPrice.toFixed(2),
        currency: "BDT",
        available: true,
        featured: true,
        deleted: false,
        image: product.image,
        gallery: [product.image],
        lowStockThreshold: 10,
      },
      create: {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        categoryId: ctx.categories[product.categoryKey],
        brandId: ctx.brands[product.brandKey],
        description: `${product.name} seeded for operations demo.`,
        shortDesc: "Operations demo product",
        basePrice: product.basePrice.toFixed(2),
        originalPrice: product.originalPrice.toFixed(2),
        currency: "BDT",
        available: true,
        featured: true,
        deleted: false,
        image: product.image,
        gallery: [product.image],
        lowStockThreshold: 10,
      },
      select: { id: true },
    });

    ctx.products[product.key] = productRecord.id;

    const existingVariant = await prisma.productVariant.findFirst({
      where: { sku: product.variantSku },
      select: { id: true },
    });

    const variantData = {
      productId: productRecord.id,
      price: product.basePrice.toFixed(2),
      currency: "BDT",
      stock: product.stock,
      options: product.options,
      isDefault: true,
      active: true,
      lowStockThreshold: 10,
      costPrice: (product.basePrice * 0.65).toFixed(2),
    };

    const variant = existingVariant
      ? await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: variantData,
          select: { id: true },
        })
      : await prisma.productVariant.create({
          data: {
            ...variantData,
            sku: product.variantSku,
          },
          select: { id: true },
        });

    ctx.variants[product.key] = variant.id;
  }

  for (const warehouse of OPERATION_WAREHOUSES) {
    const record = await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      update: {
        name: warehouse.name,
        division: warehouse.division,
        district: warehouse.district,
        area: warehouse.area,
        country: "BD",
        isDefault: warehouse.key === "dhaka",
        isMapEnabled: true,
      },
      create: {
        name: warehouse.name,
        code: warehouse.code,
        division: warehouse.division,
        district: warehouse.district,
        area: warehouse.area,
        country: "BD",
        isDefault: warehouse.key === "dhaka",
        isMapEnabled: true,
      },
      select: { id: true },
    });
    ctx.warehouses[warehouse.key] = record.id;
  }

  for (const courier of OPERATION_COURIERS) {
    const record = await prisma.courier.upsert({
      where: { name: courier.name },
      update: {
        type: courier.type as any,
        baseUrl: courier.baseUrl,
        isActive: true,
      },
      create: {
        name: courier.name,
        type: courier.type as any,
        baseUrl: courier.baseUrl,
        isActive: true,
      },
      select: { id: true },
    });
    ctx.couriers[courier.key] = record.id;
  }

  return ctx;
}
