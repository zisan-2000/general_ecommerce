import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Prisma } from "../../generated/prisma";
import type { PrismaClient } from "../../generated/prisma";

type ProductSeedCategory = {
  name: string;
  slug: string;
  parentSlug: string | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  showInHeader: boolean;
  showInFooter: boolean;
  featured: boolean;
};

type ProductSeedVariant = {
  sku: string;
  price: number;
  stock: number;
  options: Record<string, string>;
  isDefault?: boolean;
  costPrice?: number;
  colorImage?: string;
};

type ProductSeedProduct = {
  name: string;
  slug: string;
  sku: string;
  categorySlug: string;
  brandName: string | null;
  basePrice: number;
  originalPrice: number | null;
  currency: string;
  stock: number;
  available: boolean;
  featured: boolean;
  image: string;
  gallery: string[];
  shortDesc: string | null;
  description: string;
  weight: number | null;
  dimensions: Record<string, number> | null;
  variants: ProductSeedVariant[];
};

type ProductSeedFile = {
  categories: ProductSeedCategory[];
  products: ProductSeedProduct[];
};

function loadProductSeed(): ProductSeedFile {
  const filePath = resolve(process.cwd(), "prisma/seed-data/productseed.json");
  return JSON.parse(readFileSync(filePath, "utf8")) as ProductSeedFile;
}

function nullableText(value: string | null | undefined) {
  return value?.trim() || null;
}

export async function seedProductSeedFile(prisma: PrismaClient) {
  const seed = loadProductSeed();
  const categoryIds = new Map<string, number>();
  const brandIds = new Map<string, number>();

  for (const category of seed.categories) {
    const parentId = category.parentSlug
      ? categoryIds.get(category.parentSlug)
      : null;

    if (category.parentSlug && !parentId) {
      throw new Error(`Missing parent category: ${category.parentSlug}`);
    }

    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        image: category.image,
        parentId,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        showInHeader: category.showInHeader,
        showInFooter: category.showInFooter,
        featured: category.featured,
        deleted: false,
      },
      create: {
        name: category.name,
        slug: category.slug,
        image: category.image,
        parentId,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        showInHeader: category.showInHeader,
        showInFooter: category.showInFooter,
        featured: category.featured,
        deleted: false,
      },
      select: { id: true },
    });

    categoryIds.set(category.slug, record.id);
  }

  for (const item of seed.products) {
    const categoryId = categoryIds.get(item.categorySlug);
    if (!categoryId) {
      throw new Error(`Missing product category: ${item.categorySlug}`);
    }

    const brandName = nullableText(item.brandName);
    let brandId: number | null = null;
    if (brandName) {
      const brandSlug = brandName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const brand = await prisma.brand.upsert({
        where: { name: brandName },
        update: {
          slug: brandSlug,
          deleted: false,
        },
        create: {
          name: brandName,
          slug: brandSlug,
          deleted: false,
        },
        select: { id: true },
      });
      brandId = brand.id;
      brandIds.set(brandName, brand.id);
    }

    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        sku: item.sku,
        categoryId,
        brandId,
        description: item.description,
        shortDesc: nullableText(item.shortDesc),
        basePrice: item.basePrice,
        originalPrice: item.originalPrice,
        currency: item.currency,
        weight: item.weight,
        dimensions: item.dimensions ?? Prisma.JsonNull,
        available: item.available,
        featured: item.featured,
        image: nullableText(item.image),
        gallery: item.gallery.filter(Boolean),
        deleted: false,
      },
      create: {
        name: item.name,
        slug: item.slug,
        sku: item.sku,
        categoryId,
        brandId,
        description: item.description,
        shortDesc: nullableText(item.shortDesc),
        basePrice: item.basePrice,
        originalPrice: item.originalPrice,
        currency: item.currency,
        weight: item.weight,
        dimensions: item.dimensions ?? Prisma.JsonNull,
        available: item.available,
        featured: item.featured,
        image: nullableText(item.image),
        gallery: item.gallery.filter(Boolean),
        deleted: false,
      },
      select: { id: true },
    });

    const variants = item.variants.length
      ? item.variants
      : [
          {
            sku: `${item.sku}-DEFAULT`,
            price: item.basePrice,
            stock: item.stock,
            options: {},
            isDefault: true,
            costPrice: Math.round(item.basePrice * 0.7 * 100) / 100,
          },
        ];

    for (const variantSeed of variants) {
      const existingVariant = await prisma.productVariant.findFirst({
        where: { productId: product.id, sku: variantSeed.sku },
        select: { id: true },
      });
      const data = {
        productId: product.id,
        sku: variantSeed.sku,
        price: variantSeed.price,
        currency: item.currency,
        stock: variantSeed.stock,
        options: variantSeed.options,
        colorImage: nullableText(variantSeed.colorImage),
        isDefault: variantSeed.isDefault ?? false,
        active: item.available,
        costPrice: variantSeed.costPrice ?? null,
      };

      if (existingVariant) {
        await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data,
        });
      } else {
        await prisma.productVariant.create({ data });
      }
    }
  }

  return {
    categories: seed.categories.length,
    products: seed.products.length,
    brands: brandIds.size,
  };
}
