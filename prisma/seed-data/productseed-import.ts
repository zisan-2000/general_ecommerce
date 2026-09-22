import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { Prisma } from "../../generated/prisma";
import type { PrismaClient } from "../../generated/prisma";
import { refreshVariantStock, syncVariantWarehouseStock } from "../../lib/inventory";

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
  model?: string | null;
  warranty?: string | null;
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

const priceSchema = z.number().finite().nonnegative().lt(100000000);
const productSeedSchema = z.object({
  categories: z.array(z.object({
    name: z.string().min(1), slug: z.string().min(1), parentSlug: z.string().nullable(),
    image: z.string().nullable(), isActive: z.boolean(), sortOrder: z.number().int(),
    showInHeader: z.boolean(), showInFooter: z.boolean(), featured: z.boolean(),
  })),
  products: z.array(z.object({
    name: z.string().min(1), slug: z.string().min(1), sku: z.string().min(1),
    categorySlug: z.string().min(1), brandName: z.string().nullable(),
    model: z.string().nullable().optional(), warranty: z.string().nullable().optional(),
    basePrice: priceSchema, originalPrice: priceSchema.nullable(), currency: z.string().length(3),
    stock: z.number().int().nonnegative(), available: z.boolean(), featured: z.boolean(),
    image: z.string(), gallery: z.array(z.string()), shortDesc: z.string().nullable(),
    description: z.string(), weight: z.number().nullable(),
    dimensions: z.record(z.string(), z.number()).nullable(),
    variants: z.array(z.object({
      sku: z.string().min(1), price: priceSchema, stock: z.number().int().nonnegative(),
      options: z.record(z.string(), z.string()), isDefault: z.boolean().optional(),
      costPrice: priceSchema.optional(), colorImage: z.string().optional(),
    })),
    sourceProductUrl: z.string().url().optional(),
    sourceImageUrl: z.string().url().optional(), localImageFile: z.string().optional(),
  })),
});

export function validateProductSeed(value: unknown): ProductSeedFile {
  const seed = productSeedSchema.parse(value);
  const categories = new Set<string>();
  for (const category of seed.categories) {
    if (categories.has(category.slug)) throw new Error(`Duplicate category: ${category.slug}`);
    if (category.parentSlug && !categories.has(category.parentSlug)) {
      throw new Error(`Missing parent category or parent ordered after child: ${category.parentSlug}`);
    }
    categories.add(category.slug);
  }
  for (const key of ["slug", "sku", "sourceProductUrl"] as const) {
    const values = seed.products.map((product) => product[key]).filter(Boolean);
    if (new Set(values).size !== values.length) throw new Error(`Duplicate product ${key}`);
  }
  for (const product of seed.products) {
    if (!categories.has(product.categorySlug)) throw new Error(`Missing product category: ${product.categorySlug}`);
    if (product.localImageFile !== undefined && product.localImageFile !== `public${product.image}`) {
      throw new Error(`Inconsistent local image path: ${product.slug}`);
    }
  }
  return seed;
}

export function loadProductSeed(file = "prisma/seed-data/productseed.json"): ProductSeedFile {
  const filePath = resolve(process.cwd(), file);
  return validateProductSeed(JSON.parse(readFileSync(filePath, "utf8")));
}

function nullableText(value: string | null | undefined) {
  return value?.trim() || null;
}

export async function seedProductSeedFile(prisma: PrismaClient, file?: string) {
  const seed = loadProductSeed(file);
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
        ...(item.model !== undefined ? { model: nullableText(item.model) } : {}),
        ...(item.warranty !== undefined ? { warranty: nullableText(item.warranty) } : {}),
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
        model: nullableText(item.model),
        warranty: nullableText(item.warranty),
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

      await prisma.$transaction(async (tx) => {
        const variant = existingVariant
          ? await tx.productVariant.update({
              where: { id: existingVariant.id },
              data,
            })
          : await tx.productVariant.create({ data });
        const configured = await tx.stockLevel.count({
          where: { productVariantId: variant.id },
        });
        if (configured) {
          // Re-importing must preserve live warehouse quantities/reservations.
          await refreshVariantStock(tx, variant.id);
        } else {
          await syncVariantWarehouseStock({
            tx,
            productId: product.id,
            productVariantId: variant.id,
            quantity: variant.stock,
            reason: "Product seed initial warehouse stock",
          });
        }
      });
    }
  }

  return {
    categories: seed.categories.length,
    products: seed.products.length,
    brands: brandIds.size,
  };
}
