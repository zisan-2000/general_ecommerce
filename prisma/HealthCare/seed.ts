import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "../../generated/prisma";
import healthcareProducts from "./healthcare_products.json";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

type SeedVariantOption = {
  name: string;
  position?: number;
  values: Array<{ value: string; position?: number }>;
};

function requiredPrice(value: number | string | null | undefined) {
  // The source keeps TBA metadata; required database prices must be numeric.
  const price = new Prisma.Decimal(value ?? 0);
  if (!price.isFinite() || price.isNegative()) {
    throw new Error(`Invalid Health Care price: ${value}`);
  }
  return price;
}

async function seedVariantOptions(
  tx: Prisma.TransactionClient,
  productId: number,
  options: SeedVariantOption[],
) {
  for (const [index, source] of options.entries()) {
    const data = { name: source.name, position: source.position ?? index };
    const option = await tx.productVariantOption.upsert({
      where: { productId_name: { productId, name: source.name } },
      update: data,
      create: { ...data, product: { connect: { id: productId } } },
      select: { id: true },
    });

    for (const [valueIndex, sourceValue] of source.values.entries()) {
      const valueData = {
        value: sourceValue.value,
        position: sourceValue.position ?? valueIndex,
      };
      await tx.productVariantOptionValue.upsert({
        where: {
          optionId_value: { optionId: option.id, value: sourceValue.value },
        },
        update: valueData,
        create: { ...valueData, option: { connect: { id: option.id } } },
      });
    }
  }
}

async function main() {
  console.log("Starting Health Care seed...");

  // Guard this standalone entry point against accidentally loading another catalog.
  const categorySource = healthcareProducts.categories[0];
  if (
    healthcareProducts.categories.length !== 1 ||
    categorySource?.slug !== "health-care" ||
    healthcareProducts.products.length !== 5 ||
    healthcareProducts.products.some(
      (product) => product.categorySlug !== categorySource.slug,
    )
  ) {
    throw new Error("Expected the Health Care category and its five products.");
  }

  const categoryData = {
    name: categorySource.name,
    image: categorySource.image,
    isActive: categorySource.isActive,
    sortOrder: categorySource.sortOrder,
    showInHeader: categorySource.showInHeader,
    showInFooter: categorySource.showInFooter,
    featured: categorySource.featured,
    deleted: false,
  };
  const category = await prisma.category.upsert({
    where: { slug: categorySource.slug },
    update: { ...categoryData, parent: { disconnect: true } },
    create: { ...categoryData, slug: categorySource.slug },
    select: { id: true },
  });

  const brandIds = new Map<string, number>();
  for (const source of healthcareProducts.brands) {
    const bySlug = await prisma.brand.findUnique({ where: { slug: source.slug } });
    const byName = await prisma.brand.findUnique({ where: { name: source.name } });
    if (bySlug && byName && bySlug.id !== byName.id) {
      throw new Error(`Brand name/slug conflict: ${source.name}`);
    }
    const existing = bySlug ?? byName;
    const data = { name: source.name, logo: source.logo, deleted: false };
    const brand = existing
      ? await prisma.brand.update({ where: { id: existing.id }, data })
      : await prisma.brand.upsert({
          where: { slug: source.slug },
          update: data,
          create: { ...data, slug: source.slug },
        });
    brandIds.set(source.name, brand.id);
  }

  // Physical stock in this application requires a warehouse StockLevel.
  const warehouse =
    (await prisma.warehouse.findFirst({
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      select: { id: true },
    })) ??
    (await prisma.warehouse.upsert({
      where: { code: "WH-HQ" },
      update: {},
      create: {
        code: "WH-HQ",
        name: "Head Office Central Warehouse",
        isDefault: true,
        country: "BD",
      },
      select: { id: true },
    }));

  for (const source of healthcareProducts.products) {
    const brandId = source.brandName ? brandIds.get(source.brandName) : undefined;
    if (source.brandName && brandId === undefined) {
      throw new Error(`Missing Health Care brand: ${source.brandName}`);
    }

    await prisma.$transaction(async (tx) => {
      const bySlug = await tx.product.findUnique({
        where: { slug: source.slug },
        select: { id: true, slug: true },
      });
      const bySku = await tx.product.findUnique({
        where: { sku: source.sku },
        select: { id: true, slug: true },
      });
      if (bySlug && bySku && bySlug.id !== bySku.id) {
        throw new Error(`Product slug/SKU conflict: ${source.slug}`);
      }
      const existing = bySlug ?? bySku;

      // Explicitly map supported model fields; source-only TBA/review metadata
      // stays in the JSON. The specification's "Price: TBA" is retained below.
      const data = {
        name: source.name,
        slug: existing?.slug ?? source.slug,
        sku: source.sku,
        type: source.type as Prisma.ProductCreateInput["type"],
        description: source.description,
        shortDesc: source.shortDesc,
        model: source.model,
        warranty: source.warranty,
        basePrice: requiredPrice(source.basePrice),
        originalPrice: source.originalPrice,
        currency: source.currency,
        weight: source.weight,
        dimensions: source.dimensions == null ? Prisma.DbNull : source.dimensions,
        available: source.available,
        featured: source.featured,
        image: source.image,
        gallery: source.gallery,
        soldCount: source.soldCount,
        ratingAvg: source.ratingAvg,
        ratingCount: source.ratingCount,
        lowStockThreshold: source.lowStockThreshold,
        inventoryItemClass:
          source.inventoryItemClass as Prisma.ProductCreateInput["inventoryItemClass"],
        requiresAssetTag: source.requiresAssetTag,
        bundleStockLimit: source.bundleStockLimit,
        deleted: false,
        category: { connect: { id: category.id } },
        brand: brandId !== undefined ? { connect: { id: brandId } } : undefined,
      } satisfies Prisma.ProductCreateInput;

      const product = existing
        ? await tx.product.update({
            where: { id: existing.id },
            data: {
              ...data,
              brand: brandId !== undefined
                ? { connect: { id: brandId } }
                : { disconnect: true },
            },
            select: { id: true },
          })
        : await tx.product.create({ data, select: { id: true } });

      await seedVariantOptions(tx, product.id, source.variantOptions);

      for (const sourceVariant of source.variants) {
        // Variant SKU is not @unique in the actual schema; scope lookup to product.
        const existingVariant = await tx.productVariant.findFirst({
          where: { productId: product.id, sku: sourceVariant.sku },
          orderBy: { id: "asc" },
          select: { id: true },
        });
        const variantData = {
          sku: sourceVariant.sku,
          price: requiredPrice(sourceVariant.price),
          currency: sourceVariant.currency,
          stock: sourceVariant.stock,
          options: sourceVariant.options,
          isDefault: sourceVariant.isDefault,
          active: sourceVariant.active,
          lowStockThreshold: sourceVariant.lowStockThreshold,
          costPrice: sourceVariant.costPrice,
          colorImage: sourceVariant.colorImage,
          product: { connect: { id: product.id } },
        } satisfies Prisma.ProductVariantCreateInput;
        const variant = existingVariant
          ? await tx.productVariant.update({
              where: { id: existingVariant.id },
              data: variantData,
              select: { id: true },
            })
          : await tx.productVariant.create({
              data: variantData,
              select: { id: true },
            });

        await tx.stockLevel.upsert({
          where: {
            warehouseId_productVariantId: {
              warehouseId: warehouse.id,
              productVariantId: variant.id,
            },
          },
          update: { quantity: sourceVariant.stock },
          create: {
            quantity: sourceVariant.stock,
            reserved: 0,
            warehouse: { connect: { id: warehouse.id } },
            variant: { connect: { id: variant.id } },
          },
        });
        // Preserve reservations and include existing stock in other warehouses.
        const stockLevels = await tx.stockLevel.findMany({
          where: { productVariantId: variant.id },
          select: { quantity: true, reserved: true },
        });
        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            stock: stockLevels.reduce(
              (total, level) => total + Math.max(0, level.quantity - level.reserved),
              0,
            ),
          },
        });
      }

      // Groups/items have no unique natural keys in Prisma, so find then update.
      for (const sourceGroup of source.specificationGroups) {
        const existingGroup = await tx.productSpecificationGroup.findFirst({
          where: { productId: product.id, name: sourceGroup.name },
          orderBy: { id: "asc" },
          select: { id: true },
        });
        const groupData = { name: sourceGroup.name, position: sourceGroup.position };
        const group = existingGroup
          ? await tx.productSpecificationGroup.update({
              where: { id: existingGroup.id },
              data: groupData,
              select: { id: true },
            })
          : await tx.productSpecificationGroup.create({
              data: { ...groupData, product: { connect: { id: product.id } } },
              select: { id: true },
            });

        for (const sourceItem of sourceGroup.items) {
          const existingItem = await tx.productSpecificationItem.findFirst({
            where: { groupId: group.id, label: sourceItem.label },
            orderBy: { id: "asc" },
            select: { id: true },
          });
          const itemData = {
            label: sourceItem.label,
            value: sourceItem.value,
            position: sourceItem.position,
          };
          if (existingItem) {
            await tx.productSpecificationItem.update({
              where: { id: existingItem.id },
              data: itemData,
            });
          } else {
            await tx.productSpecificationItem.create({
              data: { ...itemData, group: { connect: { id: group.id } } },
            });
          }
        }
      }
    }, { timeout: 30_000 });

    console.log(`Seeded Health Care product: ${source.slug}`);
  }

  console.log("Health Care seed completed.");
}

main()
  .catch((error) => {
    console.error("Health Care seed failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
